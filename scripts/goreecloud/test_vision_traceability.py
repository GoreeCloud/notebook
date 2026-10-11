"""Validate planning traceability without claiming any product feature is shipped."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VISION = ROOT / "docs/COMPLETE-FEATURES-AND-CAPABILITIES.md"
MATRIX = ROOT / "docs/CAPABILITY-TRACEABILITY.md"
ROADMAP = ROOT / "docs/PLANNED-FEATURES.md"


class VisionTraceabilityTests(unittest.TestCase):
    def test_owner_vision_contains_all_20_ordered_domains(self):
        text = VISION.read_text(encoding="utf-8")
        numbers = [int(n) for n in re.findall(r"^## (\d+)\.", text, re.M)]
        self.assertEqual(list(range(1, 21)), numbers)
        self.assertIn("## GoreeCloud Notebook — Core Product Principles", text)
        self.assertIn("## Product Definition", text)

    def test_each_domain_has_one_roadmap_trace(self):
        text = MATRIX.read_text(encoding="utf-8")
        rows = [line for line in text.splitlines() if re.match(r"^\| \d{2} \|", line)]
        numbers = [int(line.split("|")[1].strip()) for line in rows]
        self.assertEqual(list(range(1, 21)), numbers)
        for row in rows:
            cells = [cell.strip() for cell in row.split("|")[1:-1]]
            self.assertEqual(4, len(cells))
            self.assertTrue(all(cells))
            self.assertIn("NB-", cells[2])

    def test_mapped_workstreams_exist_and_claim_boundaries_are_explicit(self):
        trace = MATRIX.read_text(encoding="utf-8")
        roadmap = ROADMAP.read_text(encoding="utf-8")
        valid = set(re.findall(r"\| (NB-\d{3}) \|", roadmap))
        selected = set(re.findall(r"NB-\d{3}", trace))
        self.assertTrue(selected <= valid, f"unknown workstreams: {selected - valid}")
        self.assertIn("not implemented functionality", trace)
        self.assertIn("Underlying TriliumNext source is not GoreeCloud consumer acceptance", trace)


if __name__ == "__main__":
    unittest.main()
