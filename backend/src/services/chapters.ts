import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq, max } from "drizzle-orm";

import * as schema from "../db/schema";
import { NotFoundError } from "./works";

/**
 * 字数口径：去掉所有空白后的字符数（全角/半角、中文/英文/数字都算 1）。
 * 与项目公约一致：一切按字符口径。
 */
export function countWords(content: string): number {
  return content.replace(/\s/g, "").length;
}

export async function listChapters(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");

  // 轻量列表：不返回正文，只返回元数据
  return db
    .select({
      id: schema.chapters.id,
      workId: schema.chapters.workId,
      title: schema.chapters.title,
      synopsis: schema.chapters.synopsis,
      status: schema.chapters.status,
      wordCount: schema.chapters.wordCount,
      sortNo: schema.chapters.sortNo,
      updatedAt: schema.chapters.updatedAt,
    })
    .from(schema.chapters)
    .where(eq(schema.chapters.workId, workId))
    .orderBy(schema.chapters.sortNo, schema.chapters.id);
}

export async function getChapter(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const row = await db.query.chapters.findFirst({ where: eq(schema.chapters.id, id) });
  if (!row) throw new NotFoundError("章节不存在");
  return row;
}

/** 新建章节：sortNo 自动排到末尾（max+1），不破坏已有排序 */
export async function createChapter(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  input: { title?: string; synopsis?: string; content?: string; status?: schema.ChapterStatus },
) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");

  const [{ maxSort }] = await db
    .select({ maxSort: max(schema.chapters.sortNo) })
    .from(schema.chapters)
    .where(eq(schema.chapters.workId, workId));

  const now = Date.now();
  const content = input.content ?? "";
  const [row] = await db
    .insert(schema.chapters)
    .values({
      workId,
      title: input.title ?? `第 ${(maxSort ?? 0) + 1} 章`,
      synopsis: input.synopsis ?? "",
      content,
      status: input.status ?? "draft",
      wordCount: countWords(content),
      sortNo: (maxSort ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await touchWork(db, workId);
  return row;
}

export async function updateChapter(
  db: BunSQLiteDatabase<typeof schema>,
  id: number,
  input: { title?: string; synopsis?: string; content?: string; status?: schema.ChapterStatus },
) {
  const exists = await db.query.chapters.findFirst({ where: eq(schema.chapters.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("章节不存在");

  const patch: Partial<schema.Chapter> = { updatedAt: Date.now() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.synopsis !== undefined) patch.synopsis = input.synopsis;
  if (input.status !== undefined) patch.status = input.status;
  if (input.content !== undefined) {
    patch.content = input.content;
    patch.wordCount = countWords(input.content); // 服务端重算为准，前端传的计数一律不信
  }

  const [row] = await db.update(schema.chapters).set(patch).where(eq(schema.chapters.id, id)).returning();
  await touchWork(db, row.workId);
  return row;
}

export async function deleteChapter(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.chapters.findFirst({ where: eq(schema.chapters.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("章节不存在");
  await db.delete(schema.chapters).where(eq(schema.chapters.id, id));
}

/** 触碰作品 updatedAt：列表排序让"最近更新的作品"浮上来 */
async function touchWork(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  await db.update(schema.works).set({ updatedAt: Date.now() }).where(eq(schema.works.id, workId));
}