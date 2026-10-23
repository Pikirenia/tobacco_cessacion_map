"""Offline regression tests for the WHO tuberculosis CSV integration."""
import importlib.util
import unittest
from pathlib import Path

script = Path(__file__).resolve().parents[1] / "scripts" / "update_who_tb.py"
spec = importlib.util.spec_from_file_location("update_who_tb", script)
tb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tb)


class WhoTBTests(unittest.TestCase):
    def setUp(self):
        self.previous_min = tb.MIN_COUNTRIES
        tb.MIN_COUNTRIES = 2

    def tearDown(self):
        tb.MIN_COUNTRIES = self.previous_min

    def test_who_risk_factor_and_latest_common_year(self):
        inc = [
            {"iso3":"POL","year":"2024","e_inc_100k":"12.5"},
            {"iso3":"BLR","year":"2024","e_inc_100k":"27"},
            {"iso3":"POL","year":"2023","e_inc_100k":"13.0"},
            {"iso3":"BLR","year":"2023","e_inc_100k":"28"},
        ]
        def row(iso,risk,best,year="2024",sex="a",age="15+"):
            return {"iso3":iso,"year":year,"risk_factor":risk,"measure":"inc",
                    "unit":"num","sex":sex,"age":age,"best":best}
        risk = [
            row("POL","smoking","340.2"),
            row("BLR","smoking","680.9"),
            row("POL","diabetes","90000"),
            row("BLR","smoking","99000",sex="m"),
            row("POL","smoking","310","2023"),
            row("BLR","smoking","660","2023"),
        ]
        out = tb.build(inc,risk,{"POL","BLR","USA"})
        self.assertEqual(out["year"],2024)
        self.assertEqual(out["countries"]["POL"],{"incidence":12.5,"smoking":340})
        self.assertEqual(out["countries"]["BLR"],{"incidence":27.0,"smoking":681})
        self.assertNotIn("USA",out["countries"])

    def test_ambiguous_smoking_is_rejected(self):
        records = [{"iso3":"POL","year":"2024","risk_factor":"smoking","measure":"inc",
                    "unit":"num","sex":"a","age":"15+","best":n} for n in ("40","90")]
        with self.assertRaises(ValueError):
            tb.smoking_by_year(records)

    def test_bad_schema_and_no_complete_year_fail(self):
        with self.assertRaises(ValueError):
            tb.smoking_by_year([{"iso3":"POL"}])
        inc = [{"iso3":"POL","year":"2024","e_inc_100k":"12"}]
        risk = [{"iso3":"POL","year":"2024","risk_factor":"smoking","measure":"inc",
                 "unit":"num","sex":"a","age":"15+","best":"20"}]
        with self.assertRaises(ValueError):
            tb.build(inc,risk,{"POL","BLR"})

    def test_missing_values_never_become_zero(self):
        self.assertIsNone(tb.numerical(""))
        self.assertIsNone(tb.numerical("-2"))
        self.assertEqual(tb.numerical("0"),0)


if __name__ == "__main__":
    unittest.main()
