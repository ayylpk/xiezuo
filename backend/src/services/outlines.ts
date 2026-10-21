import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import * as schema from "../db/schema";
import { purgeAnnotations } from "./annotations";
import { NotFoundError } from "./works";

/** 全量扁平列表（前端按 parentId 组树），排序：sortNo 稳定序 */
export async function listOutlines(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");
  return db.select().from(schema.outlines).where(eq(schema.outlines.workId, workId)).orderBy(schema.outlines.sortNo, schema.outlines.id);
}

/** 新建节点：parentId 必须是本作品的节点（防跨作品挂树）；同级 sortNo 自动 +1 */
export async function createOutline(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  input: { parentId?: number | null; title: string; content?: string },
) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");

  const parentId = input.parentId ?? null;
  if (parentId !== null) {
    const parent = await db.query.outlines.findFirst({ where: eq(schema.outlines.id, parentId), columns: { workId: true } });
    if (!parent) throw new NotFoundError("父节点不存在");
    if (parent.workId !== workId) throw new Error("父节点不属于该作品");
  }

  const [{ maxSort }] = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(${schema.outlines.sortNo}), 0)` })
    .from(schema.outlines)
    .where(and(eq(schema.outlines.workId, workId), parentId === null ? isNull(schema.outlines.parentId) : eq(schema.outlines.parentId, parentId)));

  const now = Date.now();
  const [row] = await db
    .insert(schema.outlines)
    .values({ workId, parentId, title: input.title, content: input.content ?? "", sortNo: (maxSort ?? 0) + 1, createdAt: now, updatedAt: now })
    .returning();
  return row;
}

export async function updateOutline(
  db: BunSQLiteDatabase<typeof schema>,
  id: number,
  input: { title?: string; content?: string },
) {
  const exists = await db.query.outlines.findFirst({ where: eq(schema.outlines.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("大纲节点不存在");
  const [row] = await db
    .update(schema.outlines)
    .set({ ...input, updatedAt: Date.now() })
    .where(eq(schema.outlines.id, id))
    .returning();
  return row;
}

/** 删除节点：收集整个子树一起删（卷没了，章和细纲不留孤儿） */
export async function deleteOutline(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.outlines.findFirst({ where: eq(schema.outlines.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("大纲节点不存在");

  const ids = new Set<number>([id]);
  let frontier = [id];
  while (frontier.length > 0) {
    const children = await db
      .select({ id: schema.outlines.id })
      .from(schema.outlines)
      .where(inArray(schema.outlines.parentId, frontier));
    frontier = children.map((c) => c.id).filter((cid) => !ids.has(cid));
    frontier.forEach((cid) => ids.add(cid));
  }
  const all = [...ids];
  await db.delete(schema.outlines).where(inArray(schema.outlines.id, all));
  await purgeAnnotations(db, "outline", all); // 整棵子树的批注一起清，不留孤儿
}