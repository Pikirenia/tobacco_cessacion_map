"""WHO synchronization reliability: isolated fixtures and mocked downloads only."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

script = Path(__file__).resolve().parents[1] / "scripts" / "update_who_tb.py"
spec = importlib.util.spec_from_file_location("update_who_tb_reliability", script)
tb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tb)


def inc(iso, value, y="2024"):
    return {"iso3": iso, "year": y, "e_inc_100k": value}


def smoke(iso, value, y="2024"):
    return {"iso3": iso, "year": y, "risk_factor": "smk",
            "sex": "a", "age_group": "15+", "unit": "num", "measure": "inc", "best": value}


class WHOValidation(unittest.TestCase):
    def setUp(self):
        self.old_min = tb.MIN_COUNTRIES
        tb.MIN_COUNTRIES = 2

    def tearDown(self):
        tb.MIN_COUNTRIES = self.old_min

    def test_missing_fields(self):
        with self.assertRaises(tb.ValidationError):
            tb.incidence_by_year([{"iso3": "POL", "year": "2024"}])
        with self.assertRaises(tb.ValidationError):
            tb.smoking_by_year([{"iso3": "POL", "year": "2024", "best": "20"}])

    def test_duplicate_countries_even_when_values_identical(self):
        with self.assertRaisesRegex(tb.ValidationError, "Duplicate"):
            tb.incidence_by_year([inc("POL", "10"), inc("POL", "10")])
        with self.assertRaisesRegex(tb.ValidationError, "Duplicate"):
            tb.smoking_by_year([smoke("POL", "5"), smoke("POL", "5")])

    def test_invalid_numeric_year_and_iso3(self):
        for bad in ("NaN", "Infinity", "-2", "not a number"):
            with self.subTest(value=bad):
                with self.assertRaises(tb.ValidationError):
                    tb.incidence_by_year([inc("POL", bad)])
        for bad in ("2035", "1900", "abc"):
            with self.subTest(year=bad):
                with self.assertRaises(tb.ValidationError):
                    tb.incidence_by_year([inc("POL", "12", bad)])
        with self.assertRaises(tb.ValidationError):
            tb.incidence_by_year([inc("PL2", "12")])

    def test_missing_distinct_from_zero_and_no_indicator_substitution(self):
        self.assertIsNone(tb.numerical(""))
        self.assertEqual(tb.numerical("0"), 0)
        with self.assertRaises(tb.ValidationError):
            tb.build([inc("POL", "0"), inc("BLR", "25")],
                     [smoke("POL", "0"), smoke("BLR", "")], {"POL", "BLR"})

    def test_incomplete_latest_year_uses_prior_complete_common_year(self):
        a = [inc("POL", "10"), inc("BLR", "20"),
             inc("POL", "11", "2023"), inc("BLR", "21", "2023")]
        b = [smoke("POL", "1"), smoke("BLR", ""),
             smoke("POL", "2", "2023"), smoke("BLR", "3", "2023")]
        result = tb.build(a, b, {"POL", "BLR", "USA"})
        self.assertEqual(result["year"], 2023)
        self.assertNotIn("USA", result["countries"])

    def test_zero_and_missing_in_same_selected_year(self):
        a = [inc("POL", "0"), inc("BLR", "21"), inc("USA", "15")]
        b = [smoke("POL", "0"), smoke("BLR", "8"), smoke("USA", "")]
        result = tb.build(a, b, {"POL", "BLR", "USA"})
        self.assertEqual(result["countries"]["POL"], {"incidence": 0, "smoking": 0})
        self.assertIsNone(result["countries"]["USA"]["smoking"])

    def test_retrospective_revision_is_flagged_not_invalidated(self):
        old = {"year": 2024, "countries": {"POL": {"incidence": 12, "smoking": 1000},
                                           "BLR": {"incidence": 25, "smoking": 500}}}
        new = {"year": 2024, "countries": {"POL": {"incidence": 95, "smoking": 1000},
                                           "BLR": {"incidence": 25, "smoking": 500}}}
        self.assertTrue(any("5x" in s for s in tb.compare_snapshot(new, old)))
        self.assertEqual(new["countries"]["POL"]["incidence"], 95)

    def test_coverage_loss_and_disappearance_are_review_events(self):
        old = {"year": 2024, "countries": {
            "POL": {"incidence": 30, "smoking": 200},
            "BLR": {"incidence": 20, "smoking": 100}}}
        new = {"year": 2024, "countries": {"POL": {"incidence": 30, "smoking": 200}}}
        message = " ".join(tb.compare_snapshot(new, old, 0.08))
        self.assertIn("BLR", message)
        self.assertIn("coverage", message)

    def test_new_year_requires_review_not_invalid_data(self):
        old = {"year": 2023, "countries": {"POL": {"incidence": 12, "smoking": 50}}}
        new = {"year": 2024, "countries": {"POL": {"incidence": 12, "smoking": 50}}}
        self.assertIn("advanced", " ".join(tb.compare_snapshot(new, old)))

    def test_request_retry_and_failure(self):
        with patch.object(tb.urllib.request, "urlopen", side_effect=urllib.error.URLError("offline")) as fetch:
            with self.assertRaisesRegex(tb.ValidationError, "after 3 attempts"):
                tb.download_csv("https://example.invalid/test.csv", sleeper=lambda _: None)
            self.assertEqual(fetch.call_count, 3)

    def test_malformed_csv_and_extra_columns(self):
        class Response:
            def __init__(self, value): self.value = value
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, limit): return self.value
        for payload in (b"", b"iso3,iso3,year\\nPOL,POL,2024",
                        b"iso3,year\\nPOL,2024,extra", b"<html>Error</html>"):
            with self.subTest(payload=payload):
                if not payload:
                    with self.assertRaises(tb.ValidationError):
                        tb.download_csv("https://example.invalid", opener=lambda *a, **k: Response(payload))
                elif payload.startswith(b"<html>"):
                    rows = tb.download_csv("https://example.invalid", opener=lambda *a, **k: Response(payload))
                    with self.assertRaises(tb.ValidationError):
                        tb.incidence_by_year(rows)
                else:
                    with self.assertRaises(tb.ValidationError):
                        tb.download_csv("https://example.invalid", opener=lambda *a, **k: Response(payload))

    def test_atomic_write_failed_replace_keeps_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / "tb-data.js"
            out.write_text("VALID", encoding="utf-8")
            with patch.object(tb.os, "replace", side_effect=OSError("I/O failure")):
                with self.assertRaises(OSError):
                    tb.atomic_write(out, "BAD")
            self.assertEqual(out.read_text(), "VALID")
            self.assertEqual(list(Path(folder).iterdir()), [out])


class WHOSynchronization(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.target = Path(self.tmp.name) / "tb-data.js"
        self.old_min = tb.MIN_COUNTRIES
        tb.MIN_COUNTRIES = 2
        self.addCleanup(setattr, tb, "MIN_COUNTRIES", self.old_min)
        self.data = {"year": 2024, "countries": {
            "BLR": {"incidence": 20, "smoking": 2},
            "POL": {"incidence": 10, "smoking": 1},
        }}
        self.target.write_text("const TB_DATA = " + json.dumps(self.data) + ";\n")
        patcher = patch.multiple(tb, OUT=self.target)
        patcher.start()
        self.addCleanup(patcher.stop)

    def inputs(self, change=False):
        a = [inc("POL", "80" if change else "10"), inc("BLR", "20")]
        b = [smoke("POL", "1"), smoke("BLR", "2")]
        return [a, b]

    def test_failed_sync_keeps_last_snapshot(self):
        before = self.target.read_bytes()
        with patch.object(tb, "load_map_iso3", return_value={"POL", "BLR"}), patch.object(
            tb, "download_csv", side_effect=tb.ValidationError("invalid WHO response")
        ):
            with self.assertRaises(tb.ValidationError):
                tb.synchronize()
        self.assertEqual(before, self.target.read_bytes())

    def test_review_required_preserves_file_then_approval_publishes(self):
        before = self.target.read_bytes()
        with patch.object(tb, "load_map_iso3", return_value={"POL", "BLR"}), patch.object(
            tb, "download_csv", side_effect=self.inputs(change=True)
        ):
            with self.assertRaises(tb.ReviewRequired):
                tb.synchronize()
        self.assertEqual(before, self.target.read_bytes())
        with patch.object(tb, "load_map_iso3", return_value={"POL", "BLR"}), patch.object(
            tb, "download_csv", side_effect=self.inputs(change=True)
        ):
            self.assertTrue(tb.synchronize(approve_review=True))
        self.assertEqual(tb.parse_snapshot(self.target.read_text())["countries"]["POL"]["incidence"], 80)

    def test_unchanged_and_dry_run_make_no_changes(self):
        before = self.target.read_bytes()
        with patch.object(tb, "load_map_iso3", return_value={"POL", "BLR"}), patch.object(
            tb, "download_csv", side_effect=self.inputs(change=False)
        ):
            self.assertFalse(tb.synchronize())
        self.assertEqual(before, self.target.read_bytes())
        with patch.object(tb, "load_map_iso3", return_value={"POL", "BLR"}), patch.object(
            tb, "download_csv", side_effect=self.inputs(change=True)
        ):
            with self.assertRaises(tb.ReviewRequired):
                tb.synchronize(dry_run=True)
        self.assertEqual(before, self.target.read_bytes())


if __name__ == "__main__":
    unittest.main()
