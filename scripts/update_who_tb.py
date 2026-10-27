#!/usr/bin/env python3
"""Synchronize only WHO TB incidence and smoking-attributable incident TB cases.

WHO CSV data are authoritative. Failures and changes requiring human review do
not replace the last published snapshot. No epidemiological estimates are derived.
"""
import argparse
import csv
import datetime as dt
import io
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
COUNTRY_SOURCE = "https://extranet.who.int/tme/generateCSV.asp?ds=estimates"
RISK_SOURCE = "https://extranet.who.int/tme/generateCSV.asp?ds=estimates_age_sex"
OUT = ROOT / "data" / "tb-data.js"
MAP_SOURCE = ROOT / "data" / "map-data.js"
MIN_COUNTRIES = 120
MAX_DOWNLOAD = 12_000_000
MISSING = {"", "na", "n/a", "null", "."}
SNAPSHOT_RE = re.compile(r"const TB_DATA = (\{[\s\S]*\});\s*")


class ValidationError(ValueError):
    """Invalid download, schema, or snapshot: publishing is never safe."""


class ReviewRequired(ValueError):
    """Valid WHO update whose differences must be explicitly reviewed."""


def download_csv(url, attempts=3, opener=None, sleeper=time.sleep):
    """Retry transient fetch failures, but never treat an incomplete CSV as valid."""
    opener = opener or urllib.request.urlopen
    request = urllib.request.Request(url, headers={
        "User-Agent": "Smoking-cessation-TB-map/1.0 (WHO TB CSV sync)", "Accept": "text/csv"})
    for attempt in range(attempts):
        try:
            with opener(request, timeout=90) as response:
                data = response.read(MAX_DOWNLOAD + 1)
            if not data or len(data) > MAX_DOWNLOAD:
                raise ValidationError("WHO CSV download empty or exceeds size limit: " + url)
            text = data.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            if not reader.fieldnames:
                raise ValidationError("WHO response lacks CSV headers: " + url)
            names = [name.strip().lower().replace(".", "_") for name in reader.fieldnames]
            if len(set(names)) != len(names) or any(not name for name in names):
                raise ValidationError("Duplicate/empty WHO CSV headers: " + url)
            reader.fieldnames = names
            rows = list(reader)
            if not rows or any(None in row for row in rows):
                raise ValidationError("Empty or malformed WHO CSV rows: " + url)
            return rows
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            if attempt == attempts - 1:
                raise ValidationError(f"WHO source download failed after {attempts} attempts: {url}: {error}") from error
            sleeper(min(2 ** attempt, 4))
        except UnicodeError as error:
            raise ValidationError("WHO response is not valid UTF-8: " + url) from error


def numerical(raw):
    """Return None only for WHO missing markers, never for invalid real values."""
    if raw is None or str(raw).strip().lower() in MISSING:
        return None
    value = str(raw).strip().replace(",", "")
    try:
        number = float(value)
    except ValueError as error:
        raise ValidationError("Invalid WHO numeric value: " + repr(raw)) from error
    if not math.isfinite(number) or number < 0:
        raise ValidationError("Non-finite or negative WHO estimate: " + repr(raw))
    return number


def year(raw):
    try:
        number = int(str(raw).strip())
    except (TypeError, ValueError) as error:
        raise ValidationError("Invalid WHO reference year: " + repr(raw)) from error
    if not 2000 <= number <= dt.datetime.now(dt.timezone.utc).year:
        raise ValidationError("WHO year out of expected range: " + str(number))
    return number


def country_code(row):
    raw = (row.get("iso3") or row.get("country_iso3") or "").strip().upper()
    if not raw:
        return None  # WHO regional / aggregate records may lack ISO3.
    if not re.fullmatch("[A-Z]{3}", raw):
        raise ValidationError("Invalid WHO ISO3 code: " + repr(raw))
    return raw


def require_columns(rows, required, label):
    if not rows:
        raise ValidationError("Empty WHO " + label + " dataset")
    missing = set(required) - set(rows[0])
    if missing:
        raise ValidationError("WHO " + label + " schema missing: " + ", ".join(sorted(missing)))


def incidence_by_year(rows, allowed_iso3=None):
    require_columns(rows, {"iso3", "year", "e_inc_100k"}, "incidence")
    found = {}
    for row in rows:
        iso = country_code(row)
        if not iso or (allowed_iso3 is not None and iso not in allowed_iso3):
            continue
        y = year(row.get("year"))
        key = (y, iso)
        if key in found:
            raise ValidationError("Duplicate WHO incidence country/year: " + str(key))
        found[key] = numerical(row.get("e_inc_100k"))
    return {key: value for key, value in found.items() if value is not None}


