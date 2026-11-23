import "server-only";

import { isAiConfigured, summarizePage } from "@/lib/ai";
import { markCollectionFailed, markDone, saveCollectedMetadata, saveSummary } from "@/lib/bookmarks";
import { extractMetadata } from "@/lib/metadata";
import type { PageMetadata } from "@/lib/metadata";
import { safeFetch } from "@/lib/safe-fetch";

// 에러 객체에는 연결 문자열·내부 주소 등이 섞일 수 있어 이름만 로그에 남긴다.
function logFailure(label: string, error: unknown): void {
  console.error(label, error instanceof Error ? error.name : "UnknownError");
}

async function recordFailure(userId: string, bookmarkId: string, message: string): Promise<void> {
  try {
    await markCollectionFailed(userId, bookmarkId, message);
  } catch (error) {
    logFailure("수집 실패 상태를 저장하지 못했습니다.", error);
  }
}

// 요약할 재료가 전혀 없는 페이지(본문·제목·설명 모두 없음)
function hasNothingToSummarize(metadata: PageMetadata): boolean {
  return metadata.content === "" && !metadata.title && !metadata.description;
}

// 북마크 URL의 메타데이터를 수집하고 요약·태그를 만들어 저장한다.
// after() 같은 백그라운드에서 호출하므로 절대 throw하지 않는다.
// 사용자에게 보이는 errorMessage에는 고정 문구만 사용한다.
export async function collectBookmark(userId: string, bookmarkId: string, url: string): Promise<void> {
  const fetched = await safeFetch(url);
  if (!fetched.ok) {
    await recordFailure(userId, bookmarkId, fetched.message);
    return;
  }

  let metadata: PageMetadata;
  try {
    metadata = extractMetadata(fetched.body);
  } catch (error) {
    logFailure("페이지 분석에 실패했습니다.", error);
    await recordFailure(userId, bookmarkId, "페이지를 분석하지 못했습니다.");
    return;
  }

  try {
    await saveCollectedMetadata(userId, bookmarkId, { title: metadata.title, description: metadata.description });
  } catch (error) {
    logFailure("수집 결과를 저장하지 못했습니다.", error);
    await recordFailure(userId, bookmarkId, "수집 결과를 저장하지 못했습니다.");
    return;
  }

  // 요약을 만들 수 없는 경우에는 메타데이터 수집만으로 완료 처리한다.
  if (!isAiConfigured() || hasNothingToSummarize(metadata)) {
    try {
      await markDone(userId, bookmarkId);
    } catch (error) {
      logFailure("완료 상태를 저장하지 못했습니다.", error);
      await recordFailure(userId, bookmarkId, "수집 결과를 저장하지 못했습니다.");
    }
    return;
  }

  const summarized = await summarizePage({
    url: fetched.finalUrl,
    title: metadata.title,
    description: metadata.description,
    content: metadata.content,
  });
  if (!summarized.ok) {
    await recordFailure(userId, bookmarkId, summarized.message);
    return;
  }

  try {
    await saveSummary(userId, bookmarkId, { summary: summarized.summary, tags: summarized.tags });
  } catch (error) {
    logFailure("요약 결과를 저장하지 못했습니다.", error);
    await recordFailure(userId, bookmarkId, "요약 결과를 저장하지 못했습니다.");
  }
}
