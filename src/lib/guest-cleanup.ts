import "server-only";

import { guestCutoff } from "@/lib/guest";
import { createIntervalGate } from "@/lib/interval-gate";
import { deleteStaleGuests } from "@/lib/users";

// 로그인 외 시점(북마크 목록 조회)에서 정리를 시도하는 최소 간격.
export const GUEST_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const cleanupGate = createIntervalGate(GUEST_CLEANUP_INTERVAL_MS);

// 오래된 게스트를 정리한다. 로그인이나 after() 백그라운드에서 호출하므로 throw하지 않고 로그만 남긴다.
export async function cleanupStaleGuests(now: Date = new Date()): Promise<void> {
  try {
    await deleteStaleGuests(guestCutoff(now));
  } catch (error) {
    console.error("오래된 게스트 정리에 실패했습니다.", error instanceof Error ? error.name : "UnknownError");
  }
}

// 게스트 로그인이 없어도 만료 데이터가 남지 않도록 다른 요청에서도 정리한다.
// 매 요청마다 DELETE를 보내지 않도록 인스턴스당 GUEST_CLEANUP_INTERVAL_MS에 한 번만 실행한다.
// 실패해도 다음 간격까지 다시 시도하지 않는다(로그인 시점 정리가 따로 있다).
export async function cleanupStaleGuestsThrottled(
  now: Date = new Date(),
  gate: (nowMs: number) => boolean = cleanupGate,
): Promise<void> {
  if (!gate(now.getTime())) {
    return;
  }
  await cleanupStaleGuests(now);
}
