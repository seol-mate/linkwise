import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { GUEST_NAME, createGuestEmail } from "@/lib/guest";

// AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET 환경 변수는 Auth.js가 자동으로 읽는다.
// 이후 게스트 데모(Credentials)가 DB 세션과 함께 쓸 수 없어서 세션은 JWT 방식으로 둔다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),
  session: { strategy: "jwt" },
  providers: [
    GitHub,
    // 게스트 데모: 입력값 없이 방문마다 새 게스트 사용자를 만든다.
    // Credentials는 어댑터의 createUser를 거치지 않으므로 여기서 직접 저장한다.
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: {},
      async authorize() {
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
