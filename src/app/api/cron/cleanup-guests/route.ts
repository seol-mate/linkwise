import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { cleanupAllStaleGuests } from "@/lib/guest-cleanup";

// Vercel Cron이 하루 한 번 GET으로 호출한다(vercel.json). 아무도 접속하지 않아도 만료된 게스트를 지운다.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await cleanupAllStaleGuests();
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("cron 게스트 정리에 실패했습니다.", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
