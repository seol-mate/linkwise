import { describe, expect, it } from "vitest";

import { loginErrorMessage } from "@/lib/login-error";

describe("loginErrorMessage", () => {
  it("에러가 없으면 null이다", () => {
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage("")).toBeNull();
    expect(loginErrorMessage([])).toBeNull();
  });

  it("계정 연결 실패는 가입 방법 안내 문구를 돌려준다", () => {
    expect(loginErrorMessage("OAuthAccountNotLinked")).toContain("다른 방법으로 가입");
  });

  it("알려진 코드마다 서로 다른 문구를 돌려준다", () => {
    const messages = ["OAuthAccountNotLinked", "AccessDenied", "CredentialsSignin", "Configuration"].map((code) => loginErrorMessage(code));
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("알 수 없는 코드는 기본 문구로 대체하고 코드를 노출하지 않는다", () => {
    const message = loginErrorMessage("SomethingNew");
    expect(message).toBe(loginErrorMessage("OAuthCallbackError"));
    expect(message).not.toContain("SomethingNew");
  });

  it("Object 프로토타입 속성 이름도 기본 문구로 처리한다", () => {
    expect(loginErrorMessage("toString")).toBe(loginErrorMessage("unknown"));
    expect(loginErrorMessage("__proto__")).toBe(loginErrorMessage("unknown"));
  });

  it("배열이면 첫 값을 사용한다", () => {
    expect(loginErrorMessage(["AccessDenied", "Configuration"])).toBe(loginErrorMessage("AccessDenied"));
  });
});
