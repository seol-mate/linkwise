// 수집·요약은 응답 뒤(after)에서 실행되므로, 함수 시간 초과나 프로세스 종료로 중간에 끊기면
// 북마크가 pending으로 남는다. 마지막 진행(updatedAt) 이후 이 시간이 지나면 실패로 본다.
// 정상 작업의 최장 소요(페이지 수집 + AI 요약 재시도)보다 충분히 길게 잡는다.
export const STALE_PENDING_MS = 10 * 60 * 1000;
export const STALE_PENDING_MESSAGE = "수집이 중간에 중단되었습니다. 다시 시도해 주세요.";

// 이 시각보다 오래 갱신되지 않은 pending 북마크가 중단된 것으로 본다.
export function stalePendingCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STALE_PENDING_MS);
}
