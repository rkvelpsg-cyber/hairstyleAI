import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { buildHairPrompt } from "@/lib/hairPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;
const STRUCTURED_MODEL = "fal-ai/image-apps-v2/hair-change";
const CUSTOM_MODEL = "fal-ai/image-editing/hair-change";
const STRUCTURED_STYLES = new Set([
  "short_hair",
  "medium_long_hair",
  "long_hair",
  "curly_hair",
  "wavy_hair",
  "high_ponytail",
  "bun",
  "bob_cut",
  "pixie_cut",
  "braids",
  "straight_hair",
  "afro",
  "dreadlocks",
  "buzz_cut",
  "mohawk",
  "bangs",
  "side_part",
  "middle_part",
]);
const STRUCTURED_COLORS = new Set([
  "natural",
  "black",
  "dark_brown",
  "light_brown",
  "silver",
  "gray",
]);

export async function POST(req: Request) {
  const startedAt = Date.now();
  const provider = process.env.HAIR_AI_PROVIDER || "mock";
  try {
    const body = await req.json();
    const {
      image,
      style,
      stylePrompt,
      styleId,
      providerStyle,
      color,
      generationMode,
    } = body as {
      image?: string;
      style?: string;
      stylePrompt?: string;
      styleId?: string;
      providerStyle?: string;
      color?: string;
      generationMode?: "structured" | "custom";
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
    const useStructured =
      generationMode !== "custom" &&
      Boolean(
        providerStyle &&
        color &&
        STRUCTURED_STYLES.has(providerStyle) &&
        STRUCTURED_COLORS.has(color),
      );
    const model = useStructured ? STRUCTURED_MODEL : CUSTOM_MODEL;
    const result: any = useStructured
      ? await fal.subscribe(model, {
          input: {
            image_url: image,
            target_hairstyle: providerStyle as any,
            hair_color: color as any,
            aspect_ratio: { ratio: "3:4" },
          },
          logs: false,
        })
      : await fal.subscribe(model, {
          input: {
            image_url: image,
            prompt: buildHairPrompt({
              styleId,
              styleLabel: style,
              stylePrompt,
              color,
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
      provider: "fal",
      endpoint: model,
      requestId: result?.requestId,
      styleId,
      providerStyle: useStructured ? providerStyle : undefined,
      providerColor: useStructured ? color : undefined,
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
