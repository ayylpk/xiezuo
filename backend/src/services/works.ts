import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { and, count, desc, eq, inArray, or, sum } from "drizzle-orm";

import * as schema from "../db/schema";

export class NotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "NotFoundError";
  }
}

export type WorkInput = {
  title?: string;
  description?: string;
  status?: schema.WorkStatus;
};

/** 列表：附带章节数/总字数统计（左连聚合，无章节也返回一行） */
export async function listWorks(db: BunSQLiteDatabase<typeof schema>) {
  const rows = await db
    .select({
      id: schema.works.id,
      title: schema.works.title,
      description: schema.works.description,
      status: schema.works.status,
      createdAt: schema.works.createdAt,
      updatedAt: schema.works.updatedAt,
      chapterCount: count(schema.chapters.id),
      totalWords: sum(schema.chapters.wordCount),
    })
    .from(schema.works)
    .leftJoin(schema.chapters, eq(schema.chapters.workId, schema.works.id))
    .groupBy(schema.works.id)
    .orderBy(desc(schema.works.updatedAt));
  return rows.map((r) => ({ ...r, totalWords: r.totalWords ?? 0 }));
}

export async function getWork(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const row = await db.query.works.findFirst({
    where: eq(schema.works.id, id),
    with: { chapters: { columns: { id: true, title: true, status: true, wordCount: true, sortNo: true } } },
  });
  if (!row) throw new NotFoundError("作品不存在");
  return {
    ...row,
    chapterCount: row.chapters.length,
    totalWords: row.chapters.reduce((n, ch) => n + ch.wordCount, 0),
  };
}

export async function createWork(db: BunSQLiteDatabase<typeof schema>, input: WorkInput & { title: string }) {
  const now = Date.now();
  const [row] = await db
    .insert(schema.works)
    .values({
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "ongoing",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function updateWork(
  db: BunSQLiteDatabase<typeof schema>,
  id: number,
  input: Partial<schema.Work> & { title?: string; description?: string; status?: schema.WorkStatus },
) {
  const exists = await db.query.works.findFirst({ where: eq(schema.works.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("作品不存在");

  const patch = { ...input, updatedAt: Date.now() };
  const [row] = await db.update(schema.works).set(patch).where(eq(schema.works.id, id)).returning();
  return row;
}

export async function deleteWork(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.works.findFirst({ where: eq(schema.works.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("作品不存在");

  // 章节/设定/大纲/伏笔/时间线/随笔由外键 ON DELETE CASCADE 一并清除；
  // 但批注是多态挂载、没有外键，级联管不到，删作品前得先把它们捞出来清掉。
  const groups: [schema.AnnotationTarget, number[]][] = await collectOwnedIds(db, id);
  const conds = groups
    .filter(([, ids]) => ids.length > 0)
    .map(([type, ids]) => and(eq(schema.annotations.entityType, type), inArray(schema.annotations.entityId, ids)));
  if (conds.length > 0) await db.delete(schema.annotations).where(or(...conds));

  await db.delete(schema.works).where(eq(schema.works.id, id));
}

/** 本作品下六类可挂批注的实体 id 集合（删作品时用来清批注） */
async function collectOwnedIds(db: BunSQLiteDatabase<typeof schema>, workId: number): Promise<[schema.AnnotationTarget, number[]][]> {
  const [chs, ents, outs, fs, tl, nts] = await Promise.all([
    db.select({ id: schema.chapters.id }).from(schema.chapters).where(eq(schema.chapters.workId, workId)),
    db.select({ id: schema.entities.id }).from(schema.entities).where(eq(schema.entities.workId, workId)),
    db.select({ id: schema.outlines.id }).from(schema.outlines).where(eq(schema.outlines.workId, workId)),
    db.select({ id: schema.foreshadows.id }).from(schema.foreshadows).where(eq(schema.foreshadows.workId, workId)),
    db.select({ id: schema.timeline.id }).from(schema.timeline).where(eq(schema.timeline.workId, workId)),
    db.select({ id: schema.notes.id }).from(schema.notes).where(eq(schema.notes.workId, workId)),
  ]);
  const ids = (rows: { id: number }[]) => rows.map((r) => r.id);
  return [
    ["chapter", ids(chs)],
    ["entity", ids(ents)],
    ["outline", ids(outs)],
    ["foreshadow", ids(fs)],
    ["timeline", ids(tl)],
    ["note", ids(nts)],
  ];
}