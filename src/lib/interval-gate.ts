// 같은 작업이 intervalMs 안에 여러 번 실행되지 않도록 막는 게이트.
// 통과하면 그 시각을 기록하므로, 동시에 들어온 요청 중 첫 번째만 통과한다.
// 상태는 서버 프로세스(인스턴스) 메모리에만 있어 인스턴스가 여러 개면 각자 따로 센다.
export function createIntervalGate(intervalMs: number): (nowMs: number) => boolean {
  let lastRunMs: number | null = null;

  return (nowMs) => {
    if (lastRunMs !== null && nowMs - lastRunMs < intervalMs) {
      return false;
    }
    lastRunMs = nowMs;
    return true;
  };
}
