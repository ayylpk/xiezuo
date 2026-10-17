import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import * as schema from "../db/schema";
import { NotFoundError } from "./works";

/**
 * 导出：把一本作品整包成文件。
 * md   = 资料性 Markdown（章节标题 + 简情 + 正文）
 * txt  = 纯文本（无 markdown 符号，可直接丢给其他编辑器）
 * json = 全量结构化数据（作品/章节/设定/大纲/伏笔/时间线/随笔/批注，可重新导入）
 */
export type ExportFormat = "md" | "txt" | "json";

export type WorkBundle = {
  work: schema.Work;
  chapters: schema.Chapter[];
  entities: (typeof schema.entities.$inferSelect)[];
  outlines: (typeof schema.outlines.$inferSelect)[];
  foreshadows: (typeof schema.foreshadows.$inferSelect)[];
  timeline: (typeof schema.timeline.$inferSelect)[];
  notes: (typeof schema.notes.$inferSelect)[];
  annotations: (typeof schema.annotations.$inferSelect)[];
};

async function loadBundle(db: BunSQLiteDatabase<typeof schema>, workId: number): Promise<WorkBundle> {
  const work = await db.query.works.findFirst({ where: eq(schema.works.id, workId) });
  if (!work) throw new NotFoundError("作品不存在");
  const [chapters, entities, outlines, foreshadows, timeline, notes, annotations] = await Promise.all([
    db.select().from(schema.chapters).where(eq(schema.chapters.workId, workId)).orderBy(schema.chapters.sortNo),
    db.select().from(schema.entities).where(eq(schema.entities.workId, workId)).orderBy(schema.entities.sort),
    db.select().from(schema.outlines).where(eq(schema.outlines.workId, workId)).orderBy(schema.outlines.sortNo),
    db.select().from(schema.foreshadows).where(eq(schema.foreshadows.workId, workId)).orderBy(schema.foreshadows.updatedAt),
    db.select().from(schema.timeline).where(eq(schema.timeline.workId, workId)).orderBy(schema.timeline.sortNo),
    db.select().from(schema.notes).where(eq(schema.notes.workId, workId)).orderBy(schema.notes.updatedAt),
    // 批注按实体挂载、无作品列，单用户场景全量带出
    db.select().from(schema.annotations),
  ]);
  return { work, chapters, entities, outlines, foreshadows, timeline, notes, annotations };
}

function toMarkdown(b: WorkBundle): string {
  const lines: string[] = [`# 《${b.work.title}》`];
  if (b.work.description) lines.push("", `> ${b.work.description}`);
  lines.push("");
  for (const ch of b.chapters) {
    lines.push(`## ${ch.title || "（未命名章节）"}`);
    if (ch.synopsis) lines.push("", `> 简情：${ch.synopsis}`);
    lines.push("");
    if (ch.content) lines.push(ch.content.trim());
    lines.push("");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** 纯文本导出：剥掉常见 markdown 符号（粗体/斜体/代码/标题符/引用/链接），只留文字 */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function toPlainText(b: WorkBundle): string {
  const lines: string[] = [`《${b.work.title}》`, ""];
  if (b.work.description) lines.push(stripMarkdown(b.work.description), "");
  for (const ch of b.chapters) {
    lines.push(ch.title || "（未命名章节）");
    if (ch.synopsis) lines.push(stripMarkdown(ch.synopsis));
    lines.push("");
    if (ch.content) lines.push(stripMarkdown(ch.content).trim(), "");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const MIME: Record<ExportFormat, string> = {
  md: "text/markdown",
  txt: "text/plain",
  json: "application/json",
};

export async function exportWork(
  db: BunSQLiteDatabase<typeof schema>,
  workId: number,
  format: ExportFormat,
): Promise<{ filename: string; mime: string; body: string }> {
  const b = await loadBundle(db, workId);
  const body = format === "json" ? JSON.stringify(b, null, 2) : format === "md" ? toMarkdown(b) : toPlainText(b);
  return { filename: `${b.work.title}.${format}`, mime: MIME[format], body };
}