import { redirect } from "next/navigation";
import { Suspense } from "react";

import { signInWithGitHub } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">linkwise 로그인</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

async function LoginForm() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/bookmarks");
  }

  return (
    <form action={signInWithGitHub} className="w-full">
      <button
        type="submit"
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        GitHub로 계속하기
      </button>
    </form>
  );
}
