"""Check workbook -> CSV -> map consistency; --write refreshes derived site data.

Uses Python's standard library. Never modifies the source workbook or geography.
"""
import argparse
import csv
import json
from pathlib import Path
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
DRUGS = ["NRT", "Varenicline", "Cytisine", "Bupropion"]
STATUS = {"AVAILABLE": "A", "UNAVAILABLE": "U", "UNCERTAIN": "X"}


def workbook_tables(path):
    with ZipFile(path) as z:
        strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            strings = ["".join(n.itertext()) for n in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        rels = {r.attrib["Id"]: r.attrib["Target"] for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        sheets = ET.fromstring(z.read("xl/workbook.xml")).find("s:sheets", NS)
        tables = {}
        for sheet in sheets:
            if sheet.attrib["name"] not in ("By country", "WHO detail"):
                continue
            rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = rels[rid]
            target = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
            rows = []
            for row in ET.fromstring(z.read(target)).findall("s:sheetData/s:row", NS):
                values = {}
                for cell in row:
                    column = re.match(r"[A-Z]+", cell.attrib["r"])[0]
                    number = 0
                    for letter in column:
                        number = number * 26 + ord(letter) - 64
                    if cell.find("s:f", NS) is not None:
                        raise ValueError(f"{sheet.attrib['name']}!{cell.attrib['r']}: formulas are not supported in source tables; provide reviewed values")
                    v = cell.find("s:v", NS)
                    value = v.text if v is not None else ""
                    if cell.attrib.get("t") == "s":
                        value = strings[int(value)]
                    elif cell.attrib.get("t") == "inlineStr":
                        inline = cell.find("s:is", NS)
                        value = "".join(inline.itertext()) if inline is not None else ""
                    values[number - 1] = value or ""
                if values:
                    rows.append(values)
            width = max(rows[0]) + 1
            header = [rows[0].get(i, "") for i in range(width)]
            records = [dict(zip(header, [r.get(i, "") for i in range(width)])) for r in rows[1:] if r.get(0)]
            tables[sheet.attrib["name"]] = (header, records)
        return tables


def keyed(rows, label):
    result = {r["ISO3"]: r for r in rows}
    if len(result) != len(rows):
        raise ValueError(f"Duplicate country ISO3 in {label}")
    return result


def check(write=False):
    tables = workbook_tables(ROOT / "data/smoking_cessation_COUNTRY_FINAL_EN.xlsx")
    retail = keyed(tables["By country"][1], "By country")
    who = keyed(tables["WHO detail"][1], "WHO detail")
    source = (ROOT / "data/map-data.js").read_text()
    data = json.loads(re.fullmatch(r"const DATA = (\{[\s\S]*\});\s*", source)[1])
    if len(retail) != 195 or len(data) != 195 or set(retail) != set(who) or set(retail) != {d["i"] for d in data.values()}:
        raise ValueError("Country coverage differs between workbook and map; review geography mapping explicitly")
    expected = {}
    for id_, d in data.items():
        r, w = retail[d["i"]], who[d["i"]]
        if r["Country"] != w["Country"]:
            raise ValueError(f"Country name mismatch: {d['i']}")
        statuses = "".join(STATUS[r[drug + " retail"]] for drug in DRUGS)
        full = statuses[0] == "A" and statuses[3] == "A" and "A" in statuses[1:3]
        for name, condition in [("At least one", "A" in statuses), ("Full set", full), ("All UNCERTAIN", statuses == "XXXX")]:
            if r[name] != ("YES" if condition else "NO"):
                raise ValueError(f"{d['i']}: inconsistent workbook field {name}")
        for drug in DRUGS:
            if r[drug + " WHO"] != w[drug + " WHO sold"]:
                raise ValueError(f"{d['i']}: inconsistent WHO sold field for {drug}")
        expected[id_] = dict(d, n=r["Country"], r=statuses,
            s=[w[drug + " WHO sold"] or None for drug in DRUGS],
            d=[w[drug + " dispensing"] or None for drug in DRUGS],
            m=[w[drug + " reimbursement"] or None for drug in DRUGS],
            e=w["NRT in WHO essential medicines list"] or None)
    changes = []
    for name, file in [("By country", "by_country.csv"), ("WHO detail", "who_detail.csv")]:
        headers, rows = tables[name]
        path = ROOT / "data" / file
        with path.open(newline="") as f:
            reader = csv.DictReader(f)
            current = list(reader)
            same = reader.fieldnames == headers and keyed(current, file) == keyed(rows, name)
        if not same:
            changes.append(file)
            if write:
                with path.open("w", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=headers, lineterminator="\n")
                    writer.writeheader()
                    writer.writerows(rows)
    if expected != data:
        changes.extend(f"map-data.js: {d['i']}" for k, d in expected.items() if d != data[k])
        if write:
            (ROOT / "data/map-data.js").write_text("const DATA = " + json.dumps(expected, ensure_ascii=False, separators=(",", ":")) + ";\n")
    if changes and not write:
        raise ValueError("Out of sync with source workbook: " + ", ".join(changes))
    print("PASS: 195 countries; workbook, CSVs, map fields and derived availability flags agree." if not changes else "Updated: " + ", ".join(changes))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Refresh CSVs/map fields from the reviewed workbook, preserving geography")
    args = parser.parse_args()
    try:
        check(args.write)
    except (ValueError, KeyError) as error:
        print("FAIL:", error, file=sys.stderr)
        sys.exit(1)
