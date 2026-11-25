// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { failStalePendingBookmarks } from "@/lib/bookmarks";
import { STALE_PENDING_MESSAGE, STALE_PENDING_MS, stalePendingCutoff } from "@/lib/stale";

// 실제 DB에 연결하지 않는다. Drizzle(pg-proxy)이 만든 SQL과 파라미터를 가로채서 검증한다.
const mock = vi.hoisted(() => ({
  calls: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const db = drizzle(async (sql, params) => {
    mock.calls.push({ sql, params });
    return { rows: mock.rows };
  });
  return { db };
});

beforeEach(() => {
  mock.calls = [];
  mock.rows = [];
});

describe("stalePendingCutoff", () => {
  it("현재 시각에서 제한 시간만큼 이전 시각을 돌려준다", () => {
    const now = new Date("2026-11-25T12:00:00.000Z");
    expect(stalePendingCutoff(now).getTime()).toBe(now.getTime() - STALE_PENDING_MS);
  });

  it("제한 시간은 AI 요약 최악 소요(타임아웃 60초 × 3회)보다 길다", () => {
    expect(STALE_PENDING_MS).toBeGreaterThan(3 * 60 * 1000);
  });
});

describe("failStalePendingBookmarks", () => {
  const cutoff = new Date("2026-11-25T11:50:00.000Z");
  const userId = "user-1";

  it("바꾼 북마크 수를 돌려준다", async () => {
    mock.rows = [["a"], ["b"]];
    expect(await failStalePendingBookmarks(userId, cutoff)).toBe(2);
  });

  it("대상이 없으면 0을 돌려준다", async () => {
    expect(await failStalePendingBookmarks(userId, cutoff)).toBe(0);
  });

  it("failed로 바꾸고 고정 안내 문구를 저장한다", async () => {
    await failStalePendingBookmarks(userId, cutoff);

    expect(mock.calls).toHaveLength(1);
    const { sql, params } = mock.calls[0];
    expect(sql).toMatch(/^update "bookmarks" set "status" = \$1, "error_message" = \$2/);
    expect(params.slice(0, 2)).toEqual(["failed", STALE_PENDING_MESSAGE]);
  });

  it("본인의 pending 북마크 중 cutoff 이전에 갱신된 것만 조건으로 건다", async () => {
    await failStalePendingBookmarks(userId, cutoff);

    const { sql, params } = mock.calls[0];
    const where = sql.slice(sql.indexOf(" where "));
    expect(where).toMatch(/"bookmarks"\."user_id" = \$\d+ and "bookmarks"\."status" = \$\d+ and "bookmarks"\."updated_at" < \$\d+/);
    expect(where).not.toMatch(/\bor\b/);
    expect(params).toContain(userId);
    expect(params).toContain("pending");
    expect(params).toContain(cutoff.toISOString());
  });
});
