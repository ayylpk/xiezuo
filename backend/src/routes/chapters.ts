import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import {
  createChapter,
  deleteChapter,
  getChapter,
  listChapters,
  updateChapter,
} from "../services/chapters";
import { NotFoundError } from "../services/works";

const router = new Hono<AppEnv>();
router.use("*", auth());

// 参数白名单：状态机只放行合法态，正文长度上限 20 万字符防整库轰炸
const chapterInput = z.object({
  title: z.string().trim().min(1).max(128).optional(),
  synopsis: z.string().max(2000).optional(),
  content: z.string().max(200_000).optional(),
  status: z.enum(["draft", "written", "review", "final"]).optional(),
});

const idParam = z.coerce.number().int().positive();

router.get("/works/:workId/chapters", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  if (!workId.success) return c.json({ error: "id 不合法" }, 400);
  try {
    return c.json({ chapters: await listChapters(c.get("db"), workId.data) });
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.post("/works/:workId/chapters", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  const body = await c.req.json().catch(() => null);
  const parsed = chapterInput.safeParse(body);
  if (!workId.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ chapter: await createChapter(c.get("db"), workId.data, parsed.data) }, 201);
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.get("/chapters/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    return c.json({ chapter: await getChapter(c.get("db"), id.data) });
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.patch("/chapters/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = chapterInput.safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ chapter: await updateChapter(c.get("db"), id.data, parsed.data) });
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.delete("/chapters/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteChapter(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

export default router;