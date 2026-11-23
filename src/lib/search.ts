import { MAX_TAG_LENGTH } from "@/lib/summary";

// 검색/필터 상태는 URL 쿼리(?q=...&tag=...)로 표현한다. 순수 로직만 모아 테스트한다.

export const MAX_QUERY_LENGTH = 100;

export type BookmarkFilters = {
  q?: string;
  tag?: string;
};

type RawParam = string | string[] | undefined;

function firstValue(value: RawParam): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// URL 쿼리는 사용자가 직접 바꿀 수 있는 신뢰할 수 없는 입력이다.
// 잘못된 값은 오류 대신 무시하거나 잘라서 항상 안전한 필터를 돌려준다.
export function parseBookmarkFilters(raw: { q?: RawParam; tag?: RawParam }): BookmarkFilters {
  const q = collapse(firstValue(raw.q)).slice(0, MAX_QUERY_LENGTH);
  const tag = collapse(firstValue(raw.tag)).toLowerCase();

  const filters: BookmarkFilters = {};
  if (q !== "") {
    filters.q = q;
  }
  if (tag !== "" && tag.length <= MAX_TAG_LENGTH) {
    filters.tag = tag;
  }
  return filters;
}

// LIKE/ILIKE에서 %, _, \ 가 와일드카드로 해석되지 않게 이스케이프한다(PostgreSQL 기본 이스케이프 문자는 \).
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function hasActiveFilter(filters: BookmarkFilters): boolean {
  return filters.q !== undefined || filters.tag !== undefined;
}

export function buildBookmarksHref(filters: BookmarkFilters): string {
  const params = new URLSearchParams();
  if (filters.q !== undefined) {
    params.set("q", filters.q);
  }
  if (filters.tag !== undefined) {
    params.set("tag", filters.tag);
  }
  const query = params.toString();
  if (query === "") {
    return "/bookmarks";
  }
  return `/bookmarks?${query}`;
}
