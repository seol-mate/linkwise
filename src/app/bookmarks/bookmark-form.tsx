"use client";

import { useActionState, useEffect, useRef } from "react";

import { addBookmarkAction } from "@/app/actions/bookmarks";
import { initialActionState } from "@/lib/action-state";

export function BookmarkForm() {
  const [state, formAction, pending] = useActionState(addBookmarkAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  // 저장에 성공하면 입력창을 비운다.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          name="url"
          required
          maxLength={2048}
          placeholder="https://example.com/article"
          aria-label="저장할 링크 주소"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
