import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { count } from "drizzle-orm";

import * as schema from "../db/schema";

/**
 * 首启初始化：users 表为空时，按 env 创建初始账号。
 * 部署时在 .env 配 INITIAL_USERNAME / INITIAL_PASSWORD 即可。
 * 后续改密码走"设置"接口，env 只在首次读。
 */
export async function ensureInitUser(db: BunSQLiteDatabase<typeof schema>) {
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  if (n > 0) return;

  const username = process.env.INITIAL_USERNAME ?? "admin";
  const password = process.env.INITIAL_PASSWORD; // 必填：拒绝默认弱口令
  if (!password) {
    throw new Error("初始账号密码未配置：请设置 env INITIAL_PASSWORD");
  }

  await db.insert(schema.users).values({
    username,
    passwordHash: await Bun.password.hash(password, { algorithm: "argon2id" }),
    createdAt: Date.now(),
  });
  console.log(`[auth] 初始账号已创建: ${username}`);
}