"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 2500;
const MAX_REFRESHES = 8;

// 수집 중인 북마크가 있을 때만, 정해진 횟수만큼 목록을 다시 불러온다(무한 폴링 방지).
// watchKey는 수집 중인 북마크 id들을 이어 붙인 값이며, 비어 있으면 아무것도 하지 않는다.
export function AutoRefresh({ watchKey }: { watchKey: string }) {
  const router = useRouter();

  useEffect(() => {
    if (watchKey === "") {
      return;
    }
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= MAX_REFRESHES) {
        clearInterval(timer);
      }
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [watchKey, router]);

  return null;
}
