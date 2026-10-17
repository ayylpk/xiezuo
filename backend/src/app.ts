import type { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Hono } from "hono";

import * as schema from "./db/schema";
import { migrate } from "./db/migrate";
import authRoutes from "./routes/auth";
import worksRoutes from "./routes/works";

/**
 * App 环境类型：所有路由/中间件可 c.get() 的类型安全来源。
 * user 由 auth 中间件在登录态时注入。
 */
export type AppEnv = {
  Variables: {
    db: BunSQLiteDatabase<typeof schema>;
    user?: UserPayload;
  };
};

export type UserPayload = { id: number };

/**
 * 应用工厂：依赖注入 SQLite 连接（测试用内存库、生产用文件库）。
 * 面试可讲：middleware/handler 不触碰全局单例，一切可测性来自这层注入。
 */
export function createApp(sqlite: Database = new Database(":memory:")) {
  const db = drizzle(sqlite, { schema });
  migrate(sqlite);

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  // 路由前缀统一 /api
  app.route("/api/auth", authRoutes);
  app.route("/api/works", worksRoutes);

  app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));
  return app;
}