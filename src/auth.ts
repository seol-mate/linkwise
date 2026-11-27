import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { GUEST_NAME, createGuestEmail } from "@/lib/guest";
import { cleanupStaleGuests } from "@/lib/guest-cleanup";

// AUTH_SECRET, AUTH_GITHUB_*, AUTH_GOOGLE_* 환경 변수는 Auth.js가 자동으로 읽는다.
// 이후 게스트 데모(Credentials)가 DB 세션과 함께 쓸 수 없어서 세션은 JWT 방식으로 둔다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),
  session: { strategy: "jwt" },
  providers: [
    GitHub,
    // Google은 이메일 소유를 검증하므로, 같은 이메일의 기존 계정(예: GitHub)에 자동으로 연결한다.
    // 이메일을 검증하지 않을 수 있는 provider에는 이 옵션을 켜지 않는다.
    Google({ allowDangerousEmailAccountLinking: true }),
    // 게스트 데모: 입력값 없이 방문마다 새 게스트 사용자를 만든다.
    // Credentials는 어댑터의 createUser를 거치지 않으므로 여기서 직접 저장한다.
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: {},
      async authorize() {
        // 오래된 게스트를 먼저 정리한다. 정리에 실패해도 로그인은 막지 않는다.
        await cleanupStaleGuests();

        try {
          const [guest] = await db
            .insert(users)
            .values({ email: createGuestEmail(), name: GUEST_NAME })
            .returning({ id: users.id, name: users.name, email: users.email });
          return guest ?? null;
        } catch (error) {
          console.error("게스트 사용자 생성에 실패했습니다.", error instanceof Error ? error.name : "UnknownError");
          return null;
        }
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    // 최초 로그인 시 user는 DB 사용자이며, token.sub에 사용자 id가 들어간다.
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
