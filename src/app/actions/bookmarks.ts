"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { addBookmarkSchema, bookmarkIdSchema, updateTitleSchema } from "@/lib/bookmark-schemas";
import { createBookmark, deleteBookmark, updateBookmarkTitle } from "@/lib/bookmarks";
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

  try {
    const created = await createBookmark(user.id, normalized.url, normalized.normalizedUrl);
    if (!created) {
      return fail("이미 저장된 링크입니다.");
    }
  } catch (error) {
    logFailure("북마크 저장에 실패했습니다.", error);
    return fail(GENERIC_ERROR);
  }

  revalidatePath("/bookmarks");
  return succeed("저장했습니다.");
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
