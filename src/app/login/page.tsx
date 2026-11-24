import { redirect } from "next/navigation";
import { Suspense } from "react";

import { signInAsGuest, signInWithGitHub, signInWithGoogle } from "@/app/actions/auth";
import { GitHubIcon } from "@/components/icons/github-icon";
import { GoogleIcon } from "@/components/icons/google-icon";
import { GUEST_RETENTION_DAYS } from "@/lib/guest";
import { getCurrentUser } from "@/lib/session";

type SearchParams = Promise<{ error?: string | string[] }>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">linkwise 로그인</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginForm({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/bookmarks");
  }

  const { error } = await searchParams;

  return (
    <div className="flex w-full flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
      <form action={signInWithGitHub}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {/* 라이트: 검정 배경 + 흰색 로고, 다크: 흰 배경 + 검정 로고 */}
          <GitHubIcon variant="white" className="size-4 dark:hidden" />
          <GitHubIcon variant="black" className="hidden size-4 dark:block" />
          GitHub로 계속하기
        </button>
      </form>
      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <GoogleIcon className="size-4" />
          Google로 계속하기
        </button>
      </form>
      <form action={signInAsGuest}>
        <button
          type="submit"
          className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          게스트로 체험하기
        </button>
      </form>
      <p className="text-xs text-zinc-500">
        게스트 데이터는 로그아웃 후 다시 접근할 수 없으며, {GUEST_RETENTION_DAYS}일 후 삭제됩니다.
      </p>
    </div>
  );
}
