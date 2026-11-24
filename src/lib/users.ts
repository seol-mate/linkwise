import "server-only";

import { and, asc, eq, inArray, like, lt } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { GUEST_EMAIL_SUFFIX } from "@/lib/guest";

export async function userExists(id: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return row !== undefined;
}

const DEFAULT_CLEANUP_BATCH = 100;

// cutoff보다 먼저 만들어진 게스트 사용자를 삭제하고, 삭제한 수를 돌려준다.
// bookmarks/tags/accounts는 FK onDelete cascade로 함께 삭제된다.
// - 대상은 게스트 이메일 도메인(실존할 수 없는 .invalid)으로 끝나는 사용자뿐이다.
// - 한 번에 limit명까지만 지워 로그인 요청의 지연을 제한한다(오래된 순).
export async function deleteStaleGuests(cutoff: Date, limit: number = DEFAULT_CLEANUP_BATCH): Promise<number> {
  const stale = db
    .select({ id: users.id })
    .from(users)
    .where(and(like(users.email, `%${GUEST_EMAIL_SUFFIX}`), lt(users.createdAt, cutoff)))
    .orderBy(asc(users.createdAt))
    .limit(limit);

  const deleted = await db.delete(users).where(inArray(users.id, stale)).returning({ id: users.id });
  return deleted.length;
}
