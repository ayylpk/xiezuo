import { Hono } from "hono";

const app = new Hono();

// 健康检查：部署后 nginx 可用它探测后端存活
app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));

export default app;