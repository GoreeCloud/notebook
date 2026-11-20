import os

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app

TOKEN={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def api(tmp_path):
    return TestClient(create_app(str(tmp_path/"enex.sqlite3"),
                                 token=os.environ["GC_NOTEBOOK_TOKEN"]))


def enex(content="<en-note><h1>Ideas</h1><div>Hello &amp; world</div><en-todo checked=\"true\"/>Done</en-note>",
         resources=""):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export3.dtd">
<en-export export-date="20261120T120000Z" application="Evernote">
<note><title>Archived idea</title><content><![CDATA[{content}]]></content>
<created>20260112T060000Z</created><updated>20260213T070000Z</updated>
<tag>research</tag>{resources}</note></en-export>'''


def upload(c,xml,apply=False,skip=False):
    return c.post("/api/v1/import/enex",headers=TOKEN,
                  json={"xml":xml,"dry_run":not apply,"skip_resources":skip})


def test_safe_text_dtd_dates_tags_and_dryrun(tmp_path):
    c=api(tmp_path)
    doc=enex()
    original=c.get("/api/v1/export",headers=TOKEN).json()
    preview=upload(c,doc)
    assert preview.status_code==200,preview.text
    assert preview.json()["notes"]==1
    assert c.get("/api/v1/export",headers=TOKEN).json()==original
    applied=upload(c,doc,apply=True)
    assert applied.status_code==200,applied.text
    result=c.get("/api/v1/export",headers=TOKEN).json()
    imported=result["notes"][0]
    assert imported["title"]=="Archived idea"
    assert "# Ideas" in imported["body"]
    assert "Hello & world" in imported["body"]
    assert imported["tags"]==["research"]
    assert imported["created_at"].startswith("2026-01-12")
    assert "Evernote Import" in [n["name"] for n in result["notebooks"]]


def test_resources_require_explicit_data_loss_acknowledgement(tmp_path):
    c=api(tmp_path)
    doc=enex(resources="<resource><data encoding=\"base64\">YWJj</data><mime>text/plain</mime></resource>")
    rejected=upload(c,doc)
    assert rejected.status_code==422 and "skip_resources" in rejected.text
    accepted=upload(c,doc,skip=True)
    assert accepted.status_code==200
    assert "omitted" in " ".join(accepted.json()["warnings"])
    committed=upload(c,doc,apply=True,skip=True)
    assert committed.status_code==200
    assert committed.json()["notes"]==1


def test_reject_entity_expansion_bad_doctype_and_bad_xml(tmp_path):
    c=api(tmp_path)
    for doc in [
        '''<?xml version="1.0"?><!DOCTYPE en-export [ <!ENTITY x SYSTEM "file:///etc/passwd"> ]><en-export><note><title>&x;</title></note></en-export>''',
        '<!DOCTYPE en-export SYSTEM "http://evil.invalid/test.dtd"><en-export/>',
        '<en-export><note><title>Broken</title></en-export>',
        '<invalid/>',
        enex().replace("20260112T060000Z","not-a-date")
    ]:
        result=upload(c,doc,apply=True)
        assert result.status_code==422, result.text
    assert c.get("/api/v1/export",headers=TOKEN).json()["notes"]==[]


def test_script_markup_not_inserted_into_note(tmp_path):
    c=api(tmp_path)
    doc=enex(content="<en-note><p>Safe</p><script>stealSecret()</script><div>Note</div></en-note>")
    assert upload(c,doc,apply=True).status_code==200
    body=c.get("/api/v1/export",headers=TOKEN).json()["notes"][0]["body"]
    assert "Safe" in body and "Note" in body and "stealSecret" not in body
