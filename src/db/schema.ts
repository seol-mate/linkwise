import type { AdapterAccountType } from "@auth/core/adapters";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// 요약/태깅 처리 상태: 저장은 즉시, AI 처리는 비동기로 진행한다.
export const bookmarkStatus = pgEnum("bookmark_status", ["pending", "done", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // Auth.js 어댑터가 요구하는 컬럼 (OAuth 로그인에서는 사용하지 않지만 타입상 필요)
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// OAuth 제공자 연동 정보 (Auth.js 어댑터용). 세션은 JWT라서 sessions 테이블은 두지 않는다.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

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
