import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { signOutAction } from "@/app/actions/auth";
import { listBookmarks } from "@/lib/bookmarks";
import type { BookmarkListItem } from "@/lib/bookmarks";
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
    status: bookmark.status,
    errorMessage: bookmark.errorMessage,
    // 아직 아무 정보도 수집되지 않은 pending 북마크
    collecting: bookmark.status === "pending" && !bookmark.title && !bookmark.description,
    host: getHost(bookmark.url),
    createdLabel: dateFormatter.format(bookmark.createdAt),
  };
}

export default function BookmarksPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <BookmarksContent />
      </Suspense>
    </main>
  );
}

async function BookmarksContent() {
  const user = await requireUser();

  let items: BookmarkListItem[];
  try {
    items = await listBookmarks(user.id);
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

      <BookmarkList items={itemData} />
      <AutoRefresh watchKey={itemData.filter((item) => item.collecting).map((item) => item.id).join(",")} />
    </>
  );
}

function BookmarkList({ items }: { items: BookmarkItemData[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">아직 저장한 링크가 없습니다. 위에 주소를 붙여넣어 첫 링크를 저장해 보세요.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <BookmarkItem key={item.id} bookmark={item} />
      ))}
    </ul>
  );
}
