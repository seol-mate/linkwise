import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cleanupAllStaleGuests = vi.fn<() => Promise<number>>();

vi.mock("@/lib/guest-cleanup", () => ({
  cleanupAllStaleGuests: () => cleanupAllStaleGuests(),
}));

import { GET } from "@/app/api/cron/cleanup-guests/route";

const SECRET = "test-cron-secret-0123456789";

function request(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request("http://localhost/api/cron/cleanup-guests", { headers });
}

describe("GET /api/cron/cleanup-guests", () => {
  beforeEach(() => {
    cleanupAllStaleGuests.mockReset();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("인증 헤더가 없으면 401이고 정리하지 않는다", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(cleanupAllStaleGuests).not.toHaveBeenCalled();
  });

  it("CRON_SECRET이 비어 있으면 401이다", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(request("Bearer "));
    expect(res.status).toBe(401);
    expect(cleanupAllStaleGuests).not.toHaveBeenCalled();
  });

  it("인증되면 정리하고 삭제 수를 돌려준다", async () => {
    cleanupAllStaleGuests.mockResolvedValue(7);
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 7 });
  });

  it("정리가 실패하면 500이고 에러 상세는 응답에 넣지 않는다", async () => {
    cleanupAllStaleGuests.mockRejectedValue(new Error("password=hunter2"));
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    expect(console.error).toHaveBeenCalledWith("cron 게스트 정리에 실패했습니다.", "Error");
  });
});
