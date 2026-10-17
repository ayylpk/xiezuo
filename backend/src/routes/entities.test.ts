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

async function mkWork(title = "测试作品") {
  const resp = await app.request("/api/works", { method: "POST", headers: ctx(), body: JSON.stringify({ title }) });
  return (await resp.json()).work;
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
  ctx = () => ({ cookie: sid, "content-type": "application/json" });
  workId = (await mkWork()).id;
});

describe("entities", () => {
  test("人物卡：name/type/content/extra 建卡，extra 结构化字段完整往返", async () => {
    const resp = await app.request(`/api/works/${workId}/entities`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({
        name: "苏晴",
        type: "character",
        content: "重生后绑定的青梅竹马",
        extra: { appearance: "长发及腰，冷淡眉眼", personality: "病娇三阶", goal: "占有主角", ability: "命理感知" },
      }),
    });
    expect(resp.status).toBe(201);
    const { entity } = await resp.json();
    expect(entity.name).toBe("苏晴");
    expect(entity.extra.appearance).toContain("长发");
    expect(entity.extra.ability).toBe("命理感知");
  });

  test("类型过滤：只回 character", async () => {
    await app.request(`/api/works/${workId}/entities`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ name: "校门口", type: "scene", content: "日常场景" }),
    });
    const resp = await app.request(`/api/works/${workId}/entities?type=character`, { headers: ctx() });
    const { entities } = await resp.json();
    expect(entities.length).toBe(1);
    expect(entities[0].type).toBe("character");
  });

  test("extra 传非对象 → 400", async () => {
    const resp = await app.request(`/api/works/${workId}/entities`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ name: "x", type: "character", extra: "not-object" }),
    });
    expect(resp.status).toBe(400);
  });

  test("patch 改名改内容", async () => {
    const list = await (await app.request(`/api/works/${workId}/entities`, { headers: ctx() })).json();
    const id = list.entities[0].id;
    const resp = await app.request(`/api/entities/${id}`, {
      method: "PATCH",
      headers: ctx(),
      body: JSON.stringify({ name: "苏晴（改）", extra: { ability: "天机推演" } }),
    });
    const { entity } = await resp.json();
    expect(entity.name).toBe("苏晴（改）");
    expect(entity.extra.ability).toBe("天机推演");
  });
});

describe("relations", () => {
  test("建立关系：join 出两端名称", async () => {
    const list = await (await app.request(`/api/works/${workId}/entities`, { headers: ctx() })).json();
    const [a, b] = list.entities;
    const resp = await app.request(`/api/works/${workId}/relations`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ fromId: a.id, toId: b.id, relType: "青梅竹马", note: "从小一起长大" }),
    });
    expect(resp.status).toBe(201);

    const rels = await (await app.request(`/api/works/${workId}/relations`, { headers: ctx() })).json();
    expect(rels.relations[0].fromName).toBeTruthy();
    expect(rels.relations[0].toName).toBeTruthy();
    expect(rels.relations[0].relType).toBe("青梅竹马");
  });

  test("跨作品连边 → 400（归属拦截）", async () => {
    const w2 = await mkWork("另一本");
    const list = await (await app.request(`/api/works/${workId}/entities`, { headers: ctx() })).json();
    const a = list.entities[0];
    // 给 w2 建一个实体
    const e2 = await (
      await app.request(`/api/works/${w2.id}/entities`, {
        method: "POST",
        headers: ctx(),
        body: JSON.stringify({ name: "外人", type: "character" }),
      })
    ).json();
    const resp = await app.request(`/api/works/${workId}/relations`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ fromId: a.id, toId: e2.entity.id, relType: "敌对" }),
    });
    expect(resp.status).toBe(400);
  });

  test("自连 → 400", async () => {
    const list = await (await app.request(`/api/works/${workId}/entities`, { headers: ctx() })).json();
    const a = list.entities[0];
    const resp = await app.request(`/api/works/${workId}/relations`, {
      method: "POST",
      headers: ctx(),
      body: JSON.stringify({ fromId: a.id, toId: a.id, relType: "自己" }),
    });
    expect(resp.status).toBe(400);
  });

  test("删实体级联删关系", async () => {
    const list = await (await app.request(`/api/works/${workId}/entities`, { headers: ctx() })).json();
    const first = list.entities[0];
    await app.request(`/api/entities/${first.id}`, { method: "DELETE", headers: ctx() });
    const rels = await (await app.request(`/api/works/${workId}/relations`, { headers: ctx() })).json();
    expect(rels.relations.length).toBe(0);
  });
});