import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import { db } from "@/db";
import { accounts, users } from "@/db/schema";

// AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET 환경 변수는 Auth.js가 자동으로 읽는다.
// 이후 게스트 데모(Credentials)가 DB 세션과 함께 쓸 수 없어서 세션은 JWT 방식으로 둔다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),
  session: { strategy: "jwt" },
  providers: [GitHub],
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
