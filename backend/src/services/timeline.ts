import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq, sql } from "drizzle-orm";

import * as schema from "../db/schema";
import { NotFoundError } from "./works";

export async function listTimeline(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");
  return db.select().from(schema.timeline).where(eq(schema.timeline.workId, workId)).orderBy(schema.timeline.sortNo, schema.timeline.id);
}

export async function createTimeline(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  input: { storyTime: string; event: string; chapterId?: number | null },
) {
  await assertWork(db, workId);
  if (input.chapterId != null) await assertChapter(db, workId, input.chapterId);

  const [{ maxSort }] = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(${schema.timeline.sortNo}), 0)` })
    .from(schema.timeline)
    .where(eq(schema.timeline.workId, workId));

  const now = Date.now();
  const [row] = await db
    .insert(schema.timeline)
    .values({
      workId,
      storyTime: input.storyTime,
      event: input.event,
      chapterId: input.chapterId ?? null,
      sortNo: (maxSort ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function updateTimeline(
  db: BunSQLiteDatabase<typeof schema>,
  id: number,
  input: { storyTime?: string; event?: string; chapterId?: number | null },
) {
  const exists = await db.query.timeline.findFirst({ where: eq(schema.timeline.id, id), columns: { id: true, workId: true } });
  if (!exists) throw new NotFoundError("事件不存在");
  if (input.chapterId !== undefined && input.chapterId != null) await assertChapter(db, exists.workId, input.chapterId);

  const set: Partial<schema.Timeline> = { updatedAt: Date.now() };
  if (input.storyTime !== undefined) set.storyTime = input.storyTime;
  if (input.event !== undefined) set.event = input.event;
  if (input.chapterId !== undefined) set.chapterId = input.chapterId;

  const [row] = await db.update(schema.timeline).set(set).where(eq(schema.timeline.id, id)).returning();
  return row;
}

export async function deleteTimeline(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.timeline.findFirst({ where: eq(schema.timeline.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("事件不存在");
  await db.delete(schema.timeline).where(eq(schema.timeline.id, id));
}

async function assertWork(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");
}

async function assertChapter(db: BunSQLiteDatabase<typeof schema>, workId: number, chapterId: number) {
  const ch = await db.query.chapters.findFirst({ where: eq(schema.chapters.id, chapterId), columns: { workId: true } });
  if (!ch) throw new NotFoundError("章节不存在");
  if (ch.workId !== workId) throw new Error("章节不属于该作品");
}