// 게스트 사용자 식별용 유틸. `.invalid`는 실제로 존재할 수 없는 예약 TLD(RFC 2606)라
// 실제 사용자 이메일과 충돌하지 않는다.
export const GUEST_EMAIL_DOMAIN = "guest.linkwise.invalid";
export const GUEST_NAME = "게스트";

export function createGuestEmail(id: string = crypto.randomUUID()): string {
  return `guest-${id}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}
