"""Unit tests for read-only ENEX safety preflight."""
from pathlib import Path
import tempfile
import unittest

from enex_preflight import EnexValidationError, inspect_enex


class EnexPreflightTests(unittest.TestCase):
    def check(self, data: bytes, limit: int = 4096) -> dict:
        with tempfile.TemporaryDirectory() as tempdir:
            path = Path(tempdir) / "export.enex"
            path.write_bytes(data)
            return inspect_enex(path, limit)

    def test_notes_attachments_and_possible_duplicates(self):
        data = b"""<?xml version="1.0" encoding="UTF-8"?>
        <en-export>
          <note><title>First</title><created>20260101T010101Z</created>
            <tag>ideas</tag><resource><mime>image/png</mime>
            <data encoding="base64">aGVsbG8=</data></resource></note>
          <note><title>First</title><created>20260101T010101Z</created>
            <content><![CDATA[<en-note>Safe &amp; private</en-note>]]></content>
          </note>
        </en-export>"""
        result = self.check(data)
        self.assertEqual(result["notes"], 2)
        self.assertEqual(result["resources"], 1)
        self.assertEqual(result["tag_instances"], 1)
        self.assertEqual(result["resource_mime_counts"], {"image/png": 1})
        self.assertEqual(result["possible_duplicate_title_date"], 1)
        self.assertEqual(result["mode"], "read-only-preflight")
        self.assertNotIn("First", str(result))

    def test_unrecognized_resource_mime_is_not_echoed(self):
        data = b"""<en-export><note>
          <resource><mime>IMAGE/PNG</mime></resource>
          <resource><mime>unrecognized/custom-label</mime></resource>
          <resource><mime>application/x-unlisted-custom</mime></resource>
          <resource><mime> </mime></resource>
        </note></en-export>"""
        result = self.check(data)
        self.assertEqual(result["resources"], 4)
        self.assertEqual(result["resource_mime_counts"], {
            "image/png": 1, "other/unknown": 2, "unspecified": 1,
        })
        self.assertNotIn("custom-label", str(result))
        self.assertNotIn("x-unlisted", str(result))

    def test_internal_entity_rejected(self):
        data = b'<!DOCTYPE en-export [<!ENTITY x "secret">]><en-export><note><title>&x;</title></note></en-export>'
        with self.assertRaises(EnexValidationError):
            self.check(data)

    def test_wrong_root_rejected(self):
        with self.assertRaises(EnexValidationError):
            self.check(b"<other><note/></other>")

    def test_truncated_input_rejected(self):
        with self.assertRaises(EnexValidationError):
            self.check(b"<en-export><note></en-export>")

    def test_oversized_input_rejected(self):
        with self.assertRaises(EnexValidationError):
            self.check(b"<en-export/>", limit=4)

    def test_empty_input_rejected(self):
        with self.assertRaises(EnexValidationError):
            self.check(b"")


if __name__ == "__main__":
    unittest.main()
