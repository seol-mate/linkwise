"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import type { ActionState } from "@/lib/action-state";
import { addBookmarkSchema, bookmarkIdSchema, updateTitleSchema } from "@/lib/bookmark-schemas";
import { createBookmark, deleteBookmark, resetFailedBookmark, updateBookmarkTitle } from "@/lib/bookmarks";
import { collectBookmark } from "@/lib/collect";
import { requireUser } from "@/lib/session";
import { normalizeUrl } from "@/lib/url";

// 모든 액션은 폼이 로그인 페이지에 있더라도 시작할 때 세션을 다시 확인한다(requireUser).
// requireUser는 redirect를 throw하므로 try/catch 밖에서 호출한다.

const GENERIC_ERROR = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

function fail(message: string): ActionState {
  return { status: "error", message };
}

function succeed(message: string): ActionState {
  return { status: "success", message };
}

// 에러 객체에는 연결 문자열 등이 섞일 수 있어 이름만 로그에 남긴다.
function logFailure(label: string, error: unknown): void {
  console.error(label, error instanceof Error ? error.name : "UnknownError");
}

// 응답 뒤에 수집을 실행한다. collectBookmark는 throw하지 않지만, 예기치 못한 오류도 삼키지 않고 로그를 남긴다.
function scheduleCollection(userId: string, bookmarkId: string, url: string): void {
  after(async () => {
    try {
      await collectBookmark(userId, bookmarkId, url);
    } catch (error) {
      logFailure("북마크 수집 작업이 예기치 않게 실패했습니다.", error);
    }
  });
}

export async function addBookmarkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = addBookmarkSchema.safeParse({ url: formData.get("url") });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "URL을 입력해 주세요.");
  }

  const normalized = normalizeUrl(parsed.data.url);
  if (!normalized.ok) {
    return fail(normalized.error);
  }

  let bookmarkId: string;
  try {
    const created = await createBookmark(user.id, normalized.url, normalized.normalizedUrl);
    if (!created) {
      return fail("이미 저장된 링크입니다.");
    }
    bookmarkId = created.id;
  } catch (error) {
    logFailure("북마크 저장에 실패했습니다.", error);
    return fail(GENERIC_ERROR);
  }

  // 저장은 즉시 끝내고, 외부 페이지 수집은 응답 뒤에 처리한다.
  scheduleCollection(user.id, bookmarkId, normalized.url);

  revalidatePath("/bookmarks");
  return succeed("저장했습니다.");
}

export async function retryCollectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = bookmarkIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  }

  let url: string | null;
  try {
    url = await resetFailedBookmark(user.id, parsed.data.id);
  } catch (error) {
    logFailure("재시도 준비에 실패했습니다.", error);
    return fail(GENERIC_ERROR);
  }
  if (!url) {
    return fail("다시 시도할 수 없는 북마크입니다.");
  }

  scheduleCollection(user.id, parsed.data.id, url);

  revalidatePath("/bookmarks");
  return succeed("다시 수집합니다.");
}

export async function updateBookmarkTitleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updateTitleSchema.safeParse({ id: formData.get("id"), title: formData.get("title") });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  }

  try {
    const updated = await updateBookmarkTitle(user.id, parsed.data.id, parsed.data.title);
    if (!updated) {
      return fail("북마크를 찾을 수 없습니다.");
    }
  } catch (error) {
    logFailure("북마크 수정에 실패했습니다.", error);
    return fail(GENERIC_ERROR);
  }

  revalidatePath("/bookmarks");
  return succeed("수정했습니다.");
}

export async function deleteBookmarkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = bookmarkIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  }

  try {
    const deleted = await deleteBookmark(user.id, parsed.data.id);
    if (!deleted) {
      return fail("이미 삭제되었거나 찾을 수 없는 북마크입니다.");
    }
  } catch (error) {
    logFailure("북마크 삭제에 실패했습니다.", error);
    return fail(GENERIC_ERROR);
  }

  revalidatePath("/bookmarks");
  return succeed("삭제했습니다.");
}
