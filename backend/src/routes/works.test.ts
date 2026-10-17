import { describe, expect, test, beforeAll } from "bun:test";
import type { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { createApp } from "../app";
import * as schema from "../db/schema";
import { freshDbForTest } from "../db/db";

const PASSWORD = "pass1234";

// 共享 app + 已登录 cookie（建一次，用例复用）
let app: ReturnType<typeof createApp>;
let cookie: string;

beforeAll(async () => {
  const sqlite = freshDbForTest() as unknown as Database;
  app = createApp(sqlite);
  await drizzle(sqlite, { schema }).insert(schema.users).values({
    username: "test",
    passwordHash: await Bun.password.hash(PASSWORD, { algorithm: "argon2id" }),
    createdAt: Date.now(),
  });
  const resp = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test", password: PASSWORD }),
  });
  cookie = resp.headers.get("set-cookie")!;
});

// 注意：必须函数动态取值——cookie 在 beforeAll 才就位，顶层对象会捕获到 undefined
const authHeaders = () => ({ cookie, "content-type": "application/json" });

describe("works", () => {
  test("未登录 → 401", async () => {
    const resp = await app.request("/api/works");
    expect(resp.status).toBe(401);
  });

  test("创建作品 → 201，默认状态连载", async () => {
    const resp = await app.request("/api/works", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title: "重生后，高冷青梅被我宠成小病娇" }),
    });
    expect(resp.status).toBe(201);
    const { work } = await resp.json();
    expect(work.title).toContain("重生后");
    expect(work.status).toBe("ongoing");
    expect(work.id).toBeGreaterThan(0);
  });

  test("title 缺失 → 400", async () => {
    const resp = await app.request("/api/works", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ description: "没标题" }),
    });
    expect(resp.status).toBe(400);
  });

  test("列表包含刚建的作品，统计为 0 章 0 字", async () => {
    const resp = await app.request("/api/works", { headers: authHeaders() });
    const { works } = await resp.json();
    expect(works.length).toBeGreaterThanOrEqual(1);
    const w = works[0];
    expect(w.chapterCount).toBe(0);
    expect(w.totalWords).toBe(0);
  });

  test("patch 改标题和状态", async () => {
    const list = await (await app.request("/api/works", { headers: authHeaders() })).json();
    const id = list.works[0].id;
    const resp = await app.request(`/api/works/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ title: "改名了", status: "finished" }),
    });
    expect(resp.status).toBe(200);
    const { work } = await resp.json();
    expect(work.title).toBe("改名了");
    expect(work.status).toBe("finished");
  });

  test("不存在的 id → 404", async () => {
    const resp = await app.request("/api/works/99999", { headers: authHeaders() });
    expect(resp.status).toBe(404);
  });

  test("非法 id（abc）→ 400", async () => {
    const resp = await app.request("/api/works/abc", { headers: authHeaders() });
    expect(resp.status).toBe(400);
  });

  test("删除作品（级联章节由外键兜底，此处只验作品消失）", async () => {
    const list = await (await app.request("/api/works", { headers: authHeaders() })).json();
    const id = list.works[0].id;
    const del = await app.request(`/api/works/${id}`, { method: "DELETE", headers: authHeaders() });
    expect(del.status).toBe(200);
    const after = await app.request(`/api/works/${id}`, { headers: authHeaders() });
    expect(after.status).toBe(404);
  });
});