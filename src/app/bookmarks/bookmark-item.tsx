"use client";

import { useActionState } from "react";

import { deleteBookmarkAction, retryCollectionAction, updateBookmarkTitleAction } from "@/app/actions/bookmarks";
import { initialActionState } from "@/lib/action-state";

export type BookmarkItemData = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  status: "pending" | "done" | "failed";
  errorMessage: string | null;
  collecting: boolean;
  host: string;
  createdLabel: string;
};

export function BookmarkItem({ bookmark }: { bookmark: BookmarkItemData }) {
  const [editState, editAction, editPending] = useActionState(updateBookmarkTitleAction, initialActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteBookmarkAction, initialActionState);
  const [retryState, retryAction, retryPending] = useActionState(retryCollectionAction, initialActionState);

  const errorMessage = [editState, deleteState, retryState].find((state) => state.status === "error")?.message;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* url은 서버에서 http/https만 허용해 저장하므로 javascript: 등이 들어올 수 없다. */}
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium underline-offset-4 hover:underline"
          >
            {bookmark.title ?? bookmark.url}
          </a>
          {/* 수집한 설명은 외부 데이터이므로 텍스트로만 렌더링한다(React가 이스케이프). */}
          {bookmark.description ? <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{bookmark.description}</p> : null}
          <p className="truncate text-xs text-zinc-500">
            {bookmark.host} · {bookmark.createdLabel}
            {bookmark.collecting ? " · 정보 수집 중…" : ""}
          </p>
        </div>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={bookmark.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="shrink-0 text-xs text-zinc-500 hover:text-red-600 disabled:opacity-50"
          >
            {deletePending ? "삭제 중…" : "삭제"}
          </button>
        </form>
      </div>

      {bookmark.status === "failed" ? (
        <form action={retryAction} className="flex items-center gap-2 text-xs">
          <input type="hidden" name="id" value={bookmark.id} />
          <span className="text-amber-700 dark:text-amber-400">정보 수집 실패{bookmark.errorMessage ? `: ${bookmark.errorMessage}` : ""}</span>
          <button type="submit" disabled={retryPending} className="underline underline-offset-4 disabled:opacity-50">
            {retryPending ? "요청 중…" : "다시 시도"}
          </button>
        </form>
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-zinc-500">제목 수정</summary>
        <form action={editAction} className="mt-2 flex gap-2">
          <input type="hidden" name="id" value={bookmark.id} />
          <input
            type="text"
            name="title"
            defaultValue={bookmark.title ?? ""}
            maxLength={200}
            placeholder="제목 (비우면 주소로 표시)"
            aria-label="북마크 제목"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={editPending}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {editPending ? "저장 중…" : "저장"}
          </button>
        </form>
      </details>

      {errorMessage ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}
    </li>
  );
}
