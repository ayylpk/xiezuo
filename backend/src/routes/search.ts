import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import { searchAll } from "../services/search";

const router = new Hono<AppEnv>();
router.use("*", auth());

// 全局检索：GET /api/search?q=关键词&workId=可选（只看某一本）
router.get("/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ error: "缺少搜索词" }, 400);
  if (q.length > 100) return c.json({ error: "搜索词过长" }, 400);

  const workIdRaw = c.req.query("workId");
  let workId: number | undefined;
  if (workIdRaw) {
    const parsed = z.coerce.number().int().positive().safeParse(workIdRaw);
    if (!parsed.success) return c.json({ error: "workId 不合法" }, 400);
    workId = parsed.data;
  }

  return c.json({ hits: await searchAll(c.get("db"), q, workId) });
});

export default router;