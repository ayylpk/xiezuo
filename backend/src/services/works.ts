import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { count, desc, eq, sum } from "drizzle-orm";

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
  // 章节由外键 ON DELETE CASCADE 一并清除
  await db.delete(schema.works).where(eq(schema.works.id, id));
}