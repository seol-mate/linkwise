import { describe, expect, it } from "vitest";

import { MAX_TITLE_LENGTH, addBookmarkSchema, bookmarkIdSchema, updateTitleSchema } from "@/lib/bookmark-schemas";

const VALID_ID = "3f2c8f4e-9a4b-4c1e-8f3a-1b2c3d4e5f60";

describe("addBookmarkSchema", () => {
  it("문자열 URL을 통과시킨다", () => {
    expect(addBookmarkSchema.safeParse({ url: "https://example.com" }).success).toBe(true);
  });

  it("빈 값, null, 파일 같은 비문자열을 거부한다", () => {
    expect(addBookmarkSchema.safeParse({ url: "" }).success).toBe(false);
    expect(addBookmarkSchema.safeParse({ url: null }).success).toBe(false);
    expect(addBookmarkSchema.safeParse({}).success).toBe(false);
  });
});

describe("bookmarkIdSchema", () => {
  it("uuid만 통과시킨다", () => {
    expect(bookmarkIdSchema.safeParse({ id: VALID_ID }).success).toBe(true);
    expect(bookmarkIdSchema.safeParse({ id: "1 OR 1=1" }).success).toBe(false);
    expect(bookmarkIdSchema.safeParse({ id: "" }).success).toBe(false);
  });
});

describe("updateTitleSchema", () => {
  it("제목 앞뒤 공백을 제거한다", () => {
    const result = updateTitleSchema.safeParse({ id: VALID_ID, title: "  제목  " });
    expect(result.success && result.data.title).toBe("제목");
  });

  it("빈 제목을 허용한다 (제목 지우기)", () => {
    const result = updateTitleSchema.safeParse({ id: VALID_ID, title: "   " });
    expect(result.success && result.data.title).toBe("");
  });

  it("최대 길이를 넘는 제목을 거부한다", () => {
    expect(updateTitleSchema.safeParse({ id: VALID_ID, title: "a".repeat(MAX_TITLE_LENGTH + 1) }).success).toBe(false);
  });

  it("잘못된 id를 거부한다", () => {
    expect(updateTitleSchema.safeParse({ id: "x", title: "제목" }).success).toBe(false);
  });
});
