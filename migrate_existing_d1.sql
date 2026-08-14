-- Run ONLY if your existing dataset_rows table does NOT have row_number.
ALTER TABLE dataset_rows ADD COLUMN row_number INTEGER;
UPDATE dataset_rows SET row_number = (SELECT COUNT(*) FROM dataset_rows r2 WHERE r2.dataset_id = dataset_rows.dataset_id AND r2.rowid <= dataset_rows.rowid);
CREATE UNIQUE INDEX IF NOT EXISTS uq_row_number ON dataset_rows(dataset_id, row_number);
CREATE INDEX IF NOT EXISTS idx_rows_dataset ON dataset_rows(dataset_id);
