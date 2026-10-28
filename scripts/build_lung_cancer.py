#!/usr/bin/env python3
"""Rebuild the non-commercial GBD 2023 ages-50–79 lung cancer results.

Usage: python3 scripts/build_lung_cancer.py --input /path/to/IHME-export.csv
       python3 scripts/build_lung_cancer.py --input /path/to/IHME-export.csv --check

The source export is intentionally NOT committed or redistributed. Uses only stdlib.
GBD location ID -> ISO3 was verified against country metadata and the project's
existing ISO-3166-1 alpha-3 country records; no runtime fuzzy matching.
"""
import argparse
import csv
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "lung-cancer-data.js"
MAP_DATA = ROOT / "data" / "map-data.js"
ID_MAP = dict((int(k), v) for k, v in (item.split(":") for item in """6:CHN,7:PRK,8:TWN,10:KHM,11:IDN,12:LAO,13:MYS,14:MDV,15:MMR,16:PHL,17:LKA,18:THA,19:TLS,20:VNM,22:FJI,23:KIR,24:MHL,25:FSM,26:PNG,27:WSM,28:SLB,29:TON,30:VUT,33:ARM,34:AZE,35:GEO,36:KAZ,37:KGZ,38:MNG,39:TJK,40:TKM,41:UZB,43:ALB,44:BIH,45:BGR,46:HRV,47:CZE,48:HUN,49:MKD,50:MNE,51:POL,52:ROU,53:SRB,54:SVK,55:SVN,57:BLR,58:EST,59:LVA,60:LTU,61:MDA,62:RUS,63:UKR,66:BRN,67:JPN,68:KOR,69:SGP,71:AUS,72:NZL,74:AND,75:AUT,76:BEL,77:CYP,78:DNK,79:FIN,80:FRA,81:DEU,82:GRC,83:ISL,84:IRL,85:ISR,86:ITA,87:LUX,88:MLT,89:NLD,90:NOR,91:PRT,92:ESP,93:SWE,94:CHE,95:GBR,97:ARG,98:CHL,99:URY,101:CAN,102:USA,105:ATG,106:BHS,107:BRB,108:BLZ,109:CUB,110:DMA,111:DOM,112:GRD,113:GUY,114:HTI,115:JAM,116:LCA,117:VCT,118:SUR,119:TTO,121:BOL,122:ECU,123:PER,125:COL,126:CRI,127:SLV,128:GTM,129:HND,130:MEX,131:NIC,132:PAN,133:VEN,135:BRA,136:PRY,139:DZA,140:BHR,141:EGY,142:IRN,143:IRQ,144:JOR,145:KWT,146:LBN,147:LBY,148:MAR,149:PSE,150:OMN,151:QAT,152:SAU,153:SYR,154:TUN,155:TUR,156:ARE,157:YEM,160:AFG,161:BGD,162:BTN,163:IND,164:NPL,165:PAK,168:AGO,169:CAF,170:COG,171:COD,172:GNQ,173:GAB,175:BDI,176:COM,177:DJI,178:ERI,179:ETH,180:KEN,181:MDG,182:MWI,183:MUS,184:MOZ,185:RWA,186:SYC,187:SOM,189:TZA,190:UGA,191:ZMB,193:BWA,194:LSO,195:NAM,196:ZAF,197:SWZ,198:ZWE,200:BEN,201:BFA,202:CMR,203:CPV,204:TCD,205:CIV,206:GMB,207:GHA,208:GIN,209:GNB,210:LBR,211:MLI,212:MRT,213:NER,214:NGA,215:STP,216:SEN,217:SLE,218:TGO,298:ASM,305:BMU,320:COK,349:GRL,351:GUM,367:MCO,369:NRU,374:NIU,376:MNP,380:PLW,385:PRI,393:KNA,396:SMR,413:TKL,416:TUV,422:VIR,435:SSD,522:SDN""".split(",")))
AGES = {"50-54 years": 5000, "55-59 years": 4000, "60-64 years": 4000,
        "65-69 years": 3000, "70-74 years": 2000, "75-79 years": 1000}
SEXES = {"Both": "both", "Male": "male", "Female": "female"}
EXPECTED_COUNTS = {"both": (92, 56, 41, 15), "male": (63, 48, 42, 51),
                   "female": (144, 41, 15, 4)}
CHECK_VALUES = {"HUN": 182.8, "FRA": 172.6, "POL": 143.8, "CHN": 132.4,
                "BLR": 111.3, "JPN": 103.1, "RUS": 93.1, "IND": 31.1}
NOT_IN_STUDY = {"ASM", "BMU", "GRL", "GUM", "MNP", "PRI", "TKL", "TWN", "VIR"}
PREFIX = "const LUNG_DATA = "


