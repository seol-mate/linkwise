import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteStaleGuests = vi.fn<(cutoff: Date, limit?: number) => Promise<number>>();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/users", () => ({
  deleteStaleGuests: (cutoff: Date, limit?: number) => deleteStaleGuests(cutoff, limit),
}));

import { GUEST_CLEANUP_INTERVAL_MS, cleanupStaleGuests, cleanupStaleGuestsThrottled } from "@/lib/guest-cleanup";
import { guestCutoff } from "@/lib/guest";
import { createIntervalGate } from "@/lib/interval-gate";

describe("createIntervalGate", () => {
  it("처음 호출은 통과한다", () => {
    const gate = createIntervalGate(1000);
    expect(gate(0)).toBe(true);
  });

  it("간격 안의 재호출은 막는다", () => {
    const gate = createIntervalGate(1000);
    gate(0);
    expect(gate(1)).toBe(false);
    expect(gate(999)).toBe(false);
  });

  it("간격이 지나면 다시 통과하고, 그 시각부터 다시 센다", () => {
    const gate = createIntervalGate(1000);
    gate(0);
    expect(gate(1000)).toBe(true);
    expect(gate(1500)).toBe(false);
    expect(gate(2000)).toBe(true);
  });

  it("막힌 호출은 기준 시각을 바꾸지 않는다", () => {
    const gate = createIntervalGate(1000);
    gate(0);
    gate(900);
    expect(gate(1000)).toBe(true);
  });

  it("게이트마다 상태가 따로 있다", () => {
    const a = createIntervalGate(1000);
    const b = createIntervalGate(1000);
    a(0);
    expect(b(1)).toBe(true);
  });
});

describe("cleanupStaleGuests", () => {
  beforeEach(() => {
    deleteStaleGuests.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("보관 기간 기준 시각으로 삭제를 요청한다", async () => {
    deleteStaleGuests.mockResolvedValue(3);
    const now = new Date("2026-11-27T00:00:00Z");

    await cleanupStaleGuests(now);

    expect(deleteStaleGuests).toHaveBeenCalledTimes(1);
    expect(deleteStaleGuests.mock.calls[0]?.[0]).toEqual(guestCutoff(now));
  });

  it("삭제가 실패해도 throw하지 않고 에러 이름만 로그로 남긴다", async () => {
    deleteStaleGuests.mockRejectedValue(new TypeError("connection refused: secret-host"));

    await expect(cleanupStaleGuests(new Date())).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("오래된 게스트 정리에 실패했습니다.", "TypeError");
  });

  it("Error가 아닌 값이 던져져도 throw하지 않는다", async () => {
    deleteStaleGuests.mockRejectedValue("boom");

    await expect(cleanupStaleGuests(new Date())).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("오래된 게스트 정리에 실패했습니다.", "UnknownError");
  });
});

describe("cleanupStaleGuestsThrottled", () => {
  beforeEach(() => {
    deleteStaleGuests.mockReset();
    deleteStaleGuests.mockResolvedValue(0);
  });

  it("간격 안에서는 한 번만 삭제를 요청한다", async () => {
    const gate = createIntervalGate(GUEST_CLEANUP_INTERVAL_MS);
    const start = new Date("2026-11-27T00:00:00Z");

    await cleanupStaleGuestsThrottled(start, gate);
    await cleanupStaleGuestsThrottled(new Date(start.getTime() + GUEST_CLEANUP_INTERVAL_MS - 1), gate);

    expect(deleteStaleGuests).toHaveBeenCalledTimes(1);
  });

  it("간격이 지나면 다시 삭제를 요청한다", async () => {
    const gate = createIntervalGate(GUEST_CLEANUP_INTERVAL_MS);
    const start = new Date("2026-11-27T00:00:00Z");

    await cleanupStaleGuestsThrottled(start, gate);
    await cleanupStaleGuestsThrottled(new Date(start.getTime() + GUEST_CLEANUP_INTERVAL_MS), gate);

    expect(deleteStaleGuests).toHaveBeenCalledTimes(2);
  });

  it("동시에 들어온 요청 중 하나만 삭제를 요청한다", async () => {
    const gate = createIntervalGate(GUEST_CLEANUP_INTERVAL_MS);
    const now = new Date("2026-11-27T00:00:00Z");

    await Promise.all([cleanupStaleGuestsThrottled(now, gate), cleanupStaleGuestsThrottled(now, gate)]);

    expect(deleteStaleGuests).toHaveBeenCalledTimes(1);
  });

  it("간격은 1시간이다", () => {
    expect(GUEST_CLEANUP_INTERVAL_MS).toBe(60 * 60 * 1000);
  });
});