def smoking_by_year(rows, allowed_iso3=None):
    if not rows:
        raise ValidationError("Empty WHO smoking dataset")
    headers = set(rows[0])
    risk_key = next((k for k in ("risk_factor", "riskfactor") if k in headers), None)
    estimate_key = next((k for k in ("best", "value") if k in headers), None)
    age_key = next((k for k in ("age_group", "age") if k in headers), None)
    if not all((risk_key, estimate_key, age_key)):
        raise ValidationError("WHO smoking CSV missing risk factor, age or estimate field")
    require_columns(rows, {"iso3", "year", "sex", "unit", "measure"}, "smoking")
    found = {}
    for row in rows:
        rf = (row.get(risk_key) or "").strip().lower()
        if rf not in ("smk", "smoking", "tobacco smoking"):
            continue
        if (row.get("unit") or "").strip().lower() not in ("num", "number"):
            continue
        if (row.get("measure") or "").strip().lower() not in ("inc", "incidence"):
            continue
        if (row.get("sex") or "").strip().lower() not in ("a", "all", "both"):
            continue
        if (row.get(age_key) or "").strip().lower() not in ("15+", "15plus", "15 plus"):
            continue
        iso = country_code(row)
        if not iso or (allowed_iso3 is not None and iso not in allowed_iso3):
            continue
        y = year(row.get("year"))
        key = (y, iso)
        if key in found:
            raise ValidationError("Duplicate WHO smoking country/year: " + str(key))
        found[key] = numerical(row.get(estimate_key))
    return {key: value for key, value in found.items() if value is not None}


def build(incidence_rows, smoking_rows, allowed_iso3):
    inc = incidence_by_year(incidence_rows, allowed_iso3)
    smoke = smoking_by_year(smoking_rows, allowed_iso3)
    common = {y for y, _ in inc} & {y for y, _ in smoke}
    for y in sorted(common, reverse=True):
        shared = {iso for yr, iso in inc if yr == y} & {iso for yr, iso in smoke if yr == y}
        if len(shared) < MIN_COUNTRIES:
            continue
        countries = {}
        for iso in sorted(allowed_iso3):
            rate, cases = inc.get((y, iso)), smoke.get((y, iso))
            if rate is not None or cases is not None:
                # Display precision retained from original integration: rate to 2
                # decimals, incident case count to nearest integer (Python ties-even).
                countries[iso] = {
                    "incidence": round(rate, 2) if rate is not None else None,
                    "smoking": round(cases) if cases is not None else None,
                }
        return {"year": y, "countries": countries}
    from collections import Counter
    raise ValidationError(
        "No common WHO reference year with at least " + str(MIN_COUNTRIES)
        + " paired countries. Incidence/year=" + str(Counter(y for y, iso in inc))
        + "; smoking/year=" + str(Counter(y for y, iso in smoke)))


def parse_snapshot(content):
    match = SNAPSHOT_RE.fullmatch(content)
    if not match:
        raise ValidationError("Existing published TB snapshot has invalid JavaScript format")
    try:
        snapshot = json.loads(match.group(1))
    except json.JSONDecodeError as error:
        raise ValidationError("Existing snapshot is not valid JSON") from error
    if not isinstance(snapshot, dict) or not isinstance(snapshot.get("year"), int) or not isinstance(snapshot.get("countries"), dict):
        raise ValidationError("Existing snapshot lacks year or countries")
    for iso, values in snapshot["countries"].items():
        if not re.fullmatch("[A-Z]{3}", iso) or not isinstance(values, dict) or not {"incidence", "smoking"} <= set(values):
            raise ValidationError("Existing snapshot has invalid country record: " + str(iso))
        for metric in ("incidence", "smoking"):
            value = values[metric]
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
                raise ValidationError("Existing snapshot has invalid estimate: " + iso + "/" + metric)
    return snapshot


