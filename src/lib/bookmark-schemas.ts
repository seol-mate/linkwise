import { z } from "zod";

import { MAX_URL_LENGTH } from "@/lib/url";

export const MAX_TITLE_LENGTH = 200;

// URL 형식/정규화는 normalizeUrl이 담당하고, 여기서는 폼 값의 타입과 길이만 검증한다.
export const addBookmarkSchema = z.object({
  url: z.string().min(1, "URL을 입력해 주세요.").max(MAX_URL_LENGTH, `URL은 ${MAX_URL_LENGTH}자 이하여야 합니다.`),
});

export const bookmarkIdSchema = z.object({
  id: z.uuid("올바르지 않은 북마크입니다."),
});

// 빈 문자열은 제목을 지우는 것으로 취급한다.
export const updateTitleSchema = bookmarkIdSchema.extend({
  title: z.string().trim().max(MAX_TITLE_LENGTH, `제목은 ${MAX_TITLE_LENGTH}자 이하여야 합니다.`),
});
