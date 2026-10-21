import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Hono } from "hono";

import * as schema from "./db/schema";
import { migrate } from "./db/migrate";
import authRoutes from "./routes/auth";
import worksRoutes from "./routes/works";
import chaptersRoutes from "./routes/chapters";
import entitiesRoutes from "./routes/entities";
import outlinesRoutes from "./routes/outlines";
import planningRoutes from "./routes/planning";
import annotationsRoutes from "./routes/annotations";
import notesRoutes from "./routes/notes";
import searchRoutes from "./routes/search";
import exportRoutes from "./routes/export";

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

  // 健康检查必须排在所有子路由之前：下面各 router 内部 use("*", auth()) 会先命中 /api/*，
  // 注册在后面就会被鉴权拦成 401（部署探针会一直红）。
  app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));

  // 路由前缀统一 /api
  app.route("/api/auth", authRoutes);
  app.route("/api/works", worksRoutes);
  app.route("/api", chaptersRoutes);
  app.route("/api", entitiesRoutes);
  app.route("/api", outlinesRoutes);
  app.route("/api", planningRoutes);
  app.route("/api", annotationsRoutes);
  app.route("/api", notesRoutes);
  app.route("/api", searchRoutes);
  app.route("/api", exportRoutes);

  return app;
}