import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";

// 이 모듈의 모든 함수는 userId로 범위를 제한한다.
// 호출하는 쪽은 반드시 세션에서 얻은 userId를 넘겨야 하며, 클라이언트가 보낸 값을 쓰지 않는다.

export type BookmarkListItem = {
  id: string;
  url: string;
  title: string | null;
  createdAt: Date;
};

const LIST_LIMIT = 200;

export async function listBookmarks(userId: string): Promise<BookmarkListItem[]> {
  return db
    .select({
      id: bookmarks.id,
      url: bookmarks.url,
      title: bookmarks.title,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))
    .limit(LIST_LIMIT);
}

// 같은 사용자가 이미 같은 normalizedUrl을 저장했다면 null을 반환한다.
export async function createBookmark(userId: string, url: string, normalizedUrl: string): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(bookmarks)
    .values({ userId, url, normalizedUrl })
    .onConflictDoNothing({ target: [bookmarks.userId, bookmarks.normalizedUrl] })
    .returning({ id: bookmarks.id });
  return row ?? null;
}

// 대상이 없거나 다른 사용자의 북마크면 false를 반환한다.
export async function deleteBookmark(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  return rows.length > 0;
}

// title이 빈 문자열이면 제목을 지운다(null). 대상이 없거나 다른 사용자의 북마크면 false.
export async function updateBookmarkTitle(userId: string, id: string, title: string): Promise<boolean> {
  const rows = await db
    .update(bookmarks)
    .set({ title: title === "" ? null : title, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  return rows.length > 0;
}
