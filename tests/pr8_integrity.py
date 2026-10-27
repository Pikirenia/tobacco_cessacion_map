"""PR8 release gate: compare integrated sources to production without editing data.

Run after fetching origin/main. Every discrepancy is a stop-for-review event.
"""
import csv
import io
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TRACKED = (
    "data/by_country.csv",
    "data/who_detail.csv",
    "data/map-data.js",
    "data/tb-data.js",
    "data/world-topology.js",
    "data/smoking_cessation_COUNTRY_FINAL_EN.xlsx",
    "DATA_LICENSE.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
)
DRUGS = ("NRT", "Varenicline", "Cytisine", "Bupropion")
CODES = {"AVAILABLE": "A", "UNAVAILABLE": "U", "UNCERTAIN": "X"}


def main():
    altered = []
    for path in TRACKED:
        baseline = subprocess.check_output(["git", "show", "origin/main:" + path], cwd=ROOT)
        candidate = (ROOT / path).read_bytes()
        if candidate != baseline:
            altered.append(path)
    if altered:
        raise AssertionError("Scientific or licensing files differ from main; explicit scientific review required: " + ", ".join(altered))

    rows = list(csv.DictReader(io.StringIO((ROOT / "data/by_country.csv").read_text())))
    assert len(rows) == 195, "Expected exactly 195 source countries"
    by_iso = {row["ISO3"]: row for row in rows}
    assert len(by_iso) == len(rows), "Duplicate ISO3"
    assert all(re.fullmatch(r"[A-Z]{3}", iso) for iso in by_iso), "Invalid ISO3"

    source = (ROOT / "data/map-data.js").read_text()
    match = re.fullmatch(r"const DATA = (\{[\s\S]*\});\s*", source)
    assert match, "Map data JavaScript must use the validated JSON representation"
    map_data = json.loads(match.group(1))
    assert len(map_data) == 195
    assert len({d["i"] for d in map_data.values()}) == 195
    assert {d["i"] for d in map_data.values()} == set(by_iso)

    counts = {"none": 0, "one": 0, "two_or_three_without_full": 0, "full": 0}
    confirmed = dict.fromkeys(DRUGS, 0)
    for d in map_data.values():
        row = by_iso[d["i"]]
        assert d["n"] == row["Country"], d["i"] + ": country name changed"
        code = "".join(CODES[row[drug + " retail"]] for drug in DRUGS)
        assert d["r"] == code, d["i"] + ": medicine status changed"
        for index, drug in enumerate(DRUGS):
            confirmed[drug] += code[index] == "A"
        full = code[0] == "A" and code[3] == "A" and ("A" in code[1:3])
        assert (row["Full set"] == "YES") == full
        n = code.count("A")
        group = "full" if full else ("none" if n == 0 else ("one" if n == 1 else "two_or_three_without_full"))
        counts[group] += 1
    assert sum(counts.values()) == 195

    tb_js = (ROOT / "data/tb-data.js").read_text()
    match = re.fullmatch(r"const TB_DATA = (\{[\s\S]*\});\s*", tb_js)
    assert match, "WHO data JavaScript must use the validated JSON representation"
    tb = json.loads(match.group(1))
    assert isinstance(tb["year"], int)
    assert tb["source"] == "WHO Global Tuberculosis Programme"
    assert set(tb["countries"]) <= set(by_iso)
    assert len(tb["countries"]) >= 120
    assert len(tb["source_urls"]) == 2
    assert all("generateCSV.asp" in url for url in tb["source_urls"])
    for iso, record in tb["countries"].items():
        for indicator in ("incidence", "smoking"):
            value = record[indicator]
            assert value is None or (type(value) in (int, float) and value >= 0), (iso, indicator)
    assert all(x in tb["countries"] for x in ("POL", "BLR"))

    output = {
        "result": "PASS", "baseline": "origin/main", "country_count": len(rows),
        "retail_categories": counts, "confirmed_available_by_medicine": confirmed,
        "tb_reference_year": tb["year"], "tb_countries": len(tb["countries"]),
        "tb_missing_incidence": sum(v["incidence"] is None for v in tb["countries"].values()),
        "tb_missing_smoking": sum(v["smoking"] is None for v in tb["countries"].values()),
        "unchanged_source_files": list(TRACKED),
    }
    out = ROOT / "pr8-artifacts"
    out.mkdir(exist_ok=True)
    (out / "scientific-integrity.json").write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
