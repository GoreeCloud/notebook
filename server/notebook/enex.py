"""Conservative ENEX-to-Markdown importer; no remote DTD fetch or code execution."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from uuid import uuid4
from xml.etree import ElementTree as ET

from .store import now
from .transfer import InvalidArchive, MAX_BYTES

DOCTYPE = re.compile(
    r"""<!DOCTYPE\s+en-export\s+SYSTEM\s+(["'])https?://xml\.evernote\.com/pub/evernote-export(?:3|4)\.dtd\1\s*>""",
    re.IGNORECASE
)
DATE_FORMAT = "%Y%m%dT%H%M%SZ"


class EnmlToText(HTMLParser):
    """Safely extract Markdown-like text; deliberately drops embedded HTML."""
    BLOCK = {"p","div","ul","ol","li","blockquote","h1","h2","h3","h4","pre","tr"}
    DANGEROUS = {"script","style","iframe","object","svg"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.suppressed = 0

    def handle_starttag(self, tag, attrs):
        tag=tag.lower()
        if tag in self.DANGEROUS:
            self.suppressed += 1
            return
        if self.suppressed:
            return
        if tag in self.BLOCK:
            self.parts.append("\n")
        if tag in {"li"}:
            self.parts.append("- ")
        if tag in {"br","hr"}:
            self.parts.append("\n")
        if tag=="en-todo":
            checked=dict(attrs).get("checked","false").lower() in {"true","checked","1"}
            self.parts.append("- [x] " if checked else "- [ ] ")
        if tag in {"h1","h2","h3","h4"}:
            self.parts.append("#" * int(tag[1]) + " ")

    def handle_endtag(self, tag):
        if tag.lower() in self.DANGEROUS:
            self.suppressed=max(0,self.suppressed-1)
        elif not self.suppressed and tag.lower() in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.suppressed:
            self.parts.append(data)

    def body(self):
        text="".join(self.parts).replace("\r\n","\n").replace("\r","\n")
        lines=[line.rstrip() for line in text.split("\n")]
        return re.sub(r"\n{3,}","\n\n","\n".join(lines)).strip()


def iso(value, fallback):
    if not value:
        return fallback
    if not re.fullmatch(r"\d{8}T\d{6}Z",value):
        raise InvalidArchive("Invalid ENEX timestamp")
    try:
        return datetime.strptime(value, DATE_FORMAT).replace(tzinfo=timezone.utc).isoformat()
    except ValueError as exc:
        raise InvalidArchive("Invalid ENEX timestamp") from exc


def parse_enex(source: str, *, skip_resources: bool = False):
    """Return a v2 JSON import document and explicit warnings.

    ENEX contains ENML content in CDATA. Attachment content is *never* extracted,
    and the caller must explicitly opt into skipping any resources.
    """
    if not isinstance(source,str) or not source.strip():
        raise InvalidArchive("Missing ENEX content")
    try:
        byte_size = len(source.encode("utf-8"))
    except UnicodeEncodeError as exc:
        raise InvalidArchive("Invalid ENEX Unicode content") from exc
    if byte_size > MAX_BYTES:
        raise InvalidArchive("ENEX exceeds 8 MiB import limit")
    if "<!ENTITY" in source.upper():
        raise InvalidArchive("ENEX XML entities are not allowed")
    without_doctype=DOCTYPE.sub("",source,count=1)
    if "<!DOCTYPE" in without_doctype.upper():
        raise InvalidArchive("Unexpected ENEX DOCTYPE")
    try:
        root=ET.fromstring(without_doctype)
    except ET.ParseError as exc:
        raise InvalidArchive("ENEX is not valid XML") from exc
    if root.tag!="en-export":
        raise InvalidArchive("Expected ENEX en-export root")
    elements=root.findall("note")
    if not 1<=len(elements)<=2000:
        raise InvalidArchive("ENEX must contain 1 to 2000 notes")
    notebook_id=str(uuid4())
    stamp=now()
    items=[]
    resource_count=0
    for element in elements:
        resources=element.findall("resource")
        resource_count+=len(resources)
        content=element.findtext("content") or ""
        if "<en-media" in content.lower():
            resource_count+=1
        title=(element.findtext("title") or "").strip()
        if not 1<=len(title)<=200:
            raise InvalidArchive("Invalid Evernote title")
        parser=EnmlToText()
        try:
            parser.feed(content)
            parser.close()
        except (ValueError,AssertionError) as exc:
            raise InvalidArchive("Invalid ENML content") from exc
        body=parser.body()
        if len(body)>1_000_000:
            raise InvalidArchive("Converted Markdown exceeds note size limit")
        tags=[t.text.strip() for t in element.findall("tag") if t.text and t.text.strip()]
        if len(tags)>20 or any(len(t)>64 for t in tags):
            raise InvalidArchive("Unsupported ENEX tag count or length")
        created=iso(element.findtext("created"),stamp)
        updated=iso(element.findtext("updated"),created)
        items.append({"id":str(uuid4()),"notebook_id":notebook_id,
                      "parent_id":None,"title":title,"body":body,
                      "tags":tags,"pinned":False,"version":1,
                      "created_at":created,"updated_at":updated,"deleted_at":None})
    if resource_count and not skip_resources:
        raise InvalidArchive(
            "ENEX contains attachments/embedded media. "
            "Import requires explicit skip_resources=true (attachments will be omitted)."
        )
    warnings=[
        "ENEX conversion preserves basic text, dates and tags, not rich formatting.",
        "Evernote hierarchy, reminders, annotations and other metadata are not migrated."
    ]
    if resource_count:
        warnings.append(
            f"Attachment/resource entries detected ({resource_count}); media is omitted by request.")
    archive={"format":"goreecloud-notebook-v2",
             "notebooks":[{"id":notebook_id,"name":"Evernote Import",
                           "created_at":stamp}],
             "notes":items,"revisions":[]}
    return archive,warnings
