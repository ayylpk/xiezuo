import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations as drizzleRelations } from "drizzle-orm";

// 时间统一用 epoch 毫秒整数（Date.now() 直通，避免字符串时区歧义）

/** 用户：单用户产品，但保留表结构，未来可扩展 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // Bun.password 哈希，永不明文
  createdAt: integer("created_at").notNull(),
});

/** 会话：cookie 里只放 sid，服务端可随时吊销 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // 随机 32 字节 hex，= cookie 值
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** 作品（书架上的"一本书"） */
export const works = sqliteTable("works", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""), // 一句话简介
  status: text("status").notNull().default("ongoing"), // ongoing 连载 | finished 完结 | shelved 搁置
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** 章节卡：状态机 = 草稿 → 已写 → 待审查 → 已定稿（另有"待扩写"态） */
export const chapters = sqliteTable("chapters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workId: integer("work_id")
    .notNull()
    .references(() => works.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  synopsis: text("synopsis").notNull().default(""), // 每章简要剧情
  content: text("content").notNull().default(""), // 正文 markdown
  status: text("status").notNull().default("draft"), // draft | written | review | final
  wordCount: integer("word_count").notNull().default(0), // 正文实时统计，写入时服务端重算
  sortNo: integer("sort_no").notNull().default(0), // 章序
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ---------- M2：设定库 / 大纲 / 伏笔 / 时间线 ----------

/**
 * 设定实体：统一模型，type 区分人物/场景/世界观/灵感碎片。
 * extra 为 JSON 结构化扩展（人物卡的外貌/性格等表单字段），通用条目为 null。
 */
export const entities = sqliteTable("entities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workId: integer("work_id")
    .notNull()
    .references(() => works.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("character"), // character | scene | world | idea
  name: text("name").notNull(),
  content: text("content").notNull().default(""), // markdown 描述/正文
  extra: text("extra", { mode: "json" }).$type<Record<string, string> | null>().notNull().default(null),
  sort: integer("sort").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** 关系网：从实体 → 到实体 */
export const relations = sqliteTable("relations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workId: integer("work_id")
    .notNull()
    .references(() => works.id, { onDelete: "cascade" }),
  fromId: integer("from_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  toId: integer("to_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  relType: text("rel_type").notNull(), // 如 青梅竹马/敌对/师徒
  note: text("note").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

/** 大纲树：parent_id + sort 邻接表（卷→章→细纲） */
export const outlines = sqliteTable("outlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workId: integer("work_id")
    .notNull()
    .references(() => works.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"), // null = 卷级根节点
  title: text("title").notNull(),
  content: text("content").notNull().default(""), // 细纲 markdown
  sortNo: integer("sort_no").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** 伏笔台账：埋设/回收可关联具体章节 */
export const foreshadows = sqliteTable("foreshadows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workId: integer("work_id")
    .notNull()
    .references(() => works.id, { onDelete: "cascade" }),
  content: text("content").notNull(), // 伏笔是什么、计划怎么收
  plantedChapterId: integer("planted_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  revealChapterId: integer("reveal_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  status: text("status").notNull().default("open"), // open 未收 | closed 已收 | dropped 废弃
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** 故事时间线：事件挂在作品下，可关联章节 */
export const timeline = sqliteTable("timeline", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workId: integer("work_id")
    .notNull()
    .references(() => works.id, { onDelete: "cascade" }),
  storyTime: text("story_time").notNull(), // 自由文本："第 3 年冬"
  event: text("event").notNull(), // 事件描述 markdown
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  sortNo: integer("sort_no").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ---------- M3：批注 / 随笔 ----------

/** 通用批注：挂在任意内容实体上（章节/设定/大纲/伏笔/事件/随笔） */
export const annotations = sqliteTable("annotations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(), // chapter | entity | outline | foreshadow | timeline | note
  entityId: integer("entity_id").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** 随笔：note 阅读感想 | idea 灵感闪念 | graveyard 废弃段落 */
export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workId: integer("work_id")
    .notNull()
    .references(() => works.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("note"), // note | idea | graveyard
  title: text("title").notNull().default(""),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const NOTE_TYPES = {
  note: "随笔",
  idea: "灵感",
  graveyard: "废弃段落",
} as const;
export type NoteType = keyof typeof NOTE_TYPES;

/** 批注可挂载的实体类型白名单 → 查存在性用的表 */
export const ANNOTATION_TARGETS = {
  chapter: "chapters",
  entity: "entities",
  outline: "outlines",
  foreshadow: "foreshadows",
  timeline: "timeline",
  note: "notes",
} as const;
export type AnnotationTarget = keyof typeof ANNOTATION_TARGETS;

export const ENTITY_TYPES = {
  character: "人物",
  scene: "场景",
  world: "世界观",
  idea: "灵感碎片",
} as const;
export type EntityType = keyof typeof ENTITY_TYPES;

export const FORESHADOW_STATUS = {
  open: "未收",
  closed: "已收",
  dropped: "废弃",
} as const;
export type ForeshadowStatus = keyof typeof FORESHADOW_STATUS;

// ---------- 关系注册（db.query.* 的 with 查询依赖） ----------
export const workRelations = drizzleRelations(works, ({ many }) => ({
  chapters: many(chapters),
  entities: many(entities),
  outlines: many(outlines),
  foreshadows: many(foreshadows),
  timeline: many(timeline),
  entityLinks: many(relations),
}));

export const chapterRelations = drizzleRelations(chapters, ({ one }) => ({
  work: one(works, { fields: [chapters.workId], references: [works.id] }),
}));

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Work = typeof works.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;

/** 章节状态机枚举（前后端共享的口径，shared/ 后续收编） */
export const CHAPTER_STATUS = {
  draft: "草稿",
  written: "已写",
  review: "待审查",
  final: "已定稿",
} as const;
export type ChapterStatus = keyof typeof CHAPTER_STATUS;

export const WORK_STATUS = {
  ongoing: "连载",
  finished: "完结",
  shelved: "搁置",
} as const;
export type WorkStatus = keyof typeof WORK_STATUS;