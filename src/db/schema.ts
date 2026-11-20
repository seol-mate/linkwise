import { index, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// 요약/태깅 처리 상태: 저장은 즉시, AI 처리는 비동기로 진행한다.
export const bookmarkStatus = pgEnum("bookmark_status", ["pending", "done", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // 중복 감지용 정규화 URL (추적 파라미터/해시 제거 등)
    normalizedUrl: text("normalized_url").notNull(),
    title: text("title"),
    description: text("description"),
    summary: text("summary"),
    status: bookmarkStatus("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("bookmarks_user_normalized_url_unique").on(t.userId, t.normalizedUrl),
    index("bookmarks_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [unique("tags_user_name_unique").on(t.userId, t.name)],
);

export const bookmarkTags = pgTable(
  "bookmark_tags",
  {
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookmarkId, t.tagId] })],
);

export type User = typeof users.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Tag = typeof tags.$inferSelect;
