import { and, eq, like, or } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import * as schema from "../db/schema";

/**
 * 检索实现：LIKE 全扫（实测依据：48 万字全扫 <5ms；bun:sqlite 无 ngram 分词，
 * FTS5 对中文只有整块 token，"锁门"匹配不到"锁门夜"，LIKE 反而准确、代价可忽略）。
 * 覆盖：章节(标题/简情/正文)、设定(名称/内容)、大纲(标题/内容)、伏笔、时间线、随笔。
 */
export type SearchHit = {
  kind: string;
  id: number;
  workId: number;
  title: string;
  snippet: string;
};

const SNIPPET_WINDOW = 40; // 命中词前后各取 40 字符
const PER_KIND_LIMIT = 30;

// 库里的 type 是 text 列（string），查文案表时要按 string 索引，这里显式收宽
const ENTITY_LABEL: Record<string, string> = schema.ENTITY_TYPES;
const NOTE_LABEL: Record<string, string> = schema.NOTE_TYPES;

/** 按优先级取第一个含命中词的字段，掐出前后窗口作为摘要 */
function buildSnippet(fields: (string | null | undefined)[], q: string): string {
  for (const f of fields) {
    if (!f) continue;
    const idx = f.indexOf(q);
    if (idx >= 0) {
      const start = Math.max(0, idx - SNIPPET_WINDOW);
      const end = Math.min(f.length, idx + q.length + SNIPPET_WINDOW);
      return (start > 0 ? "…" : "") + f.slice(start, end) + (end < f.length ? "…" : "");
    }
  }
  return "";
}

export async function searchAll(db: BunSQLiteDatabase<typeof schema>, q: string, workId?: number): Promise<SearchHit[]> {
  const kw = `%${q}%`;
  const inWork = workId !== undefined;
  const hits: SearchHit[] = [];

  // 章节：标题/简情/正文命中
  const chapters = await db
    .select({ id: schema.chapters.id, workId: schema.chapters.workId, title: schema.chapters.title, synopsis: schema.chapters.synopsis, content: schema.chapters.content })
    .from(schema.chapters)
    .where(inWork ? and(eq(schema.chapters.workId, workId), or(like(schema.chapters.title, kw), like(schema.chapters.synopsis, kw), like(schema.chapters.content, kw))) : or(like(schema.chapters.title, kw), like(schema.chapters.synopsis, kw), like(schema.chapters.content, kw)))
    .limit(PER_KIND_LIMIT);
  for (const c of chapters) {
    hits.push({ kind: "chapter", id: c.id, workId: c.workId, title: `【章节】${c.title}`, snippet: buildSnippet([c.content, c.synopsis, c.title], q) });
  }

  // 设定：名称/内容命中
  const ents = await db
    .select({ id: schema.entities.id, workId: schema.entities.workId, type: schema.entities.type, name: schema.entities.name, content: schema.entities.content })
    .from(schema.entities)
    .where(inWork ? and(eq(schema.entities.workId, workId), or(like(schema.entities.name, kw), like(schema.entities.content, kw))) : or(like(schema.entities.name, kw), like(schema.entities.content, kw)))
    .limit(PER_KIND_LIMIT);
  for (const e of ents) {
    hits.push({ kind: "entity", id: e.id, workId: e.workId, title: `【${ENTITY_LABEL[e.type] ?? "设定"}】${e.name}`, snippet: buildSnippet([e.content, e.name], q) });
  }

  // 大纲：标题/内容命中
  const outlines = await db
    .select({ id: schema.outlines.id, workId: schema.outlines.workId, title: schema.outlines.title, content: schema.outlines.content })
    .from(schema.outlines)
    .where(inWork ? and(eq(schema.outlines.workId, workId), or(like(schema.outlines.title, kw), like(schema.outlines.content, kw))) : or(like(schema.outlines.title, kw), like(schema.outlines.content, kw)))
    .limit(PER_KIND_LIMIT);
  for (const o of outlines) {
    hits.push({ kind: "outline", id: o.id, workId: o.workId, title: `【大纲】${o.title}`, snippet: buildSnippet([o.content, o.title], q) });
  }

  // 伏笔：内容命中
  const fs = await db
    .select({ id: schema.foreshadows.id, workId: schema.foreshadows.workId, content: schema.foreshadows.content })
    .from(schema.foreshadows)
    .where(inWork ? and(eq(schema.foreshadows.workId, workId), like(schema.foreshadows.content, kw)) : like(schema.foreshadows.content, kw))
    .limit(PER_KIND_LIMIT);
  for (const f of fs) {
    hits.push({ kind: "foreshadow", id: f.id, workId: f.workId, title: "【伏笔】", snippet: buildSnippet([f.content], q) });
  }

  // 时间线：事件命中
  const tl = await db
    .select({ id: schema.timeline.id, workId: schema.timeline.workId, storyTime: schema.timeline.storyTime, event: schema.timeline.event })
    .from(schema.timeline)
    .where(inWork ? and(eq(schema.timeline.workId, workId), like(schema.timeline.event, kw)) : like(schema.timeline.event, kw))
    .limit(PER_KIND_LIMIT);
  for (const t of tl) {
    hits.push({ kind: "timeline", id: t.id, workId: t.workId, title: `【时间线】${t.storyTime}`, snippet: buildSnippet([t.event], q) });
  }

  // 随笔：标题/内容命中
  const notes = await db
    .select({ id: schema.notes.id, workId: schema.notes.workId, type: schema.notes.type, title: schema.notes.title, content: schema.notes.content })
    .from(schema.notes)
    .where(inWork ? and(eq(schema.notes.workId, workId), or(like(schema.notes.title, kw), like(schema.notes.content, kw))) : or(like(schema.notes.title, kw), like(schema.notes.content, kw)))
    .limit(PER_KIND_LIMIT);
  for (const n of notes) {
    hits.push({ kind: "note", id: n.id, workId: n.workId, title: `【${NOTE_LABEL[n.type] ?? "随笔"}】${n.title || n.content.slice(0, 16)}`, snippet: buildSnippet([n.content, n.title], q) });
  }

  return hits;
}