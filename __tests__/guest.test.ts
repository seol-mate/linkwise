import { describe, expect, it } from "vitest";

import {
  GUEST_EMAIL_DOMAIN,
  GUEST_EMAIL_SUFFIX,
  GUEST_RETENTION_DAYS,
  createGuestEmail,
  guestCutoff,
  isGuestEmail,
} from "@/lib/guest";

describe("guest", () => {
  it("게스트 이메일은 예약 도메인을 사용한다", () => {
    expect(createGuestEmail("abc")).toBe(`guest-abc@${GUEST_EMAIL_DOMAIN}`);
  });

  it("호출할 때마다 서로 다른 이메일을 만든다", () => {
    expect(createGuestEmail()).not.toBe(createGuestEmail());
  });

  it("생성한 게스트 이메일을 게스트로 식별한다", () => {
    expect(isGuestEmail(createGuestEmail())).toBe(true);
  });

  it("대소문자와 무관하게 식별한다", () => {
    expect(isGuestEmail(createGuestEmail("abc").toUpperCase())).toBe(true);
  });

  it("일반 이메일과 빈 값은 게스트가 아니다", () => {
    expect(isGuestEmail("user@example.com")).toBe(false);
    expect(isGuestEmail(`user@evil.${GUEST_EMAIL_DOMAIN}.com`)).toBe(false);
    expect(isGuestEmail(null)).toBe(false);
    expect(isGuestEmail(undefined)).toBe(false);
    expect(isGuestEmail("")).toBe(false);
  });

  it("게스트 이메일 접미사는 도메인과 일치한다", () => {
    expect(GUEST_EMAIL_SUFFIX).toBe(`@${GUEST_EMAIL_DOMAIN}`);
    expect(createGuestEmail("x").endsWith(GUEST_EMAIL_SUFFIX)).toBe(true);
  });
});

describe("guestCutoff (보관 기간)", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("현재 시각에서 보관 일수만큼 이전 시각을 돌려준다", () => {
    const now = new Date("2026-11-23T00:00:00.000Z");
    expect(guestCutoff(now).getTime()).toBe(now.getTime() - GUEST_RETENTION_DAYS * DAY);
  });

  it("인자를 생략하면 현재 시각 기준이다", () => {
    const before = Date.now();
    const cutoff = guestCutoff().getTime();
    expect(cutoff).toBeLessThanOrEqual(before - GUEST_RETENTION_DAYS * DAY + 1000);
    expect(cutoff).toBeGreaterThan(before - GUEST_RETENTION_DAYS * DAY - 5000);
  });

  it("보관 기간은 양수다", () => {
    expect(GUEST_RETENTION_DAYS).toBeGreaterThan(0);
  });
});
