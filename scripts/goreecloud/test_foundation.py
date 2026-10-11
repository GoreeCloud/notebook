"""Fail-closed static checks for the initial derived-repository boundary.

These tests cannot establish that the application builds, migrates data, or
meets the current Stable Glaze acceptance contract.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class FoundationTests(unittest.TestCase):
    def test_agpl_source_and_provenance(self):
        license_text = (ROOT / "LICENSE").read_text(encoding="utf-8")
        self.assertIn("GNU AFFERO GENERAL PUBLIC LICENSE", license_text)
        upstream = (ROOT / "docs/UPSTREAM.md").read_text(encoding="utf-8")
        self.assertIn("TriliumNext/Trilium", upstream)
        self.assertIn("6246ce308109e90fe2e86fe8883d129e5f3e35a5", upstream)

    def test_required_docs(self):
        required = [
            "README.md", "docs/SPECIFICATIONS.md", "docs/FEATURES.md",
            "docs/IMPLEMENTED-FEATURES.md", "docs/PLANNED-FEATURES.md",
            "docs/CHANGELOGS.md", "docs/BRANDING.md",
            "docs/USER-MANUAL.md", "docs/PRIVACY.md",
            "docs/BENEFITS.md", "docs/COMPETITIVE-OBJECTIVES.md",
            "docs/NOTES.md", ".github/SECURITY.md",
            "goreecloud.platform.yaml",
        ]
        self.assertFalse([item for item in required if not (ROOT / item).is_file()])

    def test_glaze_adapter_loaded_through_theme_pipeline(self):
        source = (ROOT / "apps/client/src/index.ts").read_text(encoding="utf-8")
        self.assertIn('glaze-notebook.css', source)
        self.assertIn('dataset.goreecloudProduct = "notebook"', source)

    def test_glaze_adapter_accessibility(self):
        stylesheet = (ROOT / "apps/client/src/stylesheets/glaze-notebook.css").read_text(encoding="utf-8")
        for marker in (
            "--glaze-semantic-surface", "--glaze-semantic-accent",
            ":focus-visible", "prefers-reduced-motion",
            "prefers-reduced-transparency", "forced-colors: active",
        ):
            self.assertIn(marker, stylesheet)
        self.assertTrue(stylesheet.count("{") == stylesheet.count("}"))

    def test_upstream_workflows_not_activated(self):
        workflow_paths = {p.name for p in (ROOT / ".github/workflows").glob("*.yml")}
        workflow_paths |= {p.name for p in (ROOT / ".github/workflows").glob("*.yaml")}
        self.assertEqual({"notebook-ci.yml"}, workflow_paths)
        text = (ROOT / ".github/workflows/notebook-ci.yml").read_text(encoding="utf-8")
        self.assertIn("contents: read", text)
        self.assertNotIn("pull_request_target", text)
        self.assertNotIn("secrets.", text)

    def test_enex_review_connected_and_localized(self):
        source = (ROOT / "apps/client/src/widgets/dialogs/import/evernote.tsx").read_text(encoding="utf-8")
        translation = (ROOT / "apps/client/src/translations/en/translation.json").read_text(encoding="utf-8")
        workflow = (ROOT / ".github/workflows/notebook-ci.yml").read_text(encoding="utf-8")
        self.assertIn("inspectEvernoteSelection(files)", source)
        self.assertIn("canImportEvernote(files, results, backupConfirmed, inspecting)", source)
        self.assertIn("goreecloud_notebook.enex.backup_confirmation", source)
        self.assertIn('"backup_confirmation"', translation)
        self.assertIn("evernote_preflight.test.mjs", workflow)

    def test_no_false_release_claim(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("not", readme.lower())
        self.assertIn("Glaze", readme)
        self.assertIn("Development", readme)


if __name__ == "__main__":
    unittest.main()
