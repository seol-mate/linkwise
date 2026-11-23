import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { SYSTEM_PROMPT, buildUserContent, normalizeSummary, normalizeTags, summarySchema } from "@/lib/summary";
import type { SummarizeInput } from "@/lib/summary";

// 북마크 저장마다 호출하는 단순 요약/태깅 작업이라 비용이 낮은 Haiku를 기본으로 쓴다.
// 품질이 부족하면 ANTHROPIC_MODEL 환경 변수로 더 큰 모델(예: claude-opus-5-5)로 바꾼다.
const DEFAULT_MODEL = "claude-haiku-5-5";
const REQUEST_TIMEOUT_MS = 60_000;
// 사고(thinking) 토큰도 max_tokens에 포함되므로 출력(약 300토큰)보다 넉넉하게 둔다.
const MAX_TOKENS = 4_000;

export type SummarizeResult = { ok: true; summary: string; tags: string[] } | { ok: false; message: string };

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    // API 키는 ANTHROPIC_API_KEY 환경 변수에서 SDK가 직접 읽는다.
    cachedClient = new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 });
  }
  return cachedClient;
}

// 사용자에게 보일 수 있는 고정 문구만 반환한다. 에러 원문·키·내부 정보는 노출하지 않는다.
function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return "요약 요청이 많아 잠시 후 다시 시도해 주세요.";
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "요약 서비스 설정에 문제가 있습니다.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "요약 서비스에 연결하지 못했습니다.";
  }
  // 크레딧 소진 같은 계정 문제는 사용자가 해결할 수 없으므로 일반적인 문구로 안내한다.
  if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) {
    return "요약 서비스를 일시적으로 사용할 수 없습니다.";
  }
  return "요약을 생성하지 못했습니다.";
}

// 운영자가 원인을 알 수 있도록 API 오류 메시지를 남기되, API 키 형태의 문자열은 가리고 길이를 제한한다.
export function sanitizeForLog(message: string): string {
  return message.replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-<masked>").slice(0, 300);
}

function logFailure(error: unknown): void {
  if (error instanceof Anthropic.APIError) {
    console.error("요약 API 호출에 실패했습니다.", error.name, error.status, error.requestID ?? "", sanitizeForLog(error.message));
    return;
  }
  console.error("요약 API 호출에 실패했습니다.", error instanceof Error ? error.name : "UnknownError");
}

// 수집한 페이지의 요약과 태그를 만든다. 절대 throw하지 않고 결과 객체로 돌려준다.
// client 인자는 테스트에서 가짜 클라이언트를 주입하기 위한 것이다.
export async function summarizePage(input: SummarizeInput, client: Anthropic = getClient()): Promise<SummarizeResult> {
  try {
    const response = await client.beta.messages.parse({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // 보안 관련 글 등을 북마크하면 안전 분류기가 거부할 수 있어, 거부 시 서버가 대체 모델로 재시도한다.
      // 폴백을 지원하지 않는 모델(Haiku 포함)에서 "default"는 요청한 모델만으로 실행되며, 거부는 아래에서 처리한다.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // 단순 요약이므로 사고 깊이를 낮춘다.
      output_config: { effort: "low", format: zodOutputFormat(summarySchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(input) }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, message: "AI가 이 페이지의 요약을 거부했습니다." };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, message: "요약을 생성하지 못했습니다." };
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return { ok: false, message: "요약 결과를 해석하지 못했습니다." };
    }

    const summary = normalizeSummary(parsed.summary);
    if (summary === "") {
      return { ok: false, message: "요약 결과가 비어 있습니다." };
    }
    return { ok: true, summary, tags: normalizeTags(parsed.tags) };
  } catch (error) {
    logFailure(error);
    return { ok: false, message: describeError(error) };
  }
}
