# DataScope V4

Sophisticated Cloudflare Worker + D1 CSV/Excel analytics dashboard.

Upload one dataset, preview it, replace the current dataset, and retain previous versions in D1 history. The dashboard adapts to the fields actually present in the uploaded file.


## Existing D1 database
If dataset_rows was created by an older version and lacks row_number, run migrate_existing_d1.sql once. If the database contains only test data, recreating it from schema.sql is simpler.
