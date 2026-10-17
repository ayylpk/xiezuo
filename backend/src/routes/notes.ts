import { Hono, type Context } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import { createNote, deleteNote, listNotes, updateNote } from "../services/notes";
import { NotFoundError } from "../services/works";

const router = new Hono<AppEnv>();
router.use("*", auth());

const idParam = z.coerce.number().int().positive();
const noteSchema = z.object({
  type: z.enum(["note", "idea", "graveyard"]),
  title: z.string().trim().max(128).optional(),
  content: z.string().trim().min(1).max(20_000),
});
const notePatch = noteSchema.partial();

async function notFound(c: Context<AppEnv>, e: unknown) {
  if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
  throw e;
}

router.get("/works/:workId/notes", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  if (!workId.success) return c.json({ error: "id 不合法" }, 400);
  const type = c.req.query("type");
  if (type && !["note", "idea", "graveyard"].includes(type)) return c.json({ error: "type 不合法" }, 400);
  try {
    return c.json({ notes: await listNotes(c.get("db"), workId.data, type as never) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.post("/works/:workId/notes", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  const body = await c.req.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);
  if (!workId.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ note: await createNote(c.get("db"), workId.data, parsed.data) }, 201);
  } catch (e) {
    return notFound(c, e);
  }
});

router.patch("/notes/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = notePatch.safeParse(body);
  if (!id.success || !parsed.success) return c.json({ error: "参数不合法" }, 400);
  try {
    return c.json({ note: await updateNote(c.get("db"), id.data, parsed.data) });
  } catch (e) {
    return notFound(c, e);
  }
});

router.delete("/notes/:id", async (c) => {
  const id = idParam.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "id 不合法" }, 400);
  try {
    await deleteNote(c.get("db"), id.data);
    return c.json({ ok: true });
  } catch (e) {
    return notFound(c, e);
  }
});

export default router;