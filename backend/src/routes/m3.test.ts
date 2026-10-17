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
let chapterId: number;
let entityId: number;

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
  ctx = () => ({ cookie: sid, "content-type": "application/json" });

  const w = await (await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title: "M3测试" }) })).json();
  workId = w.work.id;
  const ch = await (
    await app.request(`/api/works/${workId}/chapters`, { method: "POST", headers: ctx(), body: JSON.stringify({ title: "第1章 锁门夜" }) })
  ).json();
  chapterId = ch.chapter.id;
  const e = await (
    await app.request(`/api/works/${workId}/entities`, { method: "POST", headers: ctx(), body: JSON.stringify({ name: "苏晴", type: "character" }) })
  ).json();
  entityId = e.entity.id;
});

describe("annotations", () => {
  test("在章节上挂批注 + 读取", async () => {
    const create = await app.request("/api/annotations", {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ entityType: "chapter", entityId: chapterId, content: "这里要呼应第14章" }),
    });
    expect(create.status).toBe(201);

    const list = await app.request(`/api/annotations?entityType=chapter&entityId=${chapterId}`, { headers: ctx() });
    const { annotations } = await list.json();
    expect(annotations.length).toBe(1);
    expect(annotations[0].content).toContain("呼应");
  });

  test("在实体上挂批注（不同类型互不串）", async () => {
    await app.request("/api/annotations", {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ entityType: "entity", entityId, content: "病娇三阶进度" }),
    });
    const ch = await (await app.request(`/api/annotations?entityType=chapter&entityId=${chapterId}`, { headers: ctx() })).json();
    const en = await (await app.request(`/api/annotations?entityType=entity&entityId=${entityId}`, { headers: ctx() })).json();
    expect(ch.annotations.length).toBe(1);
    expect(en.annotations.length).toBe(1);
  });

  test("挂到不存在的目标 → 404", async () => {
    const resp = await app.request("/api/annotations", {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ entityType: "chapter", entityId: 99999, content: "x" }),
    });
    expect(resp.status).toBe(404);
  });

  test("非法 entityType → 400", async () => {
    const resp = await app.request("/api/annotations", {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ entityType: "work", entityId: 1, content: "x" }),
    });
    expect(resp.status).toBe(400);
  });

  test("patch + delete", async () => {
    const list = await (await app.request(`/api/annotations?entityType=entity&entityId=${entityId}`, { headers: ctx() })).json();
    const id = list.annotations[0].id;
    const patch = await app.request(`/api/annotations/${id}`, { method: "PATCH", headers: ctx(), body: JSON.stringify({ content: "改成定稿前言" }) });
    expect((await patch.json()).annotation.content).toBe("改成定稿前言");
    const del = await app.request(`/api/annotations/${id}`, { method: "DELETE", headers: ctx() });
    expect(del.status).toBe(200);
  });
});

describe("notes", () => {
  test("三种类型各建一条 + 类型过滤", async () => {
    for (const [type, content] of [
      ["note", "今天写到这里很有感觉"],
      ["idea", "下一章可以出现反转"],
      ["graveyard", "删掉的旧版开头"],
    ] as const) {
      const resp = await app.request(`/api/works/${workId}/notes`, {
        method: "POST",
        headers: ctx(),
        body: JSON.stringify({ type, content }),
      });
      expect(resp.status).toBe(201);
    }
    const all = await (await app.request(`/api/works/${workId}/notes`, { headers: ctx() })).json();
    expect(all.notes.length).toBe(3);
    const ideas = await (await app.request(`/api/works/${workId}/notes?type=idea`, { headers: ctx() })).json();
    expect(ideas.notes.length).toBe(1);
    expect(ideas.notes[0].content).toContain("反转");
  });

  test("patch 改内容 + delete", async () => {
    const all = await (await app.request(`/api/works/${workId}/notes`, { headers: ctx() })).json();
    const id = all.notes[0].id;
    const patch = await app.request(`/api/notes/${id}`, { method: "PATCH", headers: ctx(), body: JSON.stringify({ title: "有价值" }) });
    expect((await patch.json()).note.title).toBe("有价值");
    const del = await app.request(`/api/notes/${id}`, { method: "DELETE", headers: ctx() });
    expect(del.status).toBe(200);
  });
});