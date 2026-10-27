#!/usr/bin/env bash
set -euo pipefail
# Test-only dependencies, pinned independently of the site's production lockfile.
npm install --no-save --package-lock=false --ignore-scripts axe-core@4.10.3 d3@7.8.5 topojson-client@3.1.0
