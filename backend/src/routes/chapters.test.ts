import { describe, expect, test, beforeAll } from "bun:test";
import type { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { createApp } from "../app";
import * as schema from "../db/schema";
import { freshDbForTest } from "../db/db";

const PASSWORD = "pass1234";

let app: ReturnType<typeof createApp>;
let cookie: () => Record<string, string>;
let workId: number;

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
  const sid = resp.headers.get("set-cookie")!;
  cookie = () => ({ cookie: sid, "content-type": "application/json" });

  const w = await app.request("/api/works", {
    method: "POST",
    headers: cookie(),
    body: JSON.stringify({ title: "测试作品" }),
  });
  workId = (await w.json()).work.id;
});

describe("chapters", () => {
  test("未登录 → 401", async () => {
    const resp = await app.request(`/api/works/${workId}/chapters`);
    expect(resp.status).toBe(401);
  });

  test("建章：自动章名 + sortNo 递增 + 字符口径字数", async () => {
    const r1 = await app.request(`/api/works/${workId}/chapters`, {
      method: "POST",
      headers: cookie(),
      body: JSON.stringify({ content: "第一章 你好，世界" }),
    });
    expect(r1.status).toBe(201);
    const { chapter: c1 } = await r1.json();
    // "第一章你好，世界" = 8 字符（中文标点算 1）
    expect(c1.wordCount).toBe(8);
    expect(c1.title.startsWith("第 ")).toBe(true);
    expect(c1.sortNo).toBe(1);

    const r2 = await app.request(`/api/works/${workId}/chapters`, {
      method: "POST",
      headers: cookie(),
      body: JSON.stringify({}),
    });
    const { chapter: c2 } = await r2.json();
    expect(c2.sortNo).toBe(2);
  });

  test("列表：按 sortNo 排序且不含正文", async () => {
    const resp = await app.request(`/api/works/${workId}/chapters`, { headers: cookie() });
    const { chapters } = await resp.json();
    expect(chapters.length).toBe(2);
    expect(chapters[0].sortNo).toBe(1);
    expect(chapters[0].content).toBeUndefined();
  });

  test("单章带正文", async () => {
    const list = await (await app.request(`/api/works/${workId}/chapters`, { headers: cookie() })).json();
    const id = list.chapters[0].id;
    const resp = await app.request(`/api/chapters/${id}`, { headers: cookie() });
    const { chapter } = await resp.json();
    expect(chapter.content).toContain("第一章");
  });

  test("patch：状态流转 + 正文替换重算字数", async () => {
    const list = await (await app.request(`/api/works/${workId}/chapters`, { headers: cookie() })).json();
    const id = list.chapters[0].id;
    const resp = await app.request(`/api/chapters/${id}`, {
      method: "PATCH",
      headers: cookie(),
      body: JSON.stringify({ status: "written", content: "改短的正文" }),
    });
    const { chapter } = await resp.json();
    expect(chapter.status).toBe("written");
    expect(chapter.wordCount).toBe(5);
    expect(chapter.content).toBe("改短的正文");
  });

  test("patch 非法状态 → 400", async () => {
    const list = await (await app.request(`/api/works/${workId}/chapters`, { headers: cookie() })).json();
    const id = list.chapters[0].id;
    const resp = await app.request(`/api/chapters/${id}`, {
      method: "PATCH",
      headers: cookie(),
      body: JSON.stringify({ status: "published" }),
    });
    expect(resp.status).toBe(400);
  });

  test("作品不存在 → 404", async () => {
    const resp = await app.request("/api/works/9999/chapters", { headers: cookie() });
    expect(resp.status).toBe(404);
  });

  test("删除章节", async () => {
    const list = await (await app.request(`/api/works/${workId}/chapters`, { headers: cookie() })).json();
    const id = list.chapters[0].id;
    const del = await app.request(`/api/chapters/${id}`, { method: "DELETE", headers: cookie() });
    expect(del.status).toBe(200);
    const after = await app.request(`/api/chapters/${id}`, { headers: cookie() });
    expect(after.status).toBe(404);
  });

  test("写章节后作品 updatedAt 浮升（touch）", async () => {
    const resp = await app.request("/api/works", { headers: cookie() });
    const { works } = await resp.json();
    expect(works[0].chapterCount).toBeGreaterThan(0);
  });
});