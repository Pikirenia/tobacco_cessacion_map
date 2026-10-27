#!/usr/bin/env python3
"""Update or validate content-hash versions in static HTML asset references.

The version is the first 12 hex digits of the Git blob SHA-1 (content-addressed).
It is independent of commit metadata, so unchanged files retain their URLs.
No server or build framework is necessary; works on GitHub Pages.
"""
import argparse
import hashlib
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
REFERENCES = {
    "index.html": (
        "assets/site.css", "data/map-data.js", "data/tb-data.js",
        "data/world-topology.js", "assets/share-state.js", "assets/map.js",
    ),
    "feedback/index.html": (
        "../assets/site.css", "../data/map-data.js",
        "feedback.css", "config.js", "feedback.js",
    ),
}


def git_blob_version(content):
    header = f"blob {len(content)}\0".encode("ascii")
    return hashlib.sha1(header + content).hexdigest()[:12]


def update_html(html, html_path, root=ROOT):
    for rel in REFERENCES[html_path]:
        full = root / Path(html_path).parent / rel
        if not full.is_file():
            raise ValueError(f"Missing versioned asset: {full}")
        revision = git_blob_version(full.read_bytes())
        pattern = r'(?P<open>(?:src|href)=")' + re.escape(rel) + r'(?:\?v=[^"]*)?(?P<close>")'
        replacement = lambda m: m.group("open") + rel + "?v=" + revision + m.group("close")
        html, count = re.subn(pattern, replacement, html)
        if count != 1:
            raise ValueError(f"{html_path}: expected exactly one reference to {rel}, found {count}")
    return html


def run(root=ROOT, write=False):
    changed = []
    for name in REFERENCES:
        file = root / name
        old = file.read_text(encoding="utf-8")
        new = update_html(old, name, root)
        if old != new:
            changed.append(name)
            if write:
                file.write_text(new, encoding="utf-8")
    if changed and not write:
        raise ValueError("Stale asset cache versions in: " + ", ".join(changed) + "; run python3 scripts/version_assets.py --write")
    print(("Updated asset versions: " + ", ".join(changed)) if changed else "PASS: all static asset versions match file content.")
    return changed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Rewrite HTML references with current content hashes")
    args = parser.parse_args()
    try:
        run(write=args.write)
    except (ValueError, OSError) as error:
        print("FAIL:", error, file=sys.stderr)
        sys.exit(1)
