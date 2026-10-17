import { randomBytes } from "node:crypto";

import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";

import * as schema from "../db/schema";

/** 会话有效期：7 天 */
export const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

class SessionError extends Error {}

/** 登录成功后新建会话，返回 sid（写进 cookie） */
export async function createSession(db: BunSQLiteDatabase<typeof schema>, userId: number) {
  const sid = randomBytes(32).toString("hex");
  const now = Date.now();
  await db.insert(schema.sessions).values({
    id: sid,
    userId,
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
  });
  return sid;
}

/** 校验 sid：存在且未过期；过期会话顺手删掉 */
export async function verifySession(db: BunSQLiteDatabase<typeof schema>, sid: string | undefined) {
  if (!sid || sid.length !== 64) return null;
  const row = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sid) });
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sid));
    return null;
  }
  return row;
}

/** 登出：吊销会话 */
export async function revokeSession(db: BunSQLiteDatabase<typeof schema>, sid: string | undefined) {
  if (sid) await db.delete(schema.sessions).where(eq(schema.sessions.id, sid));
}