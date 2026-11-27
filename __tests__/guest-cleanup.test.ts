import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteStaleGuests = vi.fn<(cutoff: Date, limit?: number) => Promise<number>>();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/users", () => ({
  deleteStaleGuests: (cutoff: Date, limit?: number) => deleteStaleGuests(cutoff, limit),
}));

import {
  GUEST_CLEANUP_INTERVAL_MS,
  cleanupAllStaleGuests,
  cleanupStaleGuests,
  cleanupStaleGuestsThrottled,
} from "@/lib/guest-cleanup";
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

describe("cleanupAllStaleGuests", () => {
  beforeEach(() => {
    deleteStaleGuests.mockReset();
  });

  it("배치가 가득 차면 계속 지우고, 덜 차면 멈춘다", async () => {
    deleteStaleGuests.mockResolvedValueOnce(10).mockResolvedValueOnce(10).mockResolvedValueOnce(3);

    await expect(cleanupAllStaleGuests(new Date(), 10, 50)).resolves.toBe(23);
    expect(deleteStaleGuests).toHaveBeenCalledTimes(3);
  });

  it("대상이 없으면 한 번만 조회한다", async () => {
    deleteStaleGuests.mockResolvedValue(0);

    await expect(cleanupAllStaleGuests(new Date(), 10, 50)).resolves.toBe(0);
    expect(deleteStaleGuests).toHaveBeenCalledTimes(1);
  });

  it("maxBatches를 넘겨 반복하지 않는다", async () => {
    deleteStaleGuests.mockResolvedValue(10);

    await expect(cleanupAllStaleGuests(new Date(), 10, 4)).resolves.toBe(40);
    expect(deleteStaleGuests).toHaveBeenCalledTimes(4);
  });

  it("모든 배치에 같은 기준 시각과 배치 크기를 넘긴다", async () => {
    deleteStaleGuests.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
    const now = new Date("2026-11-27T00:00:00Z");

    await cleanupAllStaleGuests(now, 10, 50);

    expect(deleteStaleGuests.mock.calls).toEqual([
      [guestCutoff(now), 10],
      [guestCutoff(now), 10],
    ]);
  });

  it("삭제가 실패하면 그대로 던진다", async () => {
    deleteStaleGuests.mockRejectedValue(new Error("db down"));

    await expect(cleanupAllStaleGuests(new Date(), 10, 50)).rejects.toThrow("db down");
  });

  it("기본 배치 크기는 100명이다", async () => {
    deleteStaleGuests.mockResolvedValue(0);

    await cleanupAllStaleGuests(new Date());

    expect(deleteStaleGuests.mock.calls[0]?.[1]).toBe(100);
  });
});
