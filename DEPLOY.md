# DataScope V4 — Cloudflare D1

## What was fixed
- One import control in the header.
- The large landing panel is a drag/drop target, not another file picker.
- CSV + XLSX + XLS are parsed in the browser.
- No JavaScript alert boxes for normal upload errors.
- Upload flow: select file -> preview -> Replace current dataset.
- Previous datasets remain in D1 history.
- New dataset automatically becomes current after publishing.
- Dashboard reads the current dataset from D1.
- Three graphs only.
- Dynamic schema; no fixed Cyera field names.

## Excel parser
The UI uses the official SheetJS standalone browser build 0.20.3 from the SheetJS CDN. For a strict offline/air-gapped deployment, vendor `xlsx.full.min.js` into `public/` and change the script tag to `/xlsx.full.min.js`.

## Deploy
1. Commit and push this directory.
2. Cloudflare Workers Builds:
   - deploy command: `npx wrangler deploy`
   - root directory: repository root containing `wrangler.toml`
3. Initialize D1 once:
   `npx wrangler d1 execute datascope --remote --file=./schema.sql`
4. Redeploy.

The Worker name intentionally matches the connected Cloudflare Worker name `external-domain-trust-dashboard`, removing the previous CI name mismatch warning.

## D1 model
D1 stores dataset metadata, dynamic column definitions, and each row as JSON. The original binary Excel/CSV file is not stored in D1.


## Existing D1 database
If dataset_rows was created by an older version and lacks row_number, run migrate_existing_d1.sql once. If the database contains only test data, recreating it from schema.sql is simpler.
