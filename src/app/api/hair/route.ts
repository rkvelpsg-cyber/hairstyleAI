import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, style, stylePrompt, styleId, color } = body as {
      image?: string;
      style?: string;
      stylePrompt?: string;
      styleId?: string;
      color?: string;
    };

    if (!image || !style || !color) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing image/style/color",
          code: "INVALID_INPUT",
        },
        { status: 400 },
      );
    }

    const provider = process.env.HAIR_AI_PROVIDER || "mock";

    if (provider === "mock") {
      return NextResponse.json({
        success: true,
        resultImage: image,
        provider: "mock",
      });
    }

    if (provider !== "fal") {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported provider",
          code: "UNSUPPORTED_PROVIDER",
        },
        { status: 400 },
      );
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        {
          success: false,
          error: "AI generation is not configured",
          code: "MISSING_FAL_KEY",
        },
        { status: 500 },
      );
    }

    fal.config({ credentials: falKey });

    const targetHairstyle = style as any;
    const hairColor = color as any;

    const result: any = await fal.subscribe(
      "fal-ai/image-apps-v2/hair-change",
      {
        input: {
          image_url: image,
          target_hairstyle: targetHairstyle,
          hair_color: hairColor,
          aspect_ratio: { ratio: "3:4" },
        },
        logs: false,
      },
    );

    const url = result?.data?.images?.[0]?.url;
    if (!url) {
      throw new Error("AI returned no image");
    }

    return NextResponse.json({
      success: true,
      resultImage: url,
      provider: "fal-hair-change",
      requestId: result?.requestId,
      styleId,
      stylePrompt,
    });
  } catch (error) {
    console.error("Hair generation failed", {
      provider: process.env.HAIR_AI_PROVIDER || "mock",
      model: "fal-ai/image-apps-v2/hair-change",
      status: "error",
    });

    return NextResponse.json(
      {
        success: false,
        error: "AI generation failed",
        code: "PROVIDER_ERROR",
      },
      { status: 502 },
    );
  }
}
