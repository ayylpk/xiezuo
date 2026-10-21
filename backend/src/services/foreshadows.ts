import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq, inArray } from "drizzle-orm";

import * as schema from "../db/schema";
import { purgeAnnotations } from "./annotations";
import { NotFoundError } from "./works";

export type ForeshadowPatch = {
  content?: string;
  plantedChapterId?: number | null;
  revealChapterId?: number | null;
  status?: keyof typeof schema.FORESHADOW_STATUS;
};

export async function listForeshadows(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  await assertWork(db, workId);
  return db.select().from(schema.foreshadows).where(eq(schema.foreshadows.workId, workId)).orderBy(schema.foreshadows.id);
}

/** 伏笔可关联埋设/回收章节；章节 id 必须真实存在且属于同一作品 */
export async function createForeshadow(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  input: { content: string; plantedChapterId?: number | null; revealChapterId?: number | null; status?: keyof typeof schema.FORESHADOW_STATUS },
) {
  await assertWork(db, workId);
  await assertChapters(db, workId, [input.plantedChapterId, input.revealChapterId]);

  const now = Date.now();
  const [row] = await db
    .insert(schema.foreshadows)
    .values({
      workId,
      content: input.content,
      plantedChapterId: input.plantedChapterId ?? null,
      revealChapterId: input.revealChapterId ?? null,
      status: input.status ?? "open",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function updateForeshadow(db: BunSQLiteDatabase<typeof schema>, id: number, patch: ForeshadowPatch) {
  const exists = await db.query.foreshadows.findFirst({ where: eq(schema.foreshadows.id, id), columns: { id: true, workId: true } });
  if (!exists) throw new NotFoundError("伏笔不存在");
  await assertChapters(db, exists.workId, [patch.plantedChapterId, patch.revealChapterId]);

  const set: Partial<schema.Foreshadow> = { updatedAt: Date.now() };
  if (patch.content !== undefined) set.content = patch.content;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.plantedChapterId !== undefined) set.plantedChapterId = patch.plantedChapterId;
  if (patch.revealChapterId !== undefined) set.revealChapterId = patch.revealChapterId;

  const [row] = await db.update(schema.foreshadows).set(set).where(eq(schema.foreshadows.id, id)).returning();
  return row;
}

export async function deleteForeshadow(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.foreshadows.findFirst({ where: eq(schema.foreshadows.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("伏笔不存在");
  await db.delete(schema.foreshadows).where(eq(schema.foreshadows.id, id));
  await purgeAnnotations(db, "foreshadow", id);
}

async function assertWork(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");
}

/** 关联章节校验：id 过滤空值后必须全部存在，且都归属本作品（防跨作品挂载） */
async function assertChapters(db: BunSQLiteDatabase<typeof schema>, workId: number, ids: (number | null | undefined)[]) {
  const real = [...new Set(ids.filter((id): id is number => id != null))];
  if (real.length === 0) return;
  const rows = await db
    .select({ id: schema.chapters.id, workId: schema.chapters.workId })
    .from(schema.chapters)
    .where(inArray(schema.chapters.id, real));
  const owner = new Map(rows.map((r) => [r.id, r.workId]));
  for (const id of real) {
    const ownerWorkId = owner.get(id);
    if (ownerWorkId === undefined) throw new NotFoundError(`章节不存在: ${id}`);
    if (ownerWorkId !== workId) throw new Error("章节不属于该作品");
  }
}