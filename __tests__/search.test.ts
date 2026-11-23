import { describe, expect, it } from "vitest";

import { MAX_TAG_LENGTH } from "@/lib/summary";
import { MAX_QUERY_LENGTH, buildBookmarksHref, escapeLikePattern, hasActiveFilter, parseBookmarkFilters } from "@/lib/search";

describe("parseBookmarkFilters", () => {
  it("검색어와 태그를 읽는다", () => {
    expect(parseBookmarkFilters({ q: "react", tag: "web" })).toEqual({ q: "react", tag: "web" });
  });

  it("값이 없거나 비어 있으면 필터가 없다", () => {
    expect(parseBookmarkFilters({})).toEqual({});
    expect(parseBookmarkFilters({ q: "", tag: "" })).toEqual({});
    expect(parseBookmarkFilters({ q: "   ", tag: "  " })).toEqual({});
  });

  it("공백을 정리하고 태그는 소문자로 바꾼다", () => {
    expect(parseBookmarkFilters({ q: "  next   js  ", tag: "  Next.JS " })).toEqual({ q: "next js", tag: "next.js" });
  });

  it("같은 키가 여러 번 오면 첫 값만 쓴다", () => {
    expect(parseBookmarkFilters({ q: ["a", "b"], tag: ["x", "y"] })).toEqual({ q: "a", tag: "x" });
    expect(parseBookmarkFilters({ q: [] })).toEqual({});
  });

  it("검색어는 최대 길이로 자르고, 너무 긴 태그는 무시한다", () => {
    expect(parseBookmarkFilters({ q: "가".repeat(MAX_QUERY_LENGTH + 50) }).q).toHaveLength(MAX_QUERY_LENGTH);
    expect(parseBookmarkFilters({ tag: "a".repeat(MAX_TAG_LENGTH + 1) })).toEqual({});
    expect(parseBookmarkFilters({ tag: "a".repeat(MAX_TAG_LENGTH) }).tag).toHaveLength(MAX_TAG_LENGTH);
  });
});

describe("escapeLikePattern", () => {
  it("%, _, 역슬래시를 이스케이프한다", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
    expect(escapeLikePattern("c:\\dir")).toBe("c:\\\\dir");
  });

  it("일반 문자는 그대로 둔다", () => {
    expect(escapeLikePattern("react 입문")).toBe("react 입문");
  });

  it("모든 와일드카드를 한 번에 처리한다", () => {
    expect(escapeLikePattern("%_\\")).toBe("\\%\\_\\\\");
  });
});

describe("buildBookmarksHref / hasActiveFilter", () => {
  it("필터가 없으면 기본 경로다", () => {
    expect(buildBookmarksHref({})).toBe("/bookmarks");
  });

  it("검색어와 태그를 쿼리로 만든다 (인코딩 포함)", () => {
    expect(buildBookmarksHref({ q: "next js", tag: "웹" })).toBe(`/bookmarks?q=next+js&tag=${encodeURIComponent("웹")}`);
  });

  it("특수 문자가 쿼리 구조를 깨지 못한다", () => {
    const href = buildBookmarksHref({ q: "a&tag=evil#x" });
    expect(href).toBe("/bookmarks?q=a%26tag%3Devil%23x");
  });

  it("필터 유무를 판단한다", () => {
    expect(hasActiveFilter({})).toBe(false);
    expect(hasActiveFilter({ q: "a" })).toBe(true);
    expect(hasActiveFilter({ tag: "a" })).toBe(true);
  });
});
