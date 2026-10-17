import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth, getUser } from "../middleware/auth";
import { createSession, revokeSession } from "../auth/session";
import * as schema from "../db/schema";

const router = new Hono<AppEnv>();

// 防时序侧信道：用户不存在时也做一次等量级的哈希验证
let _fakeHash: string | null = null;
async function timingSafeCheck(password: string) {
  if (!_fakeHash) _fakeHash = await Bun.password.hash("xiezuo-fake-check", { algorithm: "argon2id" });
  await Bun.password.verify(password, _fakeHash);
}

/** cookie 参数：生产（nginx 后）补 Secure */
function cookieOpts(c: { req: { header: (k: string) => string | undefined } }) {
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    path: "/",
    maxAge: 604800, // 7 天，与 session TTL 一致
    secure: c.req.header("x-forwarded-proto") === "https",
  };
}

/** 登录：校验账号密码 → 种 session cookie（7 天） */
router.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z
    .object({ username: z.string().min(1).max(64), password: z.string().min(1).max(256) })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: "参数不合法" }, 400);

  const user = await c.get("db").query.users.findFirst({
    where: eq(schema.users.username, parsed.data.username),
  });
  // 用户不存在也走一次等量级验证，避免时序侧信道暴露用户名存在性
  if (!user) await timingSafeCheck(parsed.data.password);
  const ok = user && (await Bun.password.verify(parsed.data.password, user.passwordHash));
  if (!ok || !user) return c.json({ error: "用户名或密码错误" }, 401);

  const sid = await createSession(c.get("db"), user.id);
  setCookie(c, "sid", sid, cookieOpts(c));
  return c.json({ ok: true });
});

/** 登出：吊销会话 + 清 cookie */
router.post("/logout", auth(), async (c) => {
  const sid = c.req.header("cookie")?.match(/sid=([a-f0-9]{64})/)?.[1];
  await revokeSession(c.get("db"), sid);
  deleteCookie(c, "sid", { sameSite: "Lax", path: "/" });
  return c.json({ ok: true });
});

/** 当前用户：前端启动时验证登录态 */
router.get("/me", auth(), (c) => c.json({ user: getUser(c) }));

export default router;