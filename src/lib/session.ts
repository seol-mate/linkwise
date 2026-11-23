import "server-only";

import { redirect, unstable_rethrow } from "next/navigation";

import { auth } from "@/auth";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

// 세션(cookies)을 읽으므로 호출하는 컴포넌트는 반드시 <Suspense> 안에 둔다.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }
    const { id, name, email, image } = session.user;
    return { id, name: name ?? null, email: email ?? null, image: image ?? null };
  } catch (error) {
    // cookies() 접근 시 Next가 던지는 동적 렌더링 신호를 삼키지 않도록 다시 던진다.
    unstable_rethrow(error);
    // 토큰/쿠키 값은 로그에 남기지 않는다.
    console.error("세션 조회에 실패했습니다.", error instanceof Error ? error.name : "UnknownError");
    return null;
  }
}

// 로그인이 필요한 곳에서 사용한다. redirect()는 try/catch 밖에서 호출한다.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
