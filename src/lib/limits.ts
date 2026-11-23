import { isGuestEmail } from "@/lib/guest";

// 저장 1건마다 외부 fetch와 AI 호출이 발생하므로 사용자별 일일 한도를 둔다.
// 게스트는 누구나 만들 수 있어 더 낮게 잡는다.
export const GUEST_DAILY_LIMIT = 10;
export const MEMBER_DAILY_LIMIT = 100;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function dailyBookmarkLimit(email: string | null): number {
  if (isGuestEmail(email)) {
    return GUEST_DAILY_LIMIT;
  }
  return MEMBER_DAILY_LIMIT;
}

export function isOverDailyLimit(usedToday: number, email: string | null): boolean {
  return usedToday >= dailyBookmarkLimit(email);
}
