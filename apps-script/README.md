# Activate country feedback

The page is at https://pikirenia.github.io/tobacco_cessacion_map/feedback/.
The button is immediately below the main map page introduction, outside the map controls.
No responses change the map automatically. Review responses before updating the source workbooks and map data.

## Deployment

1. Open your existing private Google Sheet. Copy its ID from the URL between
   `/spreadsheets/d/` and the next slash. Do not make the Sheet public.
2. Open **Extensions > Apps Script**. Paste the contents of this directory's
   `Code.gs` into the editor, replacing only the default empty starter code.
   If the project already has scripts or a doPost function, use a separate Apps Script project instead.
3. Replace `SPREADSHEET_ID` in the editor with your Sheet ID.
   Leave `SHEET_NAME = "Country feedback"` or choose a new empty tab name.
   The script creates that tab and its headers, and refuses to overwrite incompatible headers.
   Leave SITE_ORIGIN and COUNTRY_DATA_URL as supplied for this site.
4. Save. Select **setup** and click **Run**. Authorize this script to access your
   spreadsheet. Check the new tab and headers. This step does not submit feedback.
5. **Deploy > New deployment > Select type > Web app**.
6. Set **Execute as: Me** and **Who has access: Anyone** (anonymous access,
   not “Anyone with a Google account”). Click **Deploy** and authorize if requested.
   If your Google Workspace administrator disallows anonymous web apps, stop and
   resolve that policy with the administrator; do not make the Sheet public as a workaround.
7. Copy the deployed URL ending in **/exec**, not the testing **/dev** URL.
8. Replace the placeholder `GOOGLE_APPS_SCRIPT_URL` in `feedback/config.js`
   in this repository with that URL. Commit to main and wait for GitHub Pages.
   The endpoint is public by design. No API key, token, Sheet ID or other credentials
   belong in the website config. Keep the real Sheet ID in Apps Script only.
9. Open the feedback page in a signed-out/incognito browser. Submit a clearly
   labelled test. Confirm one row in the Sheet, then confirm the thank-you display
   and return to the map after about five seconds. Check a phone as well.
   Remove only that test row manually after testing.
10. If editing the backend later, use **Deploy > Manage deployments > Edit >
    Version: New version > Deploy** so the existing /exec URL serves the new code.

## Transport and failure behaviour

Native form POST targets a hidden iframe. Apps Script saves the row and returns
HtmlService HTML that sends a postMessage to the exact site origin. The frontend
checks Google's script origin, a per-attempt cryptographic response token and the
message type. Google may nest its own sandbox iframe, so the outer frame's
contentWindow is not used as a source check. The token is never persisted to Sheets.
There is no cross-origin fetch, no no-cors response guessed to be successful,
and no success inferred from an iframe load.

Success occurs only after a positive acknowledgement. No acknowledgement within
45 seconds shows a retry option without clearing answers or redirecting. A late
valid success is accepted until another attempt starts. Unchanged retries retain
their submission ID and are deduplicated in the Sheet under a script lock.
Changing answers creates a new ID. No personal information is stored in browser storage.
The server creates submission_timestamp in UTC; it does not trust a client timestamp.
If the user's clock is badly wrong or a form has been open for over 24 hours,
timing validation may reject it; reload and complete the form again.

## Security and limitations

The honeypot, minimum three-second completion time, strict enum/field/length and
country validation, rejection of repeated fields, formula escaping and locking
are lightweight protection, not strong bot authentication. A determined bot can
forge timing and call any public endpoint. There is no CAPTCHA or user tracking.
Apps Script quotas still apply. Monitor submissions and quotas; add stronger
protection only if abuse makes it necessary.
The acknowledgement frame has no interactive or private content. ALLOWALL is
used solely for this cross-origin response. No respondent can read the private
Sheet via this backend. Do not add a public response-listing endpoint.
The optional source is stored as text, never fetched or interpreted.

Countries come from the exact shared `data/map-data.js` used by the map.
The backend parses that public file as JSON (never evaluates code), caching
country names for one hour. Keep the `const DATA = {...};` format.
When updating availability, keep this shared data file, repository CSVs and
source Excel workbooks synchronized. This feature does not modify any availability values.

## Checks

Run `node tests/feedback.test.cjs` from the repository root.
Manual acceptance: map filters (including Full set), zoom, search, tooltips;
map-to-form and return links; 320/375/640 px mobile layouts and desktop;
keyboard/focus, light/dark mode; every required group; unavailable -> applicable
reset; successful anonymous POST; rejected POST; network timeout and unchanged
retry without duplicate rows. Real Apps Script delivery cannot be tested until
the owner deploys the endpoint and configures the URL.

References:
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/html/restrictions
- https://developers.google.com/apps-script/reference/html/x-frame-options-mode