def compare_snapshot(new, old, coverage_loss=0.08, factor=5):
    """Return human-review findings; revisions are never discarded as invalid."""
    if not 0 <= coverage_loss < 1:
        raise ValidationError("coverage-loss-threshold must be between 0 and 1")
    warnings = []
    if new["year"] < old["year"]:
        warnings.append(f"Reference year regressed: {old['year']} -> {new['year']}")
    elif new["year"] != old["year"]:
        warnings.append(f"Reference year advanced: {old['year']} -> {new['year']} (review reporting vintage)")
    old_c, new_c = old["countries"], new["countries"]
    disappeared = sorted(set(old_c) - set(new_c))
    if disappeared:
        warnings.append(f"{len(disappeared)} countries disappeared entirely: {', '.join(disappeared[:15])}")
    for metric in ("incidence", "smoking"):
        prev = {k for k, v in old_c.items() if v.get(metric) is not None}
        curr = {k for k, v in new_c.items() if v.get(metric) is not None}
        lost = sorted(prev - curr)
        if prev and len(lost) / len(prev) > coverage_loss:
            warnings.append(f"{metric} coverage fell {len(prev)} -> {len(curr)}, {len(lost)} former countries missing (>{coverage_loss:.0%} loss)")
        elif lost:
            warnings.append(f"{metric}: {len(lost)} previously covered countries missing: {', '.join(lost[:15])}")
        revisions = []
        for iso in sorted(prev & curr):
            before, after = old_c[iso][metric], new_c[iso][metric]
            # Ignore small denominator noise. Compare published rounded values.
            if before >= (10 if metric == "incidence" else 100) and (
                after > before * factor or after < before / factor):
                revisions.append(iso)
        if revisions:
            warnings.append(f"{metric}: >{factor}x change in {len(revisions)} countries: {', '.join(revisions[:15])}; possible retrospective WHO revision")
    return warnings


def load_map_iso3():
    source = MAP_SOURCE.read_text(encoding="utf-8")
    match = re.fullmatch(r"const DATA = (\{[\s\S]*\});\s*", source)
    if not match:
        raise ValidationError("Cannot parse map country codes")
    allowed = [record["i"] for record in json.loads(match.group(1)).values()]
    if len(allowed) != len(set(allowed)) or any(not re.fullmatch("[A-Z]{3}", v) for v in allowed):
        raise ValidationError("Map ISO3 reference contains duplicates or invalid codes")
    return set(allowed)


def atomic_write(path, content):
    """Write in the target directory and replace only after a complete flush."""
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix="." + path.name, delete=False) as handle:
            tmp = Path(handle.name)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        if tmp is not None and tmp.exists():
            tmp.unlink()


def synchronize(dry_run=False, approve_review=False, coverage_loss_threshold=0.08):
    allowed = load_map_iso3()
    inc_rows = download_csv(COUNTRY_SOURCE)
    smoke_rows = download_csv(RISK_SOURCE)
    print(f"WHO CSV input records: incidence={len(inc_rows)} smoking={len(smoke_rows)}", flush=True)
    result = build(inc_rows, smoke_rows, allowed)
    existing = parse_snapshot(OUT.read_text(encoding="utf-8")) if OUT.exists() else None
    if existing and existing["year"] == result["year"] and existing["countries"] == result["countries"]:
        print(f"WHO estimates unchanged ({result['year']}; {len(result['countries'])} countries)")
        return False
    findings = compare_snapshot(result, existing, coverage_loss_threshold) if existing else []
    if findings:
        for finding in findings:
            print("WHO HUMAN REVIEW: " + finding, file=sys.stderr)
        if not approve_review:
            raise ReviewRequired("Update requires explicit review. Re-run with --approve-review after checking WHO source and listed changes.")
    if dry_run:
        print(f"DRY RUN: verified WHO data for {result['year']}, {len(result['countries'])} countries. No files changed.")
        return True
    result.update({
        "updated": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": "WHO Global Tuberculosis Programme",
        "source_urls": [COUNTRY_SOURCE, RISK_SOURCE],
    })
    output = "const TB_DATA = " + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n"
    atomic_write(OUT, output)
    print(f"WHO TB snapshot verified and updated: {result['year']}; {len(result['countries'])} countries")
    return True


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Download, validate and compare; never write")
    parser.add_argument("--approve-review", action="store_true", help="Explicitly accept flagged WHO revisions after manual source review")
    parser.add_argument("--coverage-loss-threshold", type=float, default=0.08, help="Fraction of prior indicator coverage lost before major warning (default: 0.08)")
    args = parser.parse_args(argv)
    try:
        synchronize(args.dry_run, args.approve_review, args.coverage_loss_threshold)
    except ReviewRequired as error:
        print("WHO update held for review; published snapshot unchanged: " + str(error), file=sys.stderr)
        return 2
    except (ValueError, OSError, TimeoutError, KeyError, urllib.error.URLError) as error:
        print("WHO synchronization failed; published snapshot unchanged: " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
