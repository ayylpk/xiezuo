import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { and, eq, inArray } from "drizzle-orm";

import * as schema from "../db/schema";
import { NotFoundError } from "./works";
import type { AnnotationTarget } from "../db/schema";

/** 目标存在性校验：按类型查对应表（白名单映射见 schema.ANNOTATION_TARGETS） */
async function assertTarget(db: BunSQLiteDatabase<typeof schema>, type: AnnotationTarget, id: number) {
  switch (type) {
    case "chapter":
      if (!(await db.query.chapters.findFirst({ where: eq(schema.chapters.id, id), columns: { id: true } }))) throw new NotFoundError("章节不存在");
      break;
    case "entity":
      if (!(await db.query.entities.findFirst({ where: eq(schema.entities.id, id), columns: { id: true } }))) throw new NotFoundError("条目不存在");
      break;
    case "outline":
      if (!(await db.query.outlines.findFirst({ where: eq(schema.outlines.id, id), columns: { id: true } }))) throw new NotFoundError("大纲节点不存在");
      break;
    case "foreshadow":
      if (!(await db.query.foreshadows.findFirst({ where: eq(schema.foreshadows.id, id), columns: { id: true } }))) throw new NotFoundError("伏笔不存在");
      break;
    case "timeline":
      if (!(await db.query.timeline.findFirst({ where: eq(schema.timeline.id, id), columns: { id: true } }))) throw new NotFoundError("事件不存在");
      break;
    case "note":
      if (!(await db.query.notes.findFirst({ where: eq(schema.notes.id, id), columns: { id: true } }))) throw new NotFoundError("随笔不存在");
      break;
  }
}

export async function listAnnotations(db: BunSQLiteDatabase<typeof schema>, type: AnnotationTarget, entityId: number) {
  return db
    .select()
    .from(schema.annotations)
    .where(and(eq(schema.annotations.entityType, type), eq(schema.annotations.entityId, entityId)))
    .orderBy(schema.annotations.createdAt);
}

export async function createAnnotation(
  db: BunSQLiteDatabase<typeof schema>,
  input: { entityType: AnnotationTarget; entityId: number; content: string },
) {
  await assertTarget(db, input.entityType, input.entityId);
  const now = Date.now();
  const [row] = await db
    .insert(schema.annotations)
    .values({ entityType: input.entityType, entityId: input.entityId, content: input.content, createdAt: now, updatedAt: now })
    .returning();
  return row;
}

export async function updateAnnotation(db: BunSQLiteDatabase<typeof schema>, id: number, content: string) {
  const exists = await db.query.annotations.findFirst({ where: eq(schema.annotations.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("批注不存在");
  const [row] = await db.update(schema.annotations).set({ content, updatedAt: Date.now() }).where(eq(schema.annotations.id, id)).returning();
  return row;
}

export async function deleteAnnotation(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.annotations.findFirst({ where: eq(schema.annotations.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("批注不存在");
  await db.delete(schema.annotations).where(eq(schema.annotations.id, id));
}

/**
 * 宿主被删除时清理其上的批注。
 * annotations 是"多态挂载"（entity_type + entity_id），没有外键可级联，
 * 所以每个 delete 都必须显式调用这里，否则批注成孤儿：查不到目标、却还在库里。
 */
export async function purgeAnnotations(
  db: BunSQLiteDatabase<typeof schema>,
  entityType: AnnotationTarget,
  entityIds: number | number[],
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  if (ids.length === 0) return;
  await db
    .delete(schema.annotations)
    .where(and(eq(schema.annotations.entityType, entityType), inArray(schema.annotations.entityId, ids)));
}