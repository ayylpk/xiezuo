import { describe, expect, test, beforeAll } from "bun:test";
import type { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { createApp } from "../app";
import * as schema from "../db/schema";
import { freshDbForTest } from "../db/db";

const PASSWORD = "pass1234";

let app: ReturnType<typeof createApp>;
let ctx: () => Record<string, string>;
let workA: number;
let workB: number;

/** 在别号下创建作品+数据的便捷函数 */
async function seedWork(title: string, entityName: string, outlineContent: string) {
  const w = await (await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title }) })).json();
  const workId = w.work.id;
  const ch = await (
    await app.request(`/api/works/${workId}/chapters`, { method: "POST", headers: ctx(), body: JSON.stringify({ title: "第1章 锁门夜" }) })
  ).json();
  await app.request(`/api/chapters/${ch.chapter.id}`, {
    method: "PATCH",
    headers: ctx(),
    body: JSON.stringify({
      content: "夜幕四合，她站在门后，指尖悬在插销上。这条街的传闻不假——那户人家夜夜锁门，从不留客。",
    }),
  });
  await app.request(`/api/works/${workId}/entities`, {
    method: "POST",
    headers: ctx(),
    body: JSON.stringify({ name: entityName, type: "character", content: "身份成谜，与锁门夜有关" }),
  });
  await app.request(`/api/works/${workId}/outlines`, {
    method: "POST",
    headers: ctx(),
    body: JSON.stringify({ title: "卷二 转折", content: outlineContent }),
  });
  await app.request(`/api/works/${workId}/foreshadows`, {
    method: "POST",
    headers: ctx(),
    body: JSON.stringify({ content: "病娇根源在童年旧宅" }),
  });
  await app.request(`/api/works/${workId}/timeline`, {
    method: "POST",
    headers: ctx(),
    body: JSON.stringify({ storyTime: "第 2 年冬", event: "她反锁房门那天，雪下了一整夜" }),
  });
  await app.request(`/api/works/${workId}/notes`, {
    method: "POST",
    headers: ctx(),
    body: JSON.stringify({ type: "idea", content: "灵光一闪：结尾让插销从内侧脱落" }),
  });
  return workId;
}

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

  workA = await seedWork("锁门录", "苏晴", "生死转折爆发位，此处埋铁匠铺线索");
  workB = await seedWork("别传", "铁匠老葛", "另一处的转折与伏笔");
});

describe("search", () => {
  test("空词 / 纯空格 → 400", async () => {
    expect((await app.request("/api/search?q=", { headers: ctx() })).status).toBe(400);
    expect((await app.request("/api/search?q=%20%20", { headers: ctx() })).status).toBe(400);
  });

  test("中文字命中正文 → 章节卡带摘要片段", async () => {
    const { hits } = await (await app.request(`/api/search?q=${encodeURIComponent("锁门")}`, { headers: ctx() })).json();
    const chapter = hits.find((h: { kind: string }) => h.kind === "chapter");
    expect(chapter).toBeTruthy();
    expect(chapter.title).toBe("【章节】第1章 锁门夜");
    expect(chapter.snippet).toContain("锁门");
    expect(chapter.snippet.length).toBeLessThan(140);
  });

  test("命中设定 → 带类型前缀", async () => {
    const { hits } = await (await app.request(`/api/search?q=${encodeURIComponent("苏晴")}`, { headers: ctx() })).json();
    expect(hits.some((h: { kind: string; title: string }) => h.kind === "entity" && h.title === "【人物】苏晴")).toBe(true);
  });

  test("命中大纲/伏笔/时间线/随笔", async () => {
    const outline = await (await app.request(`/api/search?q=${encodeURIComponent("生死转折")}`, { headers: ctx() })).json();
    expect(outline.hits.some((h: { kind: string }) => h.kind === "outline")).toBe(true);

    const foreshadow = await (await app.request(`/api/search?q=${encodeURIComponent("病娇根源")}`, { headers: ctx() })).json();
    expect(foreshadow.hits.some((h: { kind: string }) => h.kind === "foreshadow")).toBe(true);

    const timeline = await (await app.request(`/api/search?q=${encodeURIComponent("反锁房门")}`, { headers: ctx() })).json();
    expect(timeline.hits.some((h: { kind: string }) => h.kind === "timeline")).toBe(true);

    const note = await (await app.request(`/api/search?q=${encodeURIComponent("灵光一闪")}`, { headers: ctx() })).json();
    expect(note.hits.some((h: { kind: string; title: string }) => h.kind === "note" && h.title.startsWith("【灵感】"))).toBe(true);
  });

  test("workId 过滤：只看某一本", async () => {
    // 铁匠铺只存在于 A 的大纲
    const all = await (await app.request(`/api/search?q=${encodeURIComponent("铁匠铺")}`, { headers: ctx() })).json();
    expect(all.hits.length).toBe(1);
    expect(all.hits[0].workId).toBe(workA);

    const inB = await (await app.request(`/api/search?q=${encodeURIComponent("铁匠铺")}&workId=${workB}`, { headers: ctx() })).json();
    expect(inB.hits.length).toBe(0);

    const inA = await (await app.request(`/api/search?q=${encodeURIComponent("锁门")}&workId=${workA}`, { headers: ctx() })).json();
    expect(inA.hits.length).toBeGreaterThan(0);
    expect(inA.hits.every((h: { workId: number }) => h.workId === workA)).toBe(true);
  });

  test("workId 不合法 → 400", async () => {
    expect((await app.request(`/api/search?q=x&workId=abc`, { headers: ctx() })).status).toBe(400);
  });

  test("无命中 → 空数组", async () => {
    const { hits } = await (await app.request(`/api/search?q=${encodeURIComponent("不存在的词xyz")}`, { headers: ctx() })).json();
    expect(hits).toEqual([]);
  });
});