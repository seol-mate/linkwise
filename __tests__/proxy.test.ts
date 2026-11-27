import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

const SECRET = "test-auth-secret-0123456789abcdef";
const HTTP_COOKIE = "authjs.session-token";
const HTTPS_COOKIE = "__Secure-authjs.session-token";

// Auth.js가 실제로 만드는 것과 같은 방식(쿠키 이름을 salt로)으로 세션 토큰을 만든다.
async function sessionCookie(name: string): Promise<string> {
  const token = await encode({ token: { sub: "user-1", email: "a@example.com" }, secret: SECRET, salt: name });
  return `${name}=${token}`;
}

function request(url: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new NextRequest(url, { headers });
}

function isRedirectToLogin(res: Response): boolean {
  const location = res.headers.get("location");
  return location !== null && new URL(location).pathname === "/login";
}

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("HTTPS에서 __Secure- 세션 쿠키가 있으면 통과시킨다", async () => {
    const res = await proxy(request("https://linkwise.example/bookmarks", await sessionCookie(HTTPS_COOKIE)));
    expect(isRedirectToLogin(res)).toBe(false);
  });

  it("HTTP에서 일반 세션 쿠키가 있으면 통과시킨다", async () => {
    const res = await proxy(request("http://localhost:3000/bookmarks", await sessionCookie(HTTP_COOKIE)));
    expect(isRedirectToLogin(res)).toBe(false);
  });

  it("쿠키가 없으면 /login으로 보낸다", async () => {
    const res = await proxy(request("https://linkwise.example/bookmarks"));
    expect(isRedirectToLogin(res)).toBe(true);
  });

  it("다른 시크릿으로 만든 토큰은 거부한다", async () => {
    const forged = await encode({ token: { sub: "x" }, secret: "another-secret-0123456789abcdef", salt: HTTPS_COOKIE });
    const res = await proxy(request("https://linkwise.example/bookmarks", `${HTTPS_COOKIE}=${forged}`));
    expect(isRedirectToLogin(res)).toBe(true);
  });

  it("AUTH_SECRET이 없으면 /login으로 보낸다", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    const res = await proxy(request("https://linkwise.example/bookmarks", await sessionCookie(HTTPS_COOKIE)));
    expect(isRedirectToLogin(res)).toBe(true);
  });
});
