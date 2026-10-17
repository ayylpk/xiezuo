import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { and, eq } from "drizzle-orm";

import * as schema from "../db/schema";
import { NotFoundError } from "./works";
import type { NoteType } from "../db/schema";

export async function listNotes(db: BunSQLiteDatabase<typeof schema>, workId: number, type?: NoteType) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");
  return db
    .select()
    .from(schema.notes)
    .where(and(eq(schema.notes.workId, workId), type ? eq(schema.notes.type, type) : undefined))
    .orderBy(schema.notes.updatedAt);
}

export async function createNote(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  input: { type: NoteType; title?: string; content: string },
) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");
  const now = Date.now();
  const [row] = await db
    .insert(schema.notes)
    .values({ workId, type: input.type, title: input.title ?? "", content: input.content, createdAt: now, updatedAt: now })
    .returning();
  return row;
}

export async function updateNote(
  db: BunSQLiteDatabase<typeof schema>,
  id: number,
  input: { type?: NoteType; title?: string; content?: string },
) {
  const exists = await db.query.notes.findFirst({ where: eq(schema.notes.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("随笔不存在");
  const [row] = await db.update(schema.notes).set({ ...input, updatedAt: Date.now() }).where(eq(schema.notes.id, id)).returning();
  return row;
}

export async function deleteNote(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.notes.findFirst({ where: eq(schema.notes.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("随笔不存在");
  await db.delete(schema.notes).where(eq(schema.notes.id, id));
}