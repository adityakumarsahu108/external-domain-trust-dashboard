CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dataset_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  data_type TEXT NOT NULL,
  FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dataset_rows (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  row_json TEXT NOT NULL,
  FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_datasets_current ON datasets(is_current);
CREATE INDEX IF NOT EXISTS idx_columns_dataset ON dataset_columns(dataset_id);
CREATE INDEX IF NOT EXISTS idx_rows_dataset ON dataset_rows(dataset_id);
