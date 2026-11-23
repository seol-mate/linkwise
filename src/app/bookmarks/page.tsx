import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { signOutAction } from "@/app/actions/auth";
import { listBookmarks, listTagCounts } from "@/lib/bookmarks";
import type { BookmarkListItem, TagCount } from "@/lib/bookmarks";
import { MAX_QUERY_LENGTH, buildBookmarksHref, hasActiveFilter, parseBookmarkFilters } from "@/lib/search";
import type { BookmarkFilters } from "@/lib/search";
import { requireUser } from "@/lib/session";

import { AutoRefresh } from "./auto-refresh";
import { BookmarkForm } from "./bookmark-form";
import { BookmarkItem } from "./bookmark-item";
import type { BookmarkItemData } from "./bookmark-item";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

// 저장된 url은 검증을 거친 값이지만, 파싱에 실패하면 원본을 그대로 보여준다.
function getHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function toItemData(bookmark: BookmarkListItem): BookmarkItemData {
  return {
    id: bookmark.id,
    url: bookmark.url,
    title: bookmark.title,
    description: bookmark.description,
    summary: bookmark.summary,
    tags: bookmark.tags,
    status: bookmark.status,
    errorMessage: bookmark.errorMessage,
    // 수집·요약이 끝나기 전(pending)이면 진행 중으로 본다.
    collecting: bookmark.status === "pending",
    host: getHost(bookmark.url),
    createdLabel: dateFormatter.format(bookmark.createdAt),
  };
}

type SearchParams = Promise<{ q?: string | string[]; tag?: string | string[] }>;

export default function BookmarksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <BookmarksContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BookmarksContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  // URL 쿼리는 사용자가 바꿀 수 있는 입력이므로 검증·정리한 값만 사용한다.
  const filters = parseBookmarkFilters(await searchParams);

  let items: BookmarkListItem[];
  let tagCounts: TagCount[];
  try {
    [items, tagCounts] = await Promise.all([listBookmarks(user.id, filters), listTagCounts(user.id)]);
  } catch (error) {
    // Next의 동적 렌더링 신호는 삼키지 않고 다시 던진다.
    unstable_rethrow(error);
    console.error("북마크 목록을 불러오지 못했습니다.", error instanceof Error ? error.name : "UnknownError");
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        북마크 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const itemData = items.map(toItemData);

  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">내 북마크</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            홈
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <BookmarkForm />

      <SearchBar filters={filters} />
      <TagFilter tags={tagCounts} filters={filters} />

      <BookmarkList items={itemData} filters={filters} />
      <AutoRefresh watchKey={itemData.filter((item) => item.collecting).map((item) => item.id).join(",")} />
    </>
  );
}

// GET 폼이라 JS 없이 동작하고, 검색 상태가 URL에 남는다. 태그 필터는 hidden 값으로 유지한다.
function SearchBar({ filters }: { filters: BookmarkFilters }) {
  return (
    <form action="/bookmarks" method="get" role="search" className="flex gap-2">
      {filters.tag !== undefined ? <input type="hidden" name="tag" value={filters.tag} /> : null}
      <input
        type="search"
        name="q"
        defaultValue={filters.q ?? ""}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="제목, 요약, 태그, 주소로 검색"
        aria-label="북마크 검색"
        className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
      />
      <button
        type="submit"
        className="shrink-0 rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        검색
      </button>
    </form>
  );
}

function TagFilter({ tags, filters }: { tags: TagCount[]; filters: BookmarkFilters }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <nav aria-label="태그 필터">
      <ul className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const active = filters.tag === tag.name;
          // 선택된 태그를 다시 누르면 태그 필터만 해제한다(검색어는 유지).
          const href = buildBookmarksHref({ q: filters.q, tag: active ? undefined : tag.name });
          const style = active
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700";
          return (
            <li key={tag.name}>
              <Link
                href={href}
                prefetch={false}
                aria-current={active ? "true" : undefined}
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${style}`}
              >
                {tag.name} <span className="opacity-60">{tag.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BookmarkList({ items, filters }: { items: BookmarkItemData[]; filters: BookmarkFilters }) {
  if (items.length === 0 && hasActiveFilter(filters)) {
    return (
      <p className="text-sm text-zinc-500">
        조건에 맞는 북마크가 없습니다.{" "}
        <Link href="/bookmarks" className="underline underline-offset-4">
          필터 초기화
        </Link>
      </p>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">아직 저장한 링크가 없습니다. 위에 주소를 붙여넣어 첫 링크를 저장해 보세요.</p>;
  }

  return (
    <section className="flex flex-col gap-2">
      {hasActiveFilter(filters) ? (
        <p className="text-xs text-zinc-500">
          검색 결과 {items.length}개 ·{" "}
          <Link href="/bookmarks" className="underline underline-offset-4">
            필터 초기화
          </Link>
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <BookmarkItem key={item.id} bookmark={item} />
        ))}
      </ul>
    </section>
  );
}
