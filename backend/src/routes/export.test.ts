import { describe, expect, test, beforeAll } from "bun:test";
import type { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { createApp } from "../app";
import * as schema from "../db/schema";
import { freshDbForTest } from "../db/db";

const PASSWORD = "pass1234";

let app: ReturnType<typeof createApp>;
let ctx: () => Record<string, string>;
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
  ctx = () => ({ cookie: sid });

  const w = await (
    await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title: "锁门录", description: "高冷青梅的执念" }) })
  ).json();
  workId = w.work.id;
  const ch = await (
    await app.request(`/api/works/${workId}/chapters`, { method: "POST", headers: ctx(), body: JSON.stringify({ title: "第1章 锁门夜", synopsis: "她反锁了房门", content: "夜幕四合，**她反锁了房门**。" }) })
  ).json();
  await app.request("/api/annotations", {
    method: "POST",
    headers: ctx(),
    body: JSON.stringify({ entityType: "chapter", entityId: ch.chapter.id, content: "呼应第14章" }),
  });
  await app.request(`/api/works/${workId}/entities`, {
    method: "POST",
    headers: ctx(),
    body: JSON.stringify({ name: "苏晴", type: "character" }),
  });
});

describe("export", () => {
  test("md：标题/简介/章节/正文齐全", async () => {
    const resp = await app.request(`/api/works/${workId}/export?format=md`, { headers: ctx() });
    expect(resp.status).toBe(200);
    expect(resp.headers.get("content-type")).toContain("text/markdown");
    expect(resp.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    const body = await resp.text();
    expect(body).toContain("# 《锁门录》");
    expect(body).toContain("> 高冷青梅的执念");
    expect(body).toContain("## 第1章 锁门夜");
    expect(body).toContain("> 简情：她反锁了房门");
    expect(body).toContain("她反锁了房门");
  });

  test("txt：无 markdown 符号，纯文本可读", async () => {
    const resp = await app.request(`/api/works/${workId}/export?format=txt`, { headers: ctx() });
    expect(resp.status).toBe(200);
    expect(resp.headers.get("content-type")).toContain("text/plain");
    const body = await resp.text();
    expect(body).not.toContain("## ");
    expect(body).not.toContain("**");
    expect(body).toContain("《锁门录》");
    expect(body).toContain("第1章 锁门夜");
    expect(body).toContain("夜幕四合");
  });

  test("json：全量结构化，含批注/设定", async () => {
    const resp = await app.request(`/api/works/${workId}/export?format=json`, { headers: ctx() });
    expect(resp.headers.get("content-type")).toContain("application/json");
    const data = await resp.json();
    expect(data.work.title).toBe("锁门录");
    expect(data.chapters.length).toBe(1);
    expect(data.entities.length).toBe(1);
    expect(data.annotations.length).toBe(1);
    expect(data.annotations[0].content).toContain("呼应");
  });

  test("json：只带本作品的批注，不串别的书", async () => {
    const other = (
      await (await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title: "另一本" }) })).json()
    ).work;
    const otherCh = (
      await (await app.request(`/api/works/${other.id}/chapters`, { method: "POST", headers: ctx(), body: JSON.stringify({ title: "外人章" }) })).json()
    ).chapter;
    await app.request("/api/annotations", {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ entityType: "chapter", entityId: otherCh.id, content: "别书批注不该出现" }),
    });

    const data = await (await app.request(`/api/works/${workId}/export?format=json`, { headers: ctx() })).json();
    expect(data.annotations.length).toBe(1);
    expect(JSON.stringify(data.annotations)).not.toContain("别书批注");
  });

  test("json：随笔按最近更新在前导出", async () => {
    const first = (
      await (await app.request(`/api/works/${workId}/notes`, { method: "POST", headers: ctx(), body: JSON.stringify({ type: "note", content: "旧随笔" }) })).json()
    ).note;
    await Bun.sleep(5);
    await app.request(`/api/works/${workId}/notes`, { method: "POST", headers: ctx(), body: JSON.stringify({ type: "idea", content: "新随笔" }) });
    await Bun.sleep(5);
    await app.request(`/api/notes/${first.id}`, { method: "PATCH", headers: ctx(), body: JSON.stringify({ content: "旧随笔刚改过" }) });

    const data = await (await app.request(`/api/works/${workId}/export?format=json`, { headers: ctx() })).json();
    expect(data.notes.length).toBe(2);
    expect(data.notes[0].id).toBe(first.id);
  });

  test("默认 format = md", async () => {
    const resp = await app.request(`/api/works/${workId}/export`, { headers: ctx() });
    expect(resp.headers.get("content-type")).toContain("text/markdown");
  });

  test("非法 format → 400；不存在作品 → 404", async () => {
    expect((await app.request(`/api/works/${workId}/export?format=pdf`, { headers: ctx() })).status).toBe(400);
    expect((await app.request(`/api/works/99999/export`, { headers: ctx() })).status).toBe(404);
  });
});