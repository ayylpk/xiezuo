import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import { createOutline, deleteOutline, listOutlines, updateOutline } from "../services/outlines";
import { NotFoundError } from "../services/works";

const router = new Hono<AppEnv>();
router.use("*", auth());

const idParam = z.coerce.number().int().positive();

const outlineSchema = z.object({
  title: z.string().trim().min(1).max(128),
  content: z.string().max(20_000).optional(),
});
const createSchema = outlineSchema.extend({ parentId: idParam.nullable().optional() });

async function notFound(c: import("hono").Context<AppEnv>, e: unknown) {
  if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
  if (e instanceof Error && e.message.includes("父节点")) return c.json({ error: e.message }, 400);
  throw e;
}

router.get("/works/:workId/outlines", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  if (!workId.success) return c.json({ error: "id 不合法" }, 400);
  try {
    return c.json({ outlines: await listOutlines(c.get("db"), workId.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.post("/works/:workId/outlines", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!workId.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ outline: await createOutline(c.get("db"), workId.data, parsed.data) }, 201);
  } catch (e) {
    return notFound(c, e);
  }
});

router.patch("/outlines/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = outlineSchema.partial().safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ outline: await updateOutline(c.get("db"), id.data, parsed.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.delete("/outlines/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteOutline(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    return notFound(c, e);
  }
});

export default router;