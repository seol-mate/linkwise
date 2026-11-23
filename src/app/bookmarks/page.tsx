import { Suspense } from "react";

import { requireUser } from "@/lib/session";

// 북마크 CRUD 구현 전까지의 자리 표시용 페이지. 로그인한 사용자만 접근할 수 있다.
export default function BookmarksPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-3 p-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <BookmarksContent />
      </Suspense>
    </main>
  );
}

async function BookmarksContent() {
  const user = await requireUser();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">내 북마크</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{user.name ?? user.email} 님, 환영합니다. 북마크 기능은 준비 중입니다.</p>
    </>
  );
}
