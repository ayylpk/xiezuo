import { Hono, type Context } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import {
  createForeshadow,
  deleteForeshadow,
  listForeshadows,
  updateForeshadow,
} from "../services/foreshadows";
import { createTimeline, deleteTimeline, listTimeline, updateTimeline } from "../services/timeline";
import { NotFoundError } from "../services/works";

const router = new Hono<AppEnv>();
router.use("*", auth());

const idParam = z.coerce.number().int().positive();

const foreshadowSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  plantedChapterId: idParam.nullable().optional(),
  revealChapterId: idParam.nullable().optional(),
  status: z.enum(["open", "closed", "dropped"]).optional(),
});
const foreshadowPatch = foreshadowSchema.partial();

const timelineSchema = z.object({
  storyTime: z.string().trim().min(1).max(64),
  event: z.string().trim().min(1).max(4000),
  chapterId: idParam.nullable().optional(),
});

async function notFound(c: Context<AppEnv>, e: unknown) {
  if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
  if (e instanceof Error && (e.message.includes("不属于") || e.message.includes("和自己"))) {
    return c.json({ error: e.message }, 400);
  }
  throw e;
}

// ---------- 伏笔台账 ----------
router.get("/works/:workId/foreshadows", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  if (!workId.success) return c.json({ error: "id 不合法" }, 400);
  try {
    return c.json({ foreshadows: await listForeshadows(c.get("db"), workId.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.post("/works/:workId/foreshadows", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  const body = await c.req.json().catch(() => null);
  const parsed = foreshadowSchema.safeParse(body);
  if (!workId.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ foreshadow: await createForeshadow(c.get("db"), workId.data, parsed.data) }, 201);
  } catch (e) {
    return notFound(c, e);
  }
});

router.patch("/foreshadows/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = foreshadowPatch.safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ foreshadow: await updateForeshadow(c.get("db"), id.data, parsed.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.delete("/foreshadows/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteForeshadow(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    return notFound(c, e);
  }
});

// ---------- 时间线 ----------
router.get("/works/:workId/timeline", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  if (!workId.success) return c.json({ error: "id 不合法" }, 400);
  try {
    return c.json({ timeline: await listTimeline(c.get("db"), workId.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.post("/works/:workId/timeline", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  const body = await c.req.json().catch(() => null);
  const parsed = timelineSchema.safeParse(body);
  if (!workId.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ event: await createTimeline(c.get("db"), workId.data, parsed.data) }, 201);
  } catch (e) {
    return notFound(c, e);
  }
});

router.patch("/timeline/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = timelineSchema.partial().safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ event: await updateTimeline(c.get("db"), id.data, parsed.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.delete("/timeline/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteTimeline(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    return notFound(c, e);
  }
});

export default router;