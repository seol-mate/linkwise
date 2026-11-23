export const MAX_URL_LENGTH = 2048;

// 중복 감지 시 무시할 추적 파라미터 (utm_* 는 접두사로 처리)
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "_hsenc",
  "_hsmi",
]);

export type NormalizeUrlResult =
  | { ok: true; url: string; normalizedUrl: string }
  | { ok: false; error: string };

// 로케일에 영향받지 않는 단순 문자열 비교 (쿼리 정렬을 항상 같은 순서로 만들기 위함)
function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
}

// `https://` 같은 스킴이 있거나, 위험한 스킴(javascript: 등)이면 그대로 둔다.
// 둘 다 아니면 `example.com/path` 처럼 스킴을 생략한 입력으로 보고 https를 붙인다.
function withDefaultScheme(input: string): string {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) || /^(javascript|data|vbscript|mailto|tel|file|blob|about):/i.test(input);
  return hasScheme ? input : `https://${input}`;
}

// 사용자가 입력한 URL을 검증하고, 중복 감지용 정규화 URL을 만든다.
// - http/https만 허용, 인증 정보(user:pass@)가 포함된 URL은 거부
// - 정규화: 호스트 소문자(URL이 처리), 해시 제거, 추적 파라미터 제거, 쿼리 정렬, 끝의 슬래시 제거
// 이 함수는 URL을 fetch하지 않는다. 서버에서 fetch할 때는 별도로 SSRF 방어를 적용해야 한다.
export function normalizeUrl(input: string): NormalizeUrlResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "URL을 입력해 주세요." };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: `URL은 ${MAX_URL_LENGTH}자 이하여야 합니다.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(withDefaultScheme(trimmed));
  } catch {
    return { ok: false, error: "올바른 URL 형식이 아닙니다." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "http 또는 https 주소만 저장할 수 있습니다." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "인증 정보가 포함된 URL은 저장할 수 없습니다." };
  }

  const normalized = new URL(parsed.href);
  normalized.hash = "";

  const keptParams = [...normalized.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key))
    .sort(([a], [b]) => compareStrings(a, b));
  normalized.search = new URLSearchParams(keptParams).toString();

  if (normalized.pathname.length > 1) {
    normalized.pathname = normalized.pathname.replace(/\/+$/, "") || "/";
  }

  return { ok: true, url: parsed.href, normalizedUrl: normalized.href };
}
