import { describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { createApp } from "../app";
import * as schema from "../db/schema";
import { freshDbForTest } from "../db/db";

const PASSWORD = "pass1234";

function makeApp() {
  const sqlite = freshDbForTest(); // 空内存库，createApp 内会自动建表
  const app = createApp(sqlite as unknown as Database);
  return { app, sqlite };
}

async function seedUser(sqlite: Database, username = "test") {
  const db = drizzle(sqlite, { schema });
  await db.insert(schema.users).values({
    username,
    passwordHash: await Bun.password.hash(PASSWORD, { algorithm: "argon2id" }),
    createdAt: Date.now(),
  });
}

async function login(app: ReturnType<typeof makeApp>["app"], username = "test") {
  return app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
}

function sidFrom(resp: Response) {
  return resp.headers.get("set-cookie")?.match(/sid=([a-f0-9]{64})/)?.[1];
}

describe("health", () => {
  test("未登录也能探活——探针不该被鉴权拦（子路由 use(\"*\") 会吃 /api/*）", async () => {
    const { app } = makeApp();
    const resp = await app.request("/api/health");
    expect(resp.status).toBe(200);
    expect((await resp.json()).ok).toBe(true);
  });
});

describe("auth", () => {
  test("未登录访问 /me → 401", async () => {
    const { app } = makeApp();
    const resp = await app.request("/api/auth/me");
    expect(resp.status).toBe(401);
  });

  test("登录成功 → 种 sid cookie，携带可访问 /me", async () => {
    const { app, sqlite } = makeApp();
    await seedUser(sqlite);

    const loginResp = await login(app);
    expect(loginResp.status).toBe(200);
    const sid = sidFrom(loginResp);
    expect(sid).toBeTruthy();
    expect(loginResp.headers.get("set-cookie")).toContain("HttpOnly");
    expect(loginResp.headers.get("set-cookie")).toContain("SameSite=Lax");

    const meResp = await app.request("/api/auth/me", {
      headers: { cookie: `sid=${sid}` },
    });
    expect(meResp.status).toBe(200);
    expect(await meResp.json()).toEqual({ user: { id: 1 } });
  });

  test("密码错误 → 401", async () => {
    const { app, sqlite } = makeApp();
    await seedUser(sqlite);

    const resp = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "test", password: "wrong-password" }),
    });
    expect(resp.status).toBe(401);
  });

  test("用户不存在 → 401（时序等量验证不炸）", async () => {
    const { app } = makeApp();
    const resp = await login(app, "no-such-user");
    expect(resp.status).toBe(401);
  });

  test("参数不合法（缺 password）→ 400", async () => {
    const { app } = makeApp();
    const resp = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "x" }),
    });
    expect(resp.status).toBe(400);
  });

  test("登出 → cookie 清除，原 sid 失效", async () => {
    const { app, sqlite } = makeApp();
    await seedUser(sqlite);
    const sid = sidFrom(await login(app))!;

    const outResp = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { cookie: `sid=${sid}` },
    });
    expect(outResp.status).toBe(200);
    expect(outResp.headers.get("set-cookie")).toContain("Max-Age=0");

    const meResp = await app.request("/api/auth/me", {
      headers: { cookie: `sid=${sid}` },
    });
    expect(meResp.status).toBe(401);
  });
});