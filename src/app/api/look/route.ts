import { NextResponse } from "next/server";
import { createLook } from "@/lib/lookStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      image?: string;
      styleLabel?: string;
      colorLabel?: string;
    };
    if (!body.image) {
      return NextResponse.json(
        { ok: false, error: "Missing final image" },
        { status: 400 },
      );
    }
    const record = await createLook(
      body as { image: string; styleLabel?: string; colorLabel?: string },
    );
    const base =
      process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || new URL(request.url).origin;
    return NextResponse.json({
      ok: true,
      token: record.token,
      url: `${base.replace(/\/$/, "")}/look/${record.token}`,
      expiresAt: record.expiresAt,
    });
  } catch (error) {
    console.error("Look session creation failed", error);
    return NextResponse.json(
      { ok: false, error: "Unable to save your look" },
      { status: 500 },
    );
  }
}
