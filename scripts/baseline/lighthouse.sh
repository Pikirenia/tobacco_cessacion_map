#!/usr/bin/env bash
set -euo pipefail
mkdir -p baseline-artifacts
export CHROME_PATH="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")"
URL_LOCAL='http://127.0.0.1:8766/tobacco_cessacion_map/'
URL_PROD='https://pikirenia.github.io/tobacco_cessacion_map/'
for site in local production; do
  if [ "$site" = local ]; then url="$URL_LOCAL"; else url="$URL_PROD"; fi
  for device in mobile desktop; do
    echo "Lighthouse lab: $site / $device"
    npx --yes --package=lighthouse@12.4.0 lighthouse "$url" \
      --quiet --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage' \
      --only-categories=performance,accessibility --output=json \
      --output-path="baseline-artifacts/lighthouse-$site-$device.json" \
      --form-factor="$device" || echo "Lighthouse unavailable: $site $device"
  done
done
node scripts/baseline/summarize.cjs
