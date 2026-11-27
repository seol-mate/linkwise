import { timingSafeEqual } from "node:crypto";

// Vercel Cron은 프로젝트 환경 변수 CRON_SECRET을 `Authorization: Bearer <CRON_SECRET>` 헤더로 보낸다.
// 시크릿이 설정되지 않았으면 누구의 요청도 허용하지 않는다(실수로 공개 엔드포인트가 되는 것을 막는다).
export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  // timingSafeEqual은 길이가 다르면 throw하므로 먼저 비교한다. 길이 정보만 노출된다.
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}
