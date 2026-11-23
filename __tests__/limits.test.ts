import { describe, expect, it } from "vitest";

import { createGuestEmail } from "@/lib/guest";
import { GUEST_DAILY_LIMIT, MEMBER_DAILY_LIMIT, dailyBookmarkLimit, isOverDailyLimit } from "@/lib/limits";

describe("일일 저장 한도", () => {
  it("게스트는 낮은 한도, 일반 사용자는 높은 한도를 쓴다", () => {
    expect(dailyBookmarkLimit(createGuestEmail())).toBe(GUEST_DAILY_LIMIT);
    expect(dailyBookmarkLimit("user@example.com")).toBe(MEMBER_DAILY_LIMIT);
    expect(GUEST_DAILY_LIMIT).toBeLessThan(MEMBER_DAILY_LIMIT);
  });

  it("이메일이 없으면 일반 사용자 한도를 적용한다", () => {
    expect(dailyBookmarkLimit(null)).toBe(MEMBER_DAILY_LIMIT);
  });

  it("한도에 도달하면 막고, 그 전까지는 허용한다", () => {
    const guest = createGuestEmail();
    expect(isOverDailyLimit(GUEST_DAILY_LIMIT - 1, guest)).toBe(false);
    expect(isOverDailyLimit(GUEST_DAILY_LIMIT, guest)).toBe(true);
    expect(isOverDailyLimit(GUEST_DAILY_LIMIT + 5, guest)).toBe(true);
    expect(isOverDailyLimit(GUEST_DAILY_LIMIT, "user@example.com")).toBe(false);
  });
});
