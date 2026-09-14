import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { buildHairPrompt } from "@/lib/hairPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const startedAt = Date.now();
  const provider = process.env.HAIR_AI_PROVIDER || "mock";
  const model = "fal-ai/image-editing/hair-change";
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

    const prompt = buildHairPrompt({ styleLabel: style, stylePrompt, color });

    const result: any = await fal.subscribe(model, {
      input: {
        image_url: image,
        prompt,
        aspect_ratio: "3:4",
      },
      logs: false,
    });

    const url = result?.data?.images?.[0]?.url;
    if (!url) {
      throw new Error("AI returned no image");
    }

    console.info("Hair generation completed", {
      provider,
      model,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return NextResponse.json({
      success: true,
      resultImage: url,
      provider: "fal-hair-change",
      requestId: result?.requestId,
      styleId,
    });
  } catch (error) {
    console.error("Hair generation failed", {
      provider,
      model,
      durationMs: Date.now() - startedAt,
      success: false,
      code: "PROVIDER_ERROR",
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
