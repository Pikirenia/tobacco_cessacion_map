"""Content-addressed cache tests with isolated static-page fixtures."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

script = Path(__file__).resolve().parents[1] / "scripts" / "version_assets.py"
spec = importlib.util.spec_from_file_location("version_assets", script)
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for page, references in assets.REFERENCES.items():
            file = self.root / page
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("".join(f'<script src="{rel}"></script>\n' for rel in references))
            for rel in references:
                src = file.parent / rel
                src.parent.mkdir(parents=True, exist_ok=True)
                src.write_text("static resource: " + rel, encoding="utf-8")

    def test_cache_hash_changes_only_for_updated_content(self):
        assets.run(root=self.root, write=True)
        assets.run(root=self.root)
        original = (self.root / "index.html").read_text()
        path = self.root / "data" / "tb-data.js"
        path.write_text(path.read_text() + "updated snapshot", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Stale asset"):
            assets.run(root=self.root)
        assets.run(root=self.root, write=True)
        updated = (self.root / "index.html").read_text()
        self.assertNotEqual(original, updated)
        self.assertIn("data/map-data.js?v=" +
                      assets.git_blob_version((self.root / "data" / "map-data.js").read_bytes()), updated)
        self.assertIn("data/tb-data.js?v=" +
                      assets.git_blob_version(path.read_bytes()), updated)
        self.assertEqual(original.split("data/map-data.js?v=")[1][:12],
                         updated.split("data/map-data.js?v=")[1][:12])

    def test_missing_resource_or_html_reference_fails_closed(self):
        (self.root / "assets/map.js").unlink()
        with self.assertRaisesRegex(ValueError, "Missing versioned asset"):
            assets.run(root=self.root, write=True)
        (self.root / "assets/map.js").write_text("new")
        (self.root / "index.html").write_text("no asset tags")
        with self.assertRaisesRegex(ValueError, "expected exactly one"):
            assets.run(root=self.root, write=True)

    def test_duplicate_references_rejected(self):
        file = self.root / "index.html"
        content = file.read_text()
        file.write_text(content + '<script src="assets/map.js"></script>')
        with self.assertRaisesRegex(ValueError, "expected exactly one"):
            assets.run(root=self.root, write=True)


if __name__ == "__main__":
    unittest.main()
