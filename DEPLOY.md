# DataScope Cloudflare D1 Deployment

## 1. Create D1
```bash
npx wrangler d1 create datascope
```

Copy the returned `database_id` into `wrangler.toml`.

## 2. Initialize schema
```bash
npx wrangler d1 execute datascope --file=./schema.sql --remote
```

## 3. Put the frontend in public/
Copy `index.html` to `public/index.html`.

## 4. Deploy
```bash
npx wrangler deploy
```

## 5. Dataset lifecycle
The intended production flow is:
Upload -> validate -> normalize -> insert new dataset -> mark it current.
The previous dataset remains in D1 as history.

## Important D1 design
The original Excel/CSV binary is NOT stored in D1. D1 stores:
- dataset metadata
- column definitions
- each row as JSON

This is what allows arbitrary schemas without changing SQL columns.

For large datasets, use batched inserts and consider a Worker ingestion job/queue. D1 is a database, not an object store.

## Excel
The Worker endpoint is prepared for multipart uploads but the included Worker intentionally does not embed a third-party XLSX parser. For a fully self-contained Excel production build, vendor a Worker-compatible XLSX parser in `src/` and implement `parseSpreadsheet()` before enabling `.xlsx` ingestion.

The browser/static preview currently supports CSV directly.
