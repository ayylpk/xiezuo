import { drizzle } from "drizzle-orm/bun-sqlite";

import { createApp } from "./app";
import * as schema from "./db/schema";
import { getSqlite } from "./db/db";
import { ensureInitUser } from "./auth/init-user";

// 启动：文件库 + 建表 + 初始账号
const sqlite = getSqlite();
const app = createApp(sqlite);
await ensureInitUser(drizzle(sqlite, { schema }));

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};