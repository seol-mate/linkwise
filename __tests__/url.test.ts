import { describe, expect, it } from "vitest";

import { MAX_URL_LENGTH, normalizeUrl } from "@/lib/url";

function normalized(input: string): string {
  const result = normalizeUrl(input);
  if (!result.ok) {
    throw new Error(`정규화 실패: ${result.error}`);
  }
  return result.normalizedUrl;
}

describe("normalizeUrl - 정규화", () => {
  it("호스트를 소문자로, 해시를 제거한다", () => {
    expect(normalized("https://Example.COM/Path#section")).toBe("https://example.com/Path");
  });

  it("추적 파라미터(utm_*, fbclid 등)를 제거한다", () => {
    expect(normalized("https://example.com/a?utm_source=x&utm_medium=y&fbclid=z&id=1")).toBe("https://example.com/a?id=1");
  });

  it("쿼리 파라미터를 정렬해 순서가 달라도 같은 값이 된다", () => {
    expect(normalized("https://example.com/a?b=2&a=1")).toBe(normalized("https://example.com/a?a=1&b=2"));
  });

  it("경로 끝의 슬래시 유무를 같게 본다", () => {
    expect(normalized("https://example.com/a/")).toBe(normalized("https://example.com/a"));
  });

  it("루트 경로는 슬래시를 유지한다", () => {
    expect(normalized("https://example.com")).toBe("https://example.com/");
    expect(normalized("https://example.com//")).toBe("https://example.com/");
  });

  it("기본 포트는 제거하고 그 외 포트는 유지한다", () => {
    expect(normalized("http://example.com:80/a")).toBe("http://example.com/a");
    expect(normalized("https://example.com:8443/a")).toBe("https://example.com:8443/a");
  });

  it("스킴이 없으면 https를 붙인다", () => {
    const result = normalizeUrl("example.com/path");
    expect(result).toEqual({ ok: true, url: "https://example.com/path", normalizedUrl: "https://example.com/path" });
  });

  it("스킴이 없고 포트가 있어도 https를 붙인다", () => {
    expect(normalized("example.com:8080/a")).toBe("https://example.com:8080/a");
  });

  it("원본 url에는 해시와 추적 파라미터를 그대로 보존한다", () => {
    const result = normalizeUrl("https://example.com/a?utm_source=x#top");
    expect(result.ok && result.url).toBe("https://example.com/a?utm_source=x#top");
  });

  it("앞뒤 공백을 제거한다", () => {
    expect(normalized("  https://example.com/a  ")).toBe("https://example.com/a");
  });
});

describe("normalizeUrl - 거부", () => {
  it.each([
    ["빈 문자열", ""],
    ["공백만", "   "],
    ["javascript 스킴", "javascript:alert(1)"],
    ["data 스킴", "data:text/html,<script>alert(1)</script>"],
    ["ftp 스킴", "ftp://example.com/file"],
    ["file 스킴", "file:///etc/passwd"],
    ["mailto 스킴", "mailto:a@example.com"],
    ["인증 정보 포함", "https://user:pass@example.com/"],
    ["아이디만 포함", "https://user@example.com/"],
    ["공백이 든 호스트", "https://not a url"],
  ])("%s는 거부한다", (_label, input) => {
    expect(normalizeUrl(input).ok).toBe(false);
  });

  it("최대 길이를 넘으면 거부한다", () => {
    const longUrl = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}`;
    expect(normalizeUrl(longUrl).ok).toBe(false);
  });

  it("거부 시 사용자용 메시지를 돌려준다", () => {
    const result = normalizeUrl("javascript:alert(1)");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.length).toBeGreaterThan(0);
  });
});
