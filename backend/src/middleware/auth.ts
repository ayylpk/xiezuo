import type { Context, MiddlewareHandler } from "hono";

import { verifySession } from "../auth/session";
import type { AppEnv, UserPayload } from "../app";

/** 登录态中间件：解析 cookie sid → 注入 user。失败按 needAuth 决定 401 或放行 */
export function auth(needAuth = true): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const db = c.get("db");
    const sid = c.req.header("cookie")?.match(/sid=([a-f0-9]{64})/)?.[1];
    const session = await verifySession(db, sid);
    if (session) c.set("user", { id: session.userId });

    if (needAuth && !c.get("user")) {
      return c.json({ error: "未登录" }, 401);
    }
    await next();
  };
}

/** ctx 里取当前用户（须先过 auth 中间件） */
export function getUser(c: Context<AppEnv>): UserPayload {
  const u = c.get("user");
  if (!u) throw new Error("auth middleware 未注入 user");
  return u;
}

/** 统一 cookie 写入/清除参数（生产环境 Secure） */
export function cookieOptions(isProd = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    path: "/",
    secure: isProd,
  };
}