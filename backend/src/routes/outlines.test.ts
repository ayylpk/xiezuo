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
  ctx = () => ({ cookie: sid, "content-type": "application/json" });
  workId = (await (await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title: "大纲测试" }) })).json()).work.id;
});

/** 建一个节点，返回 id */
async function mk(title: string, parentId?: number) {
  const resp = await app.request(`/api/works/${workId}/outlines`, {
    method: "POST",
    headers: ctx(),
    body: JSON.stringify(parentId === undefined ? { title } : { title, parentId }),
  });
  return (await resp.json()).outline;
}

describe("outlines", () => {
  test("三级结构：卷一 → 第1章 → 细纲", async () => {
    const vol = await mk("第一卷 重生");
    const ch = await mk("第1章 病娇三阶", vol.id);
    const detail = await mk("细纲：锁门夜的内心戏", ch.id);

    expect(ch.parentId).toBe(vol.id);
    expect(detail.parentId).toBe(ch.id);
  });

  test("列表扁平返回，parentId 正确", async () => {
    const resp = await app.request(`/api/works/${workId}/outlines`, { headers: ctx() });
    const { outlines } = await resp.json();
    expect(outlines.length).toBe(3);
    expect(outlines[0].parentId).toBeNull();
  });

  test("同级 sortNo 递增", async () => {
    const a = await mk("卷一 甲");
    const b = await mk("卷一 乙");
    expect(b.sortNo).toBeGreaterThan(a.sortNo);
  });

  test("跨作品父节点 → 400", async () => {
    const other = (await (await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title: "另一本" }) })).json()).work;
    const foreignVol = await mk("外人卷一");
    const resp = await app.request(`/api/works/${other.id}/outlines`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ title: "挂错了", parentId: foreignVol.id }),
    });
    expect(resp.status).toBe(400);
  });

  test("父节点不存在 → 404", async () => {
    const resp = await app.request(`/api/works/${workId}/outlines`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ title: "孤儿", parentId: 9999 }),
    });
    expect(resp.status).toBe(404);
  });

  test("删除卷 → 子树全部消失", async () => {
    const vol = await mk("要删的卷");
    const ch = await mk("里面的章", vol.id);
    await mk("里面的细纲", ch.id);

    const del = await app.request(`/api/outlines/${vol.id}`, { method: "DELETE", headers: ctx() });
    expect(del.status).toBe(200);

    const resp = await app.request(`/api/works/${workId}/outlines`, { headers: ctx() });
    const { outlines } = await resp.json();
    expect(outlines.filter((o: { parentId: number | null }) => o.parentId !== null).every((o: { parentId: number }) => ![vol.id, ch.id].includes(o.parentId))).toBe(true);
  });

  test("patch 改标题", async () => {
    const node = await mk("待改名");
    const resp = await app.request(`/api/outlines/${node.id}`, {
      method: "PATCH",
      headers: ctx(),
      body: JSON.stringify({ title: "改好了" }),
    });
    expect((await resp.json()).outline.title).toBe("改好了");
  });
});