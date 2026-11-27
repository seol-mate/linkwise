import { describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";

const SECRET = "s3cret-value-1234567890";

describe("isAuthorizedCronRequest", () => {
  it("Bearer <secret> 헤더를 허용한다", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("시크릿이 설정되지 않았으면 어떤 헤더도 거부한다", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
  });

  it("헤더가 없으면 거부한다", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
  });

  it("값이 다르거나 길이가 다르면 거부한다", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET.slice(0, -1)}x`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`bearer ${SECRET}`, SECRET)).toBe(false);
  });

  it("멀티바이트 문자가 섞여도 throw하지 않는다", () => {
    expect(isAuthorizedCronRequest("Bearer 한글한글한글한글", SECRET)).toBe(false);
  });
});
