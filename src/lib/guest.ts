// 게스트 사용자 식별용 유틸. `.invalid`는 실제로 존재할 수 없는 예약 TLD(RFC 2606)라
// 실제 사용자 이메일과 충돌하지 않는다.
export const GUEST_EMAIL_DOMAIN = "guest.linkwise.invalid";
export const GUEST_NAME = "게스트";
export const GUEST_EMAIL_SUFFIX = `@${GUEST_EMAIL_DOMAIN}`;

// 게스트 데이터를 보관하는 기간. 지나면 다음 게스트 로그인 시점에 삭제된다.
export const GUEST_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// 이 시각보다 먼저 만들어진 게스트는 삭제 대상이다.
export function guestCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - GUEST_RETENTION_DAYS * DAY_MS);
}

export function createGuestEmail(id: string = crypto.randomUUID()): string {
  return `guest-${id}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}
