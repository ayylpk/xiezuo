import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

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

// 关系注册：db.query.* 的 with 查询依赖它（drizzle relational query）
export const workRelations = relations(works, ({ many }) => ({
  chapters: many(chapters),
}));

export const chapterRelations = relations(chapters, ({ one }) => ({
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