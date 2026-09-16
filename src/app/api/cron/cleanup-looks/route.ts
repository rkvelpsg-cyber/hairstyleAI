import { NextResponse } from "next/server";
import { cleanupExpiredLooks } from "@/lib/lookStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const removed = await cleanupExpiredLooks();
    return NextResponse.json({ ok: true, removed });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
