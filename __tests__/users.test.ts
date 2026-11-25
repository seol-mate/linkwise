// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GUEST_EMAIL_SUFFIX } from "@/lib/guest";
import { deleteStaleGuests, userExists } from "@/lib/users";

// 실제 DB에 연결하지 않는다. Drizzle(pg-proxy)이 만든 SQL과 파라미터를 가로채서 검증한다.
const mock = vi.hoisted(() => ({
  calls: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  error: null as Error | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const db = drizzle(async (sql, params) => {
    mock.calls.push({ sql, params });
    if (mock.error) {
      throw mock.error;
    }
    return { rows: mock.rows };
  });
  return { db };
});

beforeEach(() => {
  mock.calls = [];
  mock.rows = [];
  mock.error = null;
});

describe("userExists", () => {
  it("사용자가 있으면 true, 없으면 false", async () => {
    mock.rows = [["user-1"]];
    expect(await userExists("user-1")).toBe(true);

    mock.rows = [];
    expect(await userExists("missing")).toBe(false);
  });

  it("id로만 조회하고 1건으로 제한한다", async () => {
    await userExists("user-1");

    expect(mock.calls).toHaveLength(1);
    const { sql, params } = mock.calls[0];
    expect(sql).toMatch(/from "users" where "users"\."id" = \$1 limit \$2/);
    expect(params).toEqual(["user-1", 1]);
  });
});

describe("deleteStaleGuests", () => {
  const cutoff = new Date("2026-11-17T00:00:00.000Z");

  it("삭제한 사용자 수를 돌려준다", async () => {
    mock.rows = [["a"], ["b"], ["c"]];
    expect(await deleteStaleGuests(cutoff)).toBe(3);
  });

  it("삭제 대상이 없으면 0을 돌려준다", async () => {
    expect(await deleteStaleGuests(cutoff)).toBe(0);
  });

  it("쿼리 한 번으로 DELETE ... RETURNING을 실행한다", async () => {
    await deleteStaleGuests(cutoff);

    expect(mock.calls).toHaveLength(1);
    const { sql } = mock.calls[0];
    expect(sql).toMatch(/^delete from "users" where "users"\."id" in \(select/);
    expect(sql).toMatch(/returning "id"$/);
  });

  it("게스트 이메일 접미사와 cutoff 이전 생성 조건을 함께 건다", async () => {
    await deleteStaleGuests(cutoff);

    const { sql, params } = mock.calls[0];
    expect(sql).toContain('"users"."email" like');
    expect(sql).toContain('"users"."created_at" <');
    expect(params).toContain(`%${GUEST_EMAIL_SUFFIX}`);
    expect(params).toContain(cutoff.toISOString());
  });

  it("조건이 AND로 묶여 일반 사용자는 대상이 되지 않는다", async () => {
    await deleteStaleGuests(cutoff);

    const { sql } = mock.calls[0];
    const where = sql.slice(sql.indexOf("where", sql.indexOf("(select")));
    expect(where).toMatch(/like \$\d+ and "users"\."created_at" < \$\d+/);
    expect(where).not.toMatch(/\bor\b/);
  });

  it("오래된 순으로 기본 100명까지만 지운다", async () => {
    await deleteStaleGuests(cutoff);

    const { sql, params } = mock.calls[0];
    expect(sql).toMatch(/order by "users"\."created_at" asc limit \$\d+/);
    expect(params).toContain(100);
  });

  it("limit 인자로 한 번에 지우는 수를 바꿀 수 있다", async () => {
    await deleteStaleGuests(cutoff, 5);

    expect(mock.calls[0].params).toContain(5);
    expect(mock.calls[0].params).not.toContain(100);
  });

  it("DB 오류는 삼키지 않고 호출자에게 전달한다", async () => {
    mock.error = new Error("db down");
    await expect(deleteStaleGuests(cutoff)).rejects.toThrow();
  });
});
