// Auth.js가 로그인 페이지로 돌려보낼 때 ?error= 에 붙이는 코드를 사용자용 문구로 바꾼다.
// 코드 목록: https://authjs.dev/reference/core/errors
const DEFAULT_MESSAGE = "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";

const MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "이미 다른 방법으로 가입된 이메일입니다. 처음 가입할 때 사용한 방법으로 로그인해 주세요.",
  AccessDenied: "로그인이 거부되었습니다. 계정 권한을 확인한 뒤 다시 시도해 주세요.",
  CredentialsSignin: "게스트 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  Configuration: "로그인 설정에 문제가 있습니다. 관리자에게 문의해 주세요.",
};

// error는 searchParams 값 그대로(문자열, 배열, 없음)를 받는다. 없으면 null을 돌려준다.
export function loginErrorMessage(error: string | string[] | undefined): string | null {
  const code = Array.isArray(error) ? error[0] : error;
  if (!code) {
    return null;
  }
  // 알 수 없는 코드를 그대로 노출하지 않고 기본 문구로 대체한다.
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : DEFAULT_MESSAGE;
}
