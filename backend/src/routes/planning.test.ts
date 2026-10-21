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

  const w = await (await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title: "规划侧测试" }) })).json();
  workId = w.work.id;
  const ch = await (
    await app.request(`/api/works/${workId}/chapters`, { method: "POST", headers: ctx(), body: JSON.stringify({ title: "第1章" }) })
  ).json();
  chapterId = ch.chapter.id;
});

describe("foreshadows", () => {
  test("建档：内容 + 埋设/回收章节 + 默认状态 open", async () => {
    const resp = await app.request(`/api/works/${workId}/foreshadows`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ content: "病娇三阶的锁门伏笔", plantedChapterId: chapterId }),
    });
    expect(resp.status).toBe(201);
    const { foreshadow } = await resp.json();
    expect(foreshadow.status).toBe("open");
    expect(foreshadow.plantedChapterId).toBe(chapterId);
  });

  test("关联到不存在的章节 → 404", async () => {
    const resp = await app.request(`/api/works/${workId}/foreshadows`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ content: "x", revealChapterId: 9999 }),
    });
    expect(resp.status).toBe(404);
  });

  test("关联他人章节 → 400（归属校验，不能被挂到别的作品）", async () => {
    const other = (await (await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title: "别处" }) })).json()).work;
    const seen = await (
      await app.request(`/api/works/${other.id}/chapters`, { method: "POST", headers: ctx(), body: JSON.stringify({ title: "外人章" }) })
    ).json();
    const atCreate = await app.request(`/api/works/${workId}/foreshadows`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ content: "跨作品埋设", plantedChapterId: seen.chapter.id }),
    });
    expect(atCreate.status).toBe(400);
    expect((await atCreate.json()).error).toContain("不属于");

    // patch 路径同样拦：已存在的伏笔不能被改挂到他人章节
    const list = await (await app.request(`/api/works/${workId}/foreshadows`, { headers: ctx() })).json();
    const atPatch = await app.request(`/api/foreshadows/${list.foreshadows[0].id}`, {
      method: "PATCH",
      headers: ctx(),
      body: JSON.stringify({ revealChapterId: seen.chapter.id }),
    });
    expect(atPatch.status).toBe(400);
  });

  test("收伏笔：patch status → closed", async () => {
    const list = await (await app.request(`/api/works/${workId}/foreshadows`, { headers: ctx() })).json();
    const id = list.foreshadows[0].id;
    const resp = await app.request(`/api/foreshadows/${id}`, {
      method: "PATCH",
      headers: ctx(),
      body: JSON.stringify({ status: "closed", revealChapterId: chapterId }),
    });
    const { foreshadow } = await resp.json();
    expect(foreshadow.status).toBe("closed");
    expect(foreshadow.revealChapterId).toBe(chapterId);
  });

  test("非法状态 → 400", async () => {
    const list = await (await app.request(`/api/works/${workId}/foreshadows`, { headers: ctx() })).json();
    const resp = await app.request(`/api/foreshadows/${list.foreshadows[0].id}`, {
      method: "PATCH",
      headers: ctx(),
      body: JSON.stringify({ status: "half-open" }),
    });
    expect(resp.status).toBe(400);
  });
});

describe("timeline", () => {
  test("建事件：storyTime 自由文本 + 关联章节 + sortNo 递增", async () => {
    const r1 = await app.request(`/api/works/${workId}/timeline`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ storyTime: "第 3 年冬", event: "锁门夜，病娇三阶觉醒", chapterId }),
    });
    expect(r1.status).toBe(201);
    expect((await r1.json()).event.sortNo).toBe(1);

    const r2 = await app.request(`/api/works/${workId}/timeline`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ storyTime: "第 4 年春", event: "第一次冷战" }),
    });
    expect((await r2.json()).event.sortNo).toBe(2);
  });

  test("关联他人章节 → 400", async () => {
    const other = (await (await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title: "另一本" }) })).json()).work;
    const ch = await (
      await app.request(`/api/works/${other.id}/chapters`, { method: "POST", headers: ctx(), body: JSON.stringify({ title: "外人章" }) })
    ).json();
    const resp = await app.request(`/api/works/${workId}/timeline`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ storyTime: "x", event: "y", chapterId: ch.chapter.id }),
    });
    expect(resp.status).toBe(400);
  });

  test("patch + delete", async () => {
    const list = await (await app.request(`/api/works/${workId}/timeline`, { headers: ctx() })).json();
    const id = list.timeline[0].id;
    const patch = await app.request(`/api/timeline/${id}`, {
      method: "PATCH",
      headers: ctx(),
      body: JSON.stringify({ event: "改过的事件" }),
    });
    expect((await patch.json()).event.event).toBe("改过的事件");

    const del = await app.request(`/api/timeline/${id}`, { method: "DELETE", headers: ctx() });
    expect(del.status).toBe(200);
    const after = await app.request(`/api/timeline/${id}`, { method: "DELETE", headers: ctx() });
    expect(after.status).toBe(404);
  });
});