import { Hono, type Context } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from "../services/annotations";
import { NotFoundError } from "../services/works";

const router = new Hono<AppEnv>();
router.use("*", auth());

const idParam = z.coerce.number().int().positive();
const annotationSchema = z.object({
  entityType: z.enum(["chapter", "entity", "outline", "foreshadow", "timeline", "note"]),
  entityId: idParam,
  content: z.string().trim().min(1).max(4000),
});

async function notFound(c: Context<AppEnv>, e: unknown) {
  if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
  throw e;
}

// 取某实体上的全部批注
router.get("/annotations", async (c) => {
  const q = z
    .object({ entityType: z.enum(["chapter", "entity", "outline", "foreshadow", "timeline", "note"]), entityId: idParam })
    .safeParse({ entityType: c.req.query("entityType"), entityId: c.req.query("entityId") });
  if (!q.success) return c.json({ error: "参数不合法" }, 400);
  return c.json({ annotations: await listAnnotations(c.get("db"), q.data.entityType, q.data.entityId) });
});

router.post("/annotations", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = annotationSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ annotation: await createAnnotation(c.get("db"), parsed.data) }, 201);
  } catch (e) {
    return notFound(c, e);
  }
});

router.patch("/annotations/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ content: z.string().trim().min(1).max(4000) }).safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ annotation: await updateAnnotation(c.get("db"), id.data, parsed.data.content) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.delete("/annotations/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteAnnotation(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    return notFound(c, e);
  }
});

export default router;