#!/usr/bin/env python3
"""Synchronize two WHO TB indicators for the static world map.

Sources: WHO Global Tuberculosis Programme's machine-generated CSV downloads.
No estimates are derived from smoking prevalence here: smoking-attributable
cases must be WHO's own best estimate, risk_factor=smoking, unit=num.
On download/schema/coverage failures, the existing snapshot is left untouched.
"""
import csv
import datetime as dt
import io
import json
import math
from pathlib import Path
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
COUNTRY_SOURCE = "https://extranet.who.int/tme/generateCSV.asp?ds=estimates"
RISK_SOURCE = "https://extranet.who.int/tme/generateCSV.asp?ds=estimates_age_sex"
OUT = ROOT / "data" / "tb-data.js"
MAP_SOURCE = ROOT / "data" / "map-data.js"
MIN_COUNTRIES = 120


def download_csv(url):
    request = urllib.request.Request(
        url, headers={"User-Agent": "Smoking-cessation-TB-map/1.0 (WHO TB CSV sync)", "Accept": "text/csv"}
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read(12_000_000)
    if not data or len(data) >= 12_000_000:
        raise ValueError("WHO download was empty or unexpectedly large")
    text = data.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("WHO response is not a CSV with headers")
    reader.fieldnames = [name.strip().lower().replace(".", "_") for name in reader.fieldnames]
    rows = list(reader)
    if not rows:
        raise ValueError("WHO returned an empty CSV")
    return rows


def numerical(raw):
    if raw is None or not str(raw).strip():
        return None
    try:
        number = float(str(raw).replace(",", "").strip())
    except ValueError:
        return None
    return number if math.isfinite(number) and number >= 0 else None


def year(raw):
    try:
        value = int(raw)
        if 2000 <= value <= dt.datetime.now(dt.timezone.utc).year:
            return value
    except (TypeError, ValueError):
        pass
    return None


def country_code(row):
    value = (row.get("iso3") or row.get("country_iso3") or "").strip().upper()
    return value if re.fullmatch(r"[A-Z]{3}", value) else None


def incidence_by_year(rows):
    required = {"iso3", "year", "e_inc_100k"}
    if not required.issubset(rows[0]):
        raise ValueError("WHO incidence CSV schema changed: missing " + str(required - rows[0].keys()))
    found = {}
    for row in rows:
        iso, y, rate = country_code(row), year(row.get("year")), numerical(row.get("e_inc_100k"))
        if iso and y and rate is not None:
            key = (y, iso)
            if key in found and found[key] != rate:
                raise ValueError("Conflicting WHO incidence estimates for " + str(key))
            found[key] = rate
    return found


def smoking_by_year(rows):
    headers = set(rows[0])
    risk_key = next((key for key in ("risk_factor", "riskfactor") if key in headers), None)
    estimate_key = next((key for key in ("best", "value") if key in headers), None)
    if not risk_key or not estimate_key or not ({"age_group", "age"} & headers) or not {"iso3", "year", "sex", "unit", "measure"}.issubset(headers):
        raise ValueError("WHO risk-factor CSV schema changed: " + ", ".join(sorted(headers)))
    found = {}
    for row in rows:
        rf = (row.get(risk_key) or "").strip().lower()
        if rf not in ("smoking", "tobacco smoking"):
            continue
        if (row.get("unit") or "").strip().lower() not in ("num", "number"):
            continue
        if (row.get("measure") or "").strip().lower() not in ("inc", "incidence"):
            continue
        if (row.get("sex") or "").strip().lower() not in ("a", "all", "both"):
            continue
        if (row.get("age_group") or row.get("age") or "").strip().lower() not in ("15+", "15plus", "15 plus"):
            continue
        iso, y, cases = country_code(row), year(row.get("year")), numerical(row.get(estimate_key))
        if iso and y and cases is not None:
            key = (y, iso)
            if key in found and abs(found[key] - cases) > 0.01:
                raise ValueError("Ambiguous smoking rows for " + str(key))
            found[key] = cases
    return found


def build(incidence_rows, smoking_rows, allowed_iso3):
    inc = incidence_by_year(incidence_rows)
    smoke = smoking_by_year(smoking_rows)
    common = {y for y, _ in inc} & {y for y, _ in smoke}
    for y in sorted(common, reverse=True):
        shared = set(iso for yr, iso in inc if yr == y) & set(iso for yr, iso in smoke if yr == y)
        shared &= set(allowed_iso3)
        if len(shared) < MIN_COUNTRIES:
            continue
        countries = {}
        for iso in sorted(allowed_iso3):
            # Missing values remain null; no carry-forward from previous years.
            rate = inc.get((y, iso))
            cases = smoke.get((y, iso))
            if rate is None and cases is None:
                continue
            countries[iso] = {
                "incidence": round(rate, 2) if rate is not None else None,
                "smoking": round(cases) if cases is not None else None,
            }
        return {"year": y, "countries": countries}
    from collections import Counter
    raise ValueError("No common WHO year with at least " + str(MIN_COUNTRIES)
                     + " matched countries; incidence by year="
                     + str(Counter(y for y, iso in inc if iso in allowed_iso3))
                     + "; smoking by year="
                     + str(Counter(y for y, iso in smoke if iso in allowed_iso3)))


def load_map_iso3():
    source = MAP_SOURCE.read_text(encoding="utf-8")
    match = re.fullmatch(r"const DATA = (\{[\s\S]*\});\s*", source)
    if not match:
        raise ValueError("Cannot parse existing map country codes")
    return {record["i"] for record in json.loads(match.group(1)).values()}


def main():
    allowed = load_map_iso3()
    incidence_rows = download_csv(COUNTRY_SOURCE)
    risk_rows = download_csv(RISK_SOURCE)
    print("WHO incidence input rows:", len(incidence_rows), "risk input rows:", len(risk_rows), flush=True)
    sample = [r for r in risk_rows if "smok" in str(r.get("risk_factor", "")).lower()][:4]
    from collections import Counter
    print("WHO risk_factor values:", Counter(r.get("risk_factor") for r in risk_rows).most_common(20), flush=True)
    print("WHO risk file sample:", risk_rows[:2], flush=True)
    print("WHO smoking rows, sample dimensions:",
          [{k: r.get(k) for k in ("year", "risk_factor", "age_group", "sex", "measure", "unit", "best")} for r in sample],
          flush=True)
    result = build(incidence_rows, risk_rows, allowed)
    result["updated"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    result["source"] = "WHO Global Tuberculosis Programme"
    result["source_urls"] = [COUNTRY_SOURCE, RISK_SOURCE]
    output = "const TB_DATA = " + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n"
    existing = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    # Only update the file when data changed; avoid weekly commits for timestamps alone.
    if existing:
        try:
            old = json.loads(re.fullmatch(r"const TB_DATA = (\{[\s\S]*\});\s*", existing).group(1))
            if old.get("year") == result["year"] and old.get("countries") == result["countries"]:
                print("WHO TB data unchanged: year", result["year"], ", countries", len(result["countries"]))
                return
        except (AttributeError, ValueError):
            pass
    OUT.write_text(output, encoding="utf-8")
    print("WHO TB updated: year", result["year"], ", countries", len(result["countries"]))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, TimeoutError, KeyError) as error:
        print("WHO TB synchronization failed; keeping existing snapshot:", error, file=sys.stderr)
        sys.exit(1)
