import Link from "next/link";
import { Suspense } from "react";

import { signOutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">linkwise</h1>
      <p className="text-zinc-600 dark:text-zinc-400">링크를 저장하면 자동으로 요약하고 태그를 붙여주는 북마크 서비스</p>
      <Suspense fallback={<div className="h-9" />}>
        <AuthActions />
      </Suspense>
    </main>
  );
}

async function AuthActions() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        로그인
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/bookmarks" className="text-sm font-medium underline underline-offset-4">
        {user.name ?? user.email ?? "내 북마크"}
      </Link>
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          로그아웃
        </button>
      </form>
    </div>
  );
}
