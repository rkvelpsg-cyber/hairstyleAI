import { NextResponse } from "next/server";
import { getLook, getLookImage } from "@/lib/lookStore";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const look = await getLook(params.token);
  if (!look) {
    if (new URL(request.url).searchParams.get("metadata") === "1")
      return NextResponse.json({ ok: false, expired: true }, { status: 404 });
    return NextResponse.json({ ok: false, expired: true }, { status: 404 });
  }
  if (new URL(request.url).searchParams.get("metadata") === "1") {
    return NextResponse.json({
      ok: true,
      styleLabel: look.styleLabel,
      colorLabel: look.colorLabel,
      expiresAt: look.expiresAt,
    });
  }
  try {
    const image = await getLookImage(look);
    return new NextResponse(image.bytes as BodyInit, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, expired: true }, { status: 404 });
  }
}
