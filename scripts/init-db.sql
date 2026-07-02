CREATE TABLE IF NOT EXISTS links (
  code    TEXT PRIMARY KEY,
  url     TEXT NOT NULL,
  visits  INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO links (code, url, visits) VALUES
  ('repo',  'https://github.com/co-eiv-devsecops/linker3', 0),
  ('curso', 'https://github.com/co-eiv-devsecops/material-curso', 0);
