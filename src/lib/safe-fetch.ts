import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import type { LookupFunction } from "node:net";

// 사용자가 입력한 URL을 서버에서 가져오기 위한 SSRF 방어 fetch.
//
// 방어 계층
// 1. 스킴(http/https)·포트(80/443)·인증 정보·내부 호스트명을 요청 전에 검사한다.
// 2. IP 리터럴(http://127.0.0.1/ 등)은 DNS를 거치지 않으므로 직접 검사한다.
// 3. 도메인은 "실제 연결에 쓰이는 lookup" 안에서 해석된 모든 주소를 검사한다.
//    검사한 주소와 연결하는 주소가 같으므로 DNS 리바인딩(검사 후 주소 변경)이 통하지 않는다.
// 4. 리다이렉트는 자동으로 따라가지 않고, 홉마다 1~3을 다시 적용한다.
// 5. 전체 타임아웃, 응답 크기 상한, 콘텐츠 타입 제한, 압축 해제 금지(identity).

export type FetchPolicy = {
  isAddressBlocked: (address: string) => boolean;
  allowedPorts: ReadonlySet<number>;
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  allowedContentTypes: readonly string[];
  userAgent: string;
};

export type SafeFetchErrorCode =
  | "invalid-url"
  | "blocked"
  | "timeout"
  | "too-many-redirects"
  | "http-error"
  | "unsupported-content-type"
  | "network";

export type SafeFetchResult =
  | { ok: true; finalUrl: string; status: number; contentType: string; body: string; truncated: boolean }
  | { ok: false; code: SafeFetchErrorCode; message: string };

// ---- 주소 판정 ----

// 사설/루프백/링크로컬/예약/멀티캐스트 대역. 클라우드 메타데이터(169.254.169.254)는 링크로컬에 포함된다.
const IPV4_BLOCKED: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

// NAT64/6to4/Teredo는 내부 IPv4를 감쌀 수 있어 통째로 막는다.
const IPV6_BLOCKED: ReadonlyArray<readonly [string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
];

const blockList = new BlockList();
for (const [network, prefix] of IPV4_BLOCKED) {
  blockList.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of IPV6_BLOCKED) {
  blockList.addSubnet(network, prefix, "ipv6");
}

// IPv4-mapped IPv6(::ffff:127.0.0.1)는 BlockList가 IPv4 규칙으로 함께 검사한다.
// 해석할 수 없는 값은 허용하지 않는다(fail closed).
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) {
    return true;
  }
  try {
    return blockList.check(address, family === 4 ? "ipv4" : "ipv6");
  } catch {
    return true;
  }
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localdomain")
  );
}

export const DEFAULT_POLICY: FetchPolicy = {
  isAddressBlocked: isBlockedAddress,
  allowedPorts: new Set([80, 443]),
  timeoutMs: 10_000,
  maxBytes: 1_000_000,
  maxRedirects: 5,
  allowedContentTypes: ["text/html", "application/xhtml+xml"],
  userAgent: "linkwise-bot/0.1 (bookmark metadata fetch)",
};

// ---- 내부 구현 ----

class BlockedAddressError extends Error {
  constructor() {
    super("blocked address");
    this.name = "BlockedAddressError";
  }
}

const MESSAGES: Record<Exclude<SafeFetchErrorCode, "http-error">, string> = {
  "invalid-url": "올바르지 않은 주소입니다.",
  blocked: "접근할 수 없는 주소입니다.",
  timeout: "응답 시간이 초과되었습니다.",
  "too-many-redirects": "리다이렉트가 너무 많습니다.",
  "unsupported-content-type": "HTML 페이지가 아닙니다.",
  network: "페이지에 연결하지 못했습니다.",
};

function failure(code: Exclude<SafeFetchErrorCode, "http-error">): SafeFetchResult {
  return { ok: false, code, message: MESSAGES[code] };
}

function effectivePort(url: URL): number {
  if (url.port !== "") {
    return Number(url.port);
  }
  return url.protocol === "https:" ? 443 : 80;
}

// 요청 전에 URL 자체를 검사한다. 통과하면 null, 거부하면 실패 결과를 반환한다.
function validateTarget(url: URL, policy: FetchPolicy): SafeFetchResult | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return failure("invalid-url");
  }
  if (url.username !== "" || url.password !== "") {
    return failure("invalid-url");
  }
  if (!policy.allowedPorts.has(effectivePort(url))) {
    return failure("blocked");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(host)) {
    return failure("blocked");
  }
  // URL 파서가 2130706433, 0x7f.1 같은 표기를 점 표기 IPv4로 정규화해 준다.
  if (isIP(host) !== 0 && policy.isAddressBlocked(host)) {
    return failure("blocked");
  }
  return null;
}

