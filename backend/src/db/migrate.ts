import type { Database } from "bun:sqlite";

import { getSqlite } from "./db";

// 启动时的幂等建表：CREATE TABLE IF NOT EXISTS
// 新表加入时在此追加 SQL 即可，老库自动补齐，无需单独迁移工具
const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS works (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'ongoing',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id    INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  synopsis   TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'draft',
  word_count INTEGER NOT NULL DEFAULT 0,
  sort_no    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_works_updated ON works(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapters_work ON chapters(work_id, sort_no);

CREATE TABLE IF NOT EXISTS entities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id    INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'character',
  name       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  extra      TEXT,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_work ON entities(work_id, type);

CREATE TABLE IF NOT EXISTS relations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id    INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  from_id    INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  rel_type   TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outlines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id    INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  parent_id  INTEGER REFERENCES outlines(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  sort_no    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outlines_work ON outlines(work_id, parent_id, sort_no);

CREATE TABLE IF NOT EXISTS foreshadows (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id             INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  planted_chapter_id  INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  reveal_chapter_id   INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'open',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_foreshadows_work ON foreshadows(work_id);

CREATE TABLE IF NOT EXISTS timeline (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id    INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  story_time TEXT NOT NULL,
  event      TEXT NOT NULL,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  sort_no    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timeline_work ON timeline(work_id, sort_no);
`;

export function migrate(db: Database = getSqlite()) {
  db.exec(DDL);
}