import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import { createWork, deleteWork, getWork, listWorks, updateWork, NotFoundError } from "../services/works";
const router = new Hono<AppEnv>();
router.use("*", auth()); // 全部接口需登录

// zod 校验：参数白名单的"防注入"第一道防线
const workSchema = z.object({
  title: z.string().trim().min(1).max(128),
  description: z.string().max(2000).optional(),
  status: z.enum(["ongoing", "finished", "shelved"]).optional(),
});

const idParam = z.coerce.number().int().positive(); // path id 强转并校验

router.get("/", async (c) => {
  const works = await listWorks(c.get("db"));
  return c.json({ works });
});

router.get("/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    return c.json({ work: await getWork(c.get("db"), id.data) });
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = workSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "参数不合法", detail: parsed.error.issues[0]?.message }, 400);
  return c.json({ work: await createWork(c.get("db"), parsed.data) }, 201);
});

router.patch("/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = workSchema.partial().safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ work: await updateWork(c.get("db"), id.data, parsed.data) });
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

router.delete("/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteWork(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

export default router;