// 실제 연결에 쓰이는 DNS 조회. 해석된 주소 중 하나라도 차단 대상이면 연결하지 않는다.
export function createLookup(policy: FetchPolicy): LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error, "", 0);
        return;
      }
      if (addresses.length === 0 || addresses.some((entry) => policy.isAddressBlocked(entry.address))) {
        callback(new BlockedAddressError(), "", 0);
        return;
      }
      if (options.all) {
        callback(null, addresses);
        return;
      }
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

type RawResponse =
  | { kind: "redirect"; location: string }
  | { kind: "response"; status: number; contentType: string; body: Buffer; truncated: boolean; readable: boolean };

function isAllowedContentType(contentType: string, policy: FetchPolicy): boolean {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  return policy.allowedContentTypes.includes(mime);
}

function requestOnce(url: URL, policy: FetchPolicy, signal: AbortSignal): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        agent: false,
        signal,
        lookup: createLookup(policy),
        headers: {
          "user-agent": policy.userAgent,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-encoding": "identity",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        const contentType = String(response.headers["content-type"] ?? "");

        if (status >= 300 && status < 400 && location) {
          response.destroy();
          resolve({ kind: "redirect", location });
          return;
        }

        // 본문을 읽을 필요가 없는 응답은 바로 닫는다.
        const readable = status >= 200 && status < 300 && isAllowedContentType(contentType, policy);
        if (!readable) {
          response.destroy();
          resolve({ kind: "response", status, contentType, body: Buffer.alloc(0), truncated: false, readable });
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        let settled = false;
        const finish = (truncated: boolean) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve({ kind: "response", status, contentType, body: Buffer.concat(chunks), truncated, readable });
        };

        response.on("data", (chunk: Buffer) => {
          if (settled) {
            return;
          }
          const remaining = policy.maxBytes - total;
          if (chunk.length >= remaining) {
            chunks.push(chunk.subarray(0, remaining));
            total += remaining;
            finish(true);
            response.destroy();
            return;
          }
          chunks.push(chunk);
          total += chunk.length;
        });
        response.on("end", () => finish(false));
        response.on("error", (error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        });
        response.on("close", () => {
          if (!settled) {
            settled = true;
            reject(new Error("connection closed"));
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

function decodeBody(body: Buffer, contentType: string): string {
  const label = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(label).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

// ---- 공개 API ----

// policy를 직접 지정하는 함수는 테스트용이다. 서버 코드는 safeFetch를 사용한다.
export async function fetchWithPolicy(input: string, policy: FetchPolicy): Promise<SafeFetchResult> {
  let current: URL;
  try {
    current = new URL(input);
  } catch {
    return failure("invalid-url");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), policy.timeoutMs);

  try {
    for (let hop = 0; hop <= policy.maxRedirects; hop += 1) {
      const rejected = validateTarget(current, policy);
      if (rejected) {
        return rejected;
      }

      const raw = await requestOnce(current, policy, controller.signal);

      if (raw.kind === "redirect") {
        try {
          current = new URL(raw.location, current);
        } catch {
          return failure("invalid-url");
        }
        continue;
      }

      if (raw.status < 200 || raw.status >= 300) {
        return { ok: false, code: "http-error", message: `페이지가 ${raw.status} 응답을 반환했습니다.` };
      }
      if (!raw.readable) {
        return failure("unsupported-content-type");
      }
      return {
        ok: true,
        finalUrl: current.href,
        status: raw.status,
        contentType: raw.contentType,
        body: decodeBody(raw.body, raw.contentType),
        truncated: raw.truncated,
      };
    }
    return failure("too-many-redirects");
  } catch (error) {
    if (error instanceof BlockedAddressError) {
      return failure("blocked");
    }
    if (controller.signal.aborted) {
      return failure("timeout");
    }
    // 에러 객체에는 내부 주소 등이 섞일 수 있어 이름만 남긴다.
    console.error("외부 페이지 요청에 실패했습니다.", error instanceof Error ? error.name : "UnknownError");
    return failure("network");
  } finally {
    clearTimeout(timer);
  }
}

export function safeFetch(url: string): Promise<SafeFetchResult> {
  return fetchWithPolicy(url, DEFAULT_POLICY);
}
