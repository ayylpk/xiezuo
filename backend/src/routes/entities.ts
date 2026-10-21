import { Hono, type Context } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import {
  createEntity,
  createRelation,
  deleteEntity,
  deleteRelation,
  listEntities,
  listRelations,
  updateEntity,
  updateRelation,
} from "../services/entities";
import { NotFoundError } from "../services/works";

const router = new Hono<AppEnv>();
router.use("*", auth());

const idParam = z.coerce.number().int().positive();
const entitySchema = z.object({
  name: z.string().trim().min(1).max(64),
  type: z.enum(["character", "scene", "world", "idea"]),
  content: z.string().max(20_000).optional(),
  extra: z.record(z.string(), z.string()).nullable().optional(),
});
const entityPatch = entitySchema.partial();
const relationSchema = z.object({
  fromId: idParam,
  toId: idParam,
  relType: z.string().trim().min(1).max(32),
  note: z.string().max(1000).optional(),
});

async function notFound(c: Context<AppEnv>, e: unknown) {
  if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
  throw e;
}

// ---------- 设定条目 ----------
router.get("/works/:workId/entities", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  if (!workId.success) return c.json({ error: "id 不合法" }, 400);
  const type = c.req.query("type");
  if (type && !["character", "scene", "world", "idea"].includes(type)) {
    return c.json({ error: "type 不合法" }, 400);
  }
  try {
    return c.json({ entities: await listEntities(c.get("db"), workId.data, type as never) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.post("/works/:workId/entities", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  const body = await c.req.json().catch(() => null);
  const parsed = entitySchema.safeParse(body);
  if (!workId.success || !parsed.success) return c.json({ error: "参数不合法", detail: parsed?.error?.issues?.[0]?.message }, 400);
  try {
    return c.json({ entity: await createEntity(c.get("db"), workId.data, parsed.data) }, 201);
  } catch (e) {
    return notFound(c, e);
  }
});

router.patch("/entities/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = entityPatch.safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ entity: await updateEntity(c.get("db"), id.data, parsed.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.delete("/entities/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteEntity(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    return notFound(c, e);
  }
});

// ---------- 关系网 ----------
router.get("/works/:workId/relations", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  if (!workId.success) return c.json({ error: "id 不合法" }, 400);
  try {
    return c.json({ relations: await listRelations(c.get("db"), workId.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.post("/works/:workId/relations", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  const body = await c.req.json().catch(() => null);
  const parsed = relationSchema.safeParse(body);
  if (!workId.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ relation: await createRelation(c.get("db"), workId.data, parsed.data) }, 201);
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    // 括号不能省：少一层时 && 先结合，e 不是 Error 会直接抛 TypeError
    if (e instanceof Error && (e.message.includes("不属于") || e.message.includes("和自己"))) {
      return c.json({ error: e.message }, 400);
    }
    throw e;
  }
});

router.patch("/relations/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ relType: z.string().trim().min(1).max(32).optional(), note: z.string().max(1000).optional() }).safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ relation: await updateRelation(c.get("db"), id.data, parsed.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.delete("/relations/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteRelation(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    return notFound(c, e);
  }
});

export default router;