import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { hairColors, hairStyles } from "@/data/catalog";
import { buildHairPrompt } from "@/lib/hairPrompt";
import { resolveColorProvider, resolveStyleProvider } from "@/lib/styleConfig";

export const runtime = "nodejs";
export const maxDuration = 60;
const STRUCTURED_MODEL = "fal-ai/image-apps-v2/hair-change";
const CUSTOM_MODEL = "fal-ai/image-editing/hair-change";

export async function POST(req: Request) {
  const startedAt = Date.now();
  const provider = process.env.HAIR_AI_PROVIDER || "mock";
  try {
    const body = await req.json();
    const { image, style, stylePrompt, styleId, colorId } = body as {
      image?: string;
      style?: string;
      stylePrompt?: string;
      styleId?: string;
      colorId?: string;
    };

    const selectedStyle = hairStyles.find((item) => item.id === styleId);
    const selectedColor = hairColors.find((item) => item.id === colorId);
    if (!image || !styleId || !selectedStyle || !selectedColor) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid image, hairstyle, or hair color selection",
          code: "INVALID_INPUT",
        },
        { status: 400 },
      );
    }

    const styleConfig = resolveStyleProvider(selectedStyle);
    const providerColor = resolveColorProvider(selectedColor);
    const mapping = {
      selectedStyle: selectedStyle.label,
      selectedStyleId: selectedStyle.id,
      provider: provider === "fal" ? "fal" : provider,
      providerMode: styleConfig.mode,
      endpoint: styleConfig.endpoint,
      providerTarget: styleConfig.targetHairstyle,
      selectedColor: selectedColor.label,
      providerColor,
    };

    if (provider === "mock") {
      return NextResponse.json({
        success: true,
        resultImage: image,
        ...mapping,
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
    const useStructured = styleConfig.mode === "structured";
    const model = useStructured ? STRUCTURED_MODEL : CUSTOM_MODEL;
    const result: any = useStructured
      ? await fal.subscribe(model, {
          input: {
            image_url: image,
            target_hairstyle: styleConfig.targetHairstyle as any,
            hair_color: providerColor as any,
            aspect_ratio: { ratio: "3:4" },
          },
          logs: false,
        })
      : await fal.subscribe(model, {
          input: {
            image_url: image,
            prompt: buildHairPrompt({
              styleId: selectedStyle.id,
              styleLabel: selectedStyle.label,
              stylePrompt: selectedStyle.stylePrompt || stylePrompt,
              color: providerColor,
            }),
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
      requestId: result?.requestId,
      styleId,
      ...mapping,
    });
  } catch (error) {
    console.error("Hair generation failed", {
      provider,
      model: "fal-ai/hair-change",
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
