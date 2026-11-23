import { describe, expect, it } from "vitest";

import { GUEST_EMAIL_DOMAIN, createGuestEmail, isGuestEmail } from "@/lib/guest";

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
});
