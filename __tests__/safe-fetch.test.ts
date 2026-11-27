import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_POLICY, createLookup, fetchWithPolicy, isBlockedAddress, safeFetch } from "@/lib/safe-fetch";
import type { FetchPolicy } from "@/lib/safe-fetch";

describe("isBlockedAddress", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254", // 클라우드 메타데이터
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1", // IPv4-mapped
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "64:ff9b::7f00:1", // NAT64
    "2002:7f00:1::", // 6to4
  ])("차단: %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    "93.184.216.34",
    "8.8.8.8",
    "1.1.1.1",
    "11.0.0.1",
    "172.15.255.255",
    "172.32.0.1",
    "192.169.0.1",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8",
  ])("허용: %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it("IP가 아닌 값은 허용하지 않는다 (fail closed)", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

describe("safeFetch 사전 검사 (네트워크 없이 거부)", () => {
  it.each([
    ["루프백 IPv4", "http://127.0.0.1/"],
    ["루프백 IPv6", "http://[::1]/"],
    ["localhost", "http://localhost/"],
    ["localhost 하위 도메인", "http://app.localhost/"],
    ["후행 점이 있는 localhost", "http://localhost./"],
    ["클라우드 메타데이터", "http://169.254.169.254/latest/meta-data/"],
    ["사설망", "http://10.0.0.5/admin"],
    ["정수 표기 IP(127.0.0.1)", "http://2130706433/"],
    ["16진수 표기 IP", "http://0x7f.0.0.1/"],
    ["축약 표기 IP", "http://127.1/"],
    ["IPv4-mapped IPv6", "http://[::ffff:127.0.0.1]/"],
    [".internal 호스트", "http://metadata.google.internal/"],
    ["허용되지 않는 포트", "http://example.com:22/"],
    ["허용되지 않는 포트(8080)", "http://example.com:8080/"],
  ])("%s → blocked", async (_label, url) => {
    const result = await safeFetch(url);
    expect(result).toMatchObject({ ok: false, code: "blocked" });
  });

  it.each([
    ["ftp 스킴", "ftp://example.com/"],
    ["file 스킴", "file:///etc/passwd"],
    ["javascript 스킴", "javascript:alert(1)"],
    ["인증 정보 포함", "https://user:pass@example.com/"],
    ["형식 오류", "not a url"],
    ["빈 문자열", ""],
  ])("%s → invalid-url", async (_label, url) => {
    const result = await safeFetch(url);
    expect(result).toMatchObject({ ok: false, code: "invalid-url" });
  });

  it("거부 메시지에 주소 정보를 노출하지 않는다", async () => {
    const result = await safeFetch("http://169.254.169.254/");
    expect(!result.ok && result.message).not.toContain("169.254");
  });
});

describe("createLookup (DNS 리바인딩 방어)", () => {
  it("차단 대역으로 해석되는 호스트는 연결 단계에서 거부한다", async () => {
    const lookup = createLookup(DEFAULT_POLICY);
    const error = await new Promise<Error | null>((resolve) => {
      lookup("localhost", {}, (err) => resolve(err));
    });
    expect(error?.name).toBe("BlockedAddressError");
  });

  it("허용 정책이면 해석 결과를 그대로 돌려준다", async () => {
    const lookup = createLookup({ ...DEFAULT_POLICY, isAddressBlocked: () => false });
    const result = await new Promise<{ error: Error | null; address: unknown }>((resolve) => {
      lookup("localhost", {}, (err, address) => resolve({ error: err, address }));
    });
    expect(result.error).toBeNull();
    expect(typeof result.address).toBe("string");
  });
});

describe("fetchWithPolicy (로컬 서버)", () => {
  let server: http.Server;
  let base = "";
  let port = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = req.url ?? "/";
      if (path === "/ok") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<html><head><title>안녕</title></head><body>본문</body></html>");
        return;
      }
      if (path === "/redirect") {
        res.writeHead(302, { location: "/ok" });
        res.end();
        return;
      }
      if (path === "/loop") {
        res.writeHead(302, { location: "/loop" });
        res.end();
        return;
      }
      if (path === "/redirect-to-localhost") {
        res.writeHead(302, { location: `http://localhost:${port}/ok` });
        res.end();
        return;
      }
      if (path === "/redirect-to-ftp") {
        res.writeHead(302, { location: "ftp://example.com/" });
        res.end();
        return;
      }
      if (path === "/json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      if (path === "/missing") {
        res.writeHead(404, { "content-type": "text/html" });
        res.end("nope");
        return;
      }
      if (path === "/big") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("a".repeat(5000));
        return;
      }
      if (path === "/euckr") {
        res.writeHead(200, { "content-type": "text/html; charset=euc-kr" });
        res.end(Buffer.from([0xc7, 0xd1, 0xb1, 0xdb])); // "한글"
        return;
      }
      if (path === "/hang") {
        res.writeHead(200, { "content-type": "text/html" });
        res.write("<html>");
        return; // 응답을 끝내지 않는다
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // 로컬 서버(루프백)에 접속하기 위해 주소 검사와 포트 제한을 푼 테스트 전용 정책
  const testPolicy = (overrides: Partial<FetchPolicy> = {}): FetchPolicy => ({
    ...DEFAULT_POLICY,
    isAddressBlocked: () => false,
    allowedPorts: new Set([port]),
    ...overrides,
  });

  it("기본 정책은 로컬 서버에 접속하지 않는다", async () => {
    const result = await fetchWithPolicy(`${base}/ok`, DEFAULT_POLICY);
    expect(result).toMatchObject({ ok: false, code: "blocked" });
  });

  it("정상 응답을 본문과 함께 돌려준다", async () => {
    const result = await fetchWithPolicy(`${base}/ok`, testPolicy());
    expect(result).toMatchObject({ ok: true, status: 200, truncated: false });
    expect(result.ok && result.body).toContain("<title>안녕</title>");
  });

  it("리다이렉트를 따라간다", async () => {
    const result = await fetchWithPolicy(`${base}/redirect`, testPolicy());
    expect(result.ok && result.finalUrl).toBe(`${base}/ok`);
  });

  it("리다이렉트 대상도 다시 검증한다 (내부 호스트로의 우회 차단)", async () => {
    const result = await fetchWithPolicy(`${base}/redirect-to-localhost`, testPolicy());
    expect(result).toMatchObject({ ok: false, code: "blocked" });
  });

  it("허용되지 않는 스킴으로의 리다이렉트를 거부한다", async () => {
    const result = await fetchWithPolicy(`${base}/redirect-to-ftp`, testPolicy());
    expect(result).toMatchObject({ ok: false, code: "invalid-url" });
  });

  it("리다이렉트 횟수를 제한한다", async () => {
    const result = await fetchWithPolicy(`${base}/loop`, testPolicy({ maxRedirects: 3 }));
    expect(result).toMatchObject({ ok: false, code: "too-many-redirects" });
  });

  it("HTML이 아닌 콘텐츠를 거부한다", async () => {
    const result = await fetchWithPolicy(`${base}/json`, testPolicy());
    expect(result).toMatchObject({ ok: false, code: "unsupported-content-type" });
  });

  it("2xx가 아닌 응답은 상태 코드를 알려준다", async () => {
    const result = await fetchWithPolicy(`${base}/missing`, testPolicy());
    expect(result).toMatchObject({ ok: false, code: "http-error" });
    expect(!result.ok && result.message).toContain("404");
  });

  it("응답 크기를 상한에서 자른다", async () => {
    const result = await fetchWithPolicy(`${base}/big`, testPolicy({ maxBytes: 1000 }));
    expect(result).toMatchObject({ ok: true, truncated: true });
    expect(result.ok && result.body.length).toBe(1000);
  });

  it("Content-Type의 charset으로 디코딩한다", async () => {
    const result = await fetchWithPolicy(`${base}/euckr`, testPolicy({ allowedContentTypes: ["text/html"] }));
    expect(result.ok && result.body).toBe("한글");
  });

  it("끝나지 않는 응답은 타임아웃 처리한다", async () => {
    const result = await fetchWithPolicy(`${base}/hang`, testPolicy({ timeoutMs: 300 }));
    expect(result).toMatchObject({ ok: false, code: "timeout" });
  });
});
