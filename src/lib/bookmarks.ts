import "server-only";

import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookmarkTags, bookmarks, tags } from "@/db/schema";

// 이 모듈의 모든 함수는 userId로 범위를 제한한다.
// 호출하는 쪽은 반드시 세션에서 얻은 userId를 넘겨야 하며, 클라이언트가 보낸 값을 쓰지 않는다.

export type BookmarkListItem = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  summary: string | null;
  tags: string[];
  status: "pending" | "done" | "failed";
  errorMessage: string | null;
  createdAt: Date;
};

const LIST_LIMIT = 200;

export async function listBookmarks(userId: string): Promise<BookmarkListItem[]> {
  const rows = await db
    .select({
      id: bookmarks.id,
      url: bookmarks.url,
      title: bookmarks.title,
      description: bookmarks.description,
      summary: bookmarks.summary,
      status: bookmarks.status,
      errorMessage: bookmarks.errorMessage,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))
    .limit(LIST_LIMIT);

  if (rows.length === 0) {
    return [];
  }

  // 태그는 별도로 조회해 북마크별로 묶는다. tags.userId 조건으로 다른 사용자의 태그는 섞이지 않는다.
  const tagRows = await db
    .select({ bookmarkId: bookmarkTags.bookmarkId, name: tags.name })
    .from(bookmarkTags)
    .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
    .where(
      and(
        eq(tags.userId, userId),
        inArray(
          bookmarkTags.bookmarkId,
          rows.map((row) => row.id),
        ),
      ),
    );

  const tagsByBookmark = new Map<string, string[]>();
  for (const { bookmarkId, name } of tagRows) {
    const list = tagsByBookmark.get(bookmarkId) ?? [];
    list.push(name);
    tagsByBookmark.set(bookmarkId, list);
  }

  return rows.map((row) => ({ ...row, tags: (tagsByBookmark.get(row.id) ?? []).sort() }));
}

// since 이후에 만든 북마크 수 (일일 저장 한도 확인용)
export async function countBookmarksSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), gte(bookmarks.createdAt, since)));
  return row?.total ?? 0;
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

// 수집한 메타데이터를 저장한다. 사용자가 이미 정한 제목은 덮어쓰지 않는다.
// 요약/태깅이 아직 남아 있으므로 status는 pending으로 둔다(done은 그 단계에서 설정).
export async function saveCollectedMetadata(
  userId: string,
  id: string,
  metadata: { title: string | null; description: string | null },
): Promise<boolean> {
  const rows = await db
    .update(bookmarks)
    .set({
      title: sql`coalesce(${bookmarks.title}, ${metadata.title})`,
      description: metadata.description,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  return rows.length > 0;
}

// 요약 처리 없이 완료로 표시한다 (요약이 설정되지 않았거나 요약할 내용이 없는 경우).
export async function markDone(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(bookmarks)
    .set({ status: "done", errorMessage: null, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  return rows.length > 0;
}

// 요약과 태그를 저장하고 status를 done으로 바꾼다.
// 태그 연결 교체와 요약 저장은 db.batch(한 번의 트랜잭션)로 묶어 중간 상태가 남지 않게 한다.
// (neon-http 드라이버는 db.transaction을 지원하지 않는다.)
export async function saveSummary(userId: string, id: string, result: { summary: string; tags: string[] }): Promise<boolean> {
  const [owned] = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .limit(1);
  if (!owned) {
    return false;
  }

  // 태그 생성은 멱등(onConflictDoNothing)이라 batch 밖에서 먼저 처리해도 안전하다.
  let tagIds: string[] = [];
  if (result.tags.length > 0) {
    await db
      .insert(tags)
      .values(result.tags.map((name) => ({ userId, name })))
      .onConflictDoNothing({ target: [tags.userId, tags.name] });
    const tagRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, result.tags)));
    tagIds = tagRows.map((row) => row.id);
  }

  const updateSummary = db
    .update(bookmarks)
    .set({ summary: result.summary, status: "done", errorMessage: null, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
  const clearOldTags = db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id));

  if (tagIds.length === 0) {
    await db.batch([clearOldTags, updateSummary]);
    return true;
  }
  const linkTags = db.insert(bookmarkTags).values(tagIds.map((tagId) => ({ bookmarkId: id, tagId })));
  await db.batch([clearOldTags, linkTags, updateSummary]);
  return true;
}

// message에는 사용자에게 보여줘도 되는 고정 문구만 넣는다(내부 주소·에러 원문 금지).
export async function markCollectionFailed(userId: string, id: string, message: string): Promise<boolean> {
  const rows = await db
    .update(bookmarks)
    .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  return rows.length > 0;
}

// 실패한 수집을 다시 시도하기 위해 pending으로 되돌리고 URL을 돌려준다.
// failed 상태가 아니거나 다른 사용자의 북마크면 null.
export async function resetFailedBookmark(userId: string, id: string): Promise<string | null> {
  const [row] = await db
    .update(bookmarks)
    .set({ status: "pending", errorMessage: null, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId), eq(bookmarks.status, "failed")))
    .returning({ url: bookmarks.url });
  return row?.url ?? null;
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
