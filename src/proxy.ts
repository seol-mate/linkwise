import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 낙관적 차단: 세션 토큰이 없으면 로그인 페이지로 보낸다.
// 실제 권한 확인은 각 페이지/액션에서 requireUser()로 다시 수행한다.
export async function proxy(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error("AUTH_SECRET 환경 변수가 설정되지 않았습니다.");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const token = await getToken({ req: request, secret });
    if (token) {
      return NextResponse.next();
    }
  } catch (error) {
    console.error("세션 토큰 검증에 실패했습니다.", error instanceof Error ? error.name : "UnknownError");
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/bookmarks/:path*"],
};
