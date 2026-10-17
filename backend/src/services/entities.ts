import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import * as schema from "../db/schema";
import { NotFoundError } from "./works";

export type EntityType = keyof typeof schema.ENTITY_TYPES;

export type EntityPatch = {
  name?: string;
  type?: EntityType;
  content?: string;
  extra?: Record<string, string> | null;
};

export async function listEntities(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  type?: EntityType,
) {
  await assertWork(db, workId);
  return db
    .select()
    .from(schema.entities)
    .where(and(eq(schema.entities.workId, workId), type ? eq(schema.entities.type, type) : undefined))
    .orderBy(schema.entities.sort, schema.entities.createdAt);
}

export async function createEntity(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  input: { name: string; type: EntityType; content?: string; extra?: Record<string, string> | null },
) {
  await assertWork(db, workId);
  const [{ maxSort }] = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(${schema.entities.sort}), 0)` })
    .from(schema.entities)
    .where(eq(schema.entities.workId, workId));

  const now = Date.now();
  const [row] = await db
    .insert(schema.entities)
    .values({
      workId,
      name: input.name,
      type: input.type,
      content: input.content ?? "",
      extra: input.extra ?? null,
      sort: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function updateEntity(
  db: BunSQLiteDatabase<typeof schema>,
  id: number,
  patch: EntityPatch,
) {
  const exists = await db.query.entities.findFirst({ where: eq(schema.entities.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("条目不存在");
  const [row] = await db
    .update(schema.entities)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(schema.entities.id, id))
    .returning();
  return row;
}

export async function deleteEntity(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.entities.findFirst({ where: eq(schema.entities.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("条目不存在");
  // 关系由外键 ON DELETE CASCADE 一并清除
  await db.delete(schema.entities).where(eq(schema.entities.id, id));
}

// ---------- 关系网 ----------

/** 关系列表：join 出 from/to 的名称（同一张表用两次，必须别名），前端直接渲染 */
export async function listRelations(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  await assertWork(db, workId);
  const fromEnt = alias(schema.entities, "from_ent");
  const toEnt = alias(schema.entities, "to_ent");
  return db
    .select({
      id: schema.relations.id,
      workId: schema.relations.workId,
      fromId: schema.relations.fromId,
      toId: schema.relations.toId,
      relType: schema.relations.relType,
      note: schema.relations.note,
      fromName: fromEnt.name,
      toName: toEnt.name,
    })
    .from(schema.relations)
    .innerJoin(fromEnt, eq(schema.relations.fromId, fromEnt.id))
    .innerJoin(toEnt, eq(schema.relations.toId, toEnt.id))
    .where(eq(schema.relations.workId, workId))
    .orderBy(schema.relations.id);
}

/** 建关系：校验两端实体存在且属于同一作品（防止跨作品连边） */
export async function createRelation(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  input: { fromId: number; toId: number; relType: string; note?: string },
) {
  await assertWork(db, workId);
  const [from, to] = await Promise.all([
    db.query.entities.findFirst({ where: eq(schema.entities.id, input.fromId), columns: { workId: true } }),
    db.query.entities.findFirst({ where: eq(schema.entities.id, input.toId), columns: { workId: true } }),
  ]);
  if (!from || !to) throw new NotFoundError("关联的实体不存在");
  if (from.workId !== workId || to.workId !== workId) throw new Error("实体不属于该作品");
  if (input.fromId === input.toId) throw new Error("不能和自己建立关系");

  const [row] = await db
    .insert(schema.relations)
    .values({ workId, fromId: input.fromId, toId: input.toId, relType: input.relType, note: input.note ?? "", createdAt: Date.now() })
    .returning();
  return row;
}

export async function updateRelation(
  db: BunSQLiteDatabase<typeof schema>,
  id: number,
  patch: { relType?: string; note?: string },
) {
  const exists = await db.query.relations.findFirst({ where: eq(schema.relations.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("关系不存在");
  const [row] = await db.update(schema.relations).set(patch).where(eq(schema.relations.id, id)).returning();
  return row;
}

export async function deleteRelation(db: BunSQLiteDatabase<typeof schema>, id: number) {
  const exists = await db.query.relations.findFirst({ where: eq(schema.relations.id, id), columns: { id: true } });
  if (!exists) throw new NotFoundError("关系不存在");
  await db.delete(schema.relations).where(eq(schema.relations.id, id));
}

async function assertWork(db: BunSQLiteDatabase<typeof schema>, workId: number) {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId), columns: { id: true } });
  if (!work) throw new NotFoundError("作品不存在");
}