import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "./schema";

// 单例：懒加载 SQLite 连接。
// WAL 模式：单人写作场景写并发低，WAL 让读不被写阻塞，避免"写锁等待"卡顿。

let _sqlite: Database | null = null;

function createSqlite() {
  const raw = process.env.DB_PATH ?? "./data/xiezuo.db";
  const dir = raw.endsWith(".db") ? raw.slice(0, raw.lastIndexOf("/")) : raw;
  Bun.spawnSync(["mkdir", "-p", dir], { stdout: "ignore" });
  const file = raw.endsWith(".db") ? raw : `${raw}/xiezuo.db`;
  const sqlite = new Database(file, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  return sqlite;
}

/** 原始连接：多语句 DDL 用 exec（drizzle.run 只执行单语句） */
export function getSqlite() {
  if (!_sqlite) _sqlite = createSqlite();
  return _sqlite;
}

/** drizzle 实例：业务代码的类型安全查询 */
export function getDb() {
  return drizzle(getSqlite(), { schema });
}

/** 测试用：独立内存库，返回原始连接，用例自建 schema */
export function freshDbForTest() {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  return sqlite;
}