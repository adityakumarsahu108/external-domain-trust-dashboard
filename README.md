# External Domain Trust Assessment Dashboard

A static, client-side CSV dashboard designed to replace the Power BI view with a deployable web app.

## Features
- Import any CSV from the browser
- Flexible automatic column detection
- Manual column mapping when a new export uses different names
- Optional fields can be missing without breaking the dashboard
- Extra CSV columns are preserved and shown in domain details
- Supports comma, semicolon, tab and pipe-delimited files
- Search and filters
- KPI cards
- Top domains chart
- Scout vs External distribution
- Key insights
- Domain detail view with all uploaded fields
- Export filtered results back to CSV
- No backend, database, CDN, or external JavaScript dependency
- CSV contents are processed locally in the browser and are not sent to a server

## Run locally
Open `index.html` in a modern browser and choose a CSV.

## Deploy
Upload `index.html` to any static hosting provider, including Cloudflare Pages, GitHub Pages, Netlify, Vercel static hosting, or an internal web server.

For Cloudflare Pages, create a Pages project and deploy the folder containing `index.html`.

## Data model
The importer attempts to map these concepts:
- Domain (required)
- Identities Count
- Added By
- Trust Level
- Identity Status
- Scout Count
- External Count
- Total Identities

Column names can differ. If automatic matching is uncertain, the app presents a mapping screen before loading the dashboard.
