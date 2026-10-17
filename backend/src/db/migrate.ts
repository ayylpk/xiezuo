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
`;

export function migrate(db: Database = getSqlite()) {
  db.exec(DDL);
}