def categories(values):
    return (sum(v < 50 for v in values), sum(50 <= v < 100 for v in values),
            sum(100 <= v < 150 for v in values), sum(v >= 150 for v in values))


def study_ids(map_path=MAP_DATA):
    raw = map_path.read_text(encoding="utf-8").strip()
    if not raw.startswith("const DATA = ") or not raw.endswith(";"):
        raise ValueError("Unexpected map-data.js format")
    data = json.loads(raw[len("const DATA = "):-1])
    ids = [entry["i"] for entry in data.values()]
    if len(ids) != 195 or len(set(ids)) != 195:
        raise ValueError("Medicine study must retain 195 distinct ISO3 countries")
    return set(ids)


def calculate(source):
    if len(ID_MAP) != 204 or len(set(ID_MAP.values())) != 204:
        raise ValueError("GBD ID/ISO3 mapping must contain exactly 204 unique entries")
    observations = {}
    location_names = {}
    with open(source, newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        required = {"location_id", "location_name", "sex_name", "age_name",
                    "measure_id", "cause_id", "metric_id", "year", "val"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Missing columns: " + ", ".join(sorted(required - set(reader.fieldnames or []))))
        for row in reader:
            ident = int(row["location_id"])
            age = row["age_name"]
            sex = row["sex_name"]
            if (ident not in ID_MAP or age not in AGES or sex not in SEXES or
                int(row["year"]) != 2023 or int(row["measure_id"]) != 6 or
                int(row["cause_id"]) != 426 or int(row["metric_id"]) != 3):
                raise ValueError("Unexpected GBD ID, age, sex, year, measure, cause or metric: " + str(row))
            rate = float(row["val"])
            if not math.isfinite(rate) or rate < 0:
                raise ValueError("Non-finite or negative incidence for GBD location " + str(ident))
            key = (ident, sex, age)
            if key in observations:
                raise ValueError("Duplicate observation " + repr(key))
            observations[key] = rate
            name = row["location_name"]
            if ident in location_names and location_names[ident] != name:
                raise ValueError("Conflicting name for GBD location " + str(ident))
            location_names[ident] = name
    if len(observations) != 204 * 3 * 6 or set(location_names) != set(ID_MAP):
        raise ValueError("Expected exactly 3,672 observations and 204 mapped GBD locations")
    result = {}
    for ident, iso in ID_MAP.items():
        result[iso] = {}
        for sex, sex_key in SEXES.items():
            result[iso][sex_key] = math.fsum(
                observations[(ident, sex, age)] * weight for age, weight in AGES.items()
            ) / 19000
    for sex, expected in EXPECTED_COUNTS.items():
        found = categories(entry[sex] for entry in result.values())
        if found != expected:
            raise ValueError("Unexpected 204-location " + sex + " distribution: " + str(found))
    for iso, expected in CHECK_VALUES.items():
        if abs(result[iso]["both"] - expected) > 0.051:
            raise ValueError("Reference value mismatch for " + iso)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Original IHME CSV, not stored in the repository")
    parser.add_argument("--check", action="store_true", help="Validate existing JS values without rewriting")
    args = parser.parse_args()
    full = calculate(args.input)
    study = study_ids()
    missing = study - full.keys()
    outside = full.keys() - study
    if missing or outside != NOT_IN_STUDY:
        raise ValueError(f"Geographic mismatch. Missing: {sorted(missing)}; GBD outside study: {sorted(outside)}")
    countries = {iso: full[iso] for iso in sorted(study)}
    data = {"year": 2023, "age": "50-79", "unit": "new cases per 100,000 per year",
            "countries": countries}
    if args.check:
        text = OUTPUT.read_text(encoding="utf-8").strip()
        if not text.startswith(PREFIX) and not text.startswith("/*"):
            raise ValueError("Unexpected JS data format")
        json_text = text[text.index(PREFIX) + len(PREFIX):].rstrip(";")
        stored = json.loads(json_text)
        if set(stored["countries"]) != study or stored["year"] != 2023:
            raise ValueError("Stored data metadata or coverage mismatch")
        for iso in study:
            for sex in SEXES.values():
                if abs(stored["countries"][iso][sex] - countries[iso][sex]) > 1e-10:
                    raise ValueError(f"Stored rate differs: {iso}/{sex}")
    else:
        banner = "/* GBD 2023 age-standardized lung cancer incidence, ages 50–79. IHME source; non-commercial use. */\n"
        OUTPUT.write_text(banner + PREFIX + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + ";\n", encoding="utf-8")
    print("PASS: 3,672 observations, 204 locations, 195 matched countries, 9 excluded GBD locations")
    print("Excluded GBD ISO3: " + ", ".join(sorted(outside)))
    for sex in SEXES.values():
        print(sex, categories(entry[sex] for entry in full.values()))


if __name__ == "__main__":
    main()
