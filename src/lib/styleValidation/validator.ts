import { analyseFaceForStyling } from "@/lib/faceLock";
import { resolveStyleProvider } from "@/lib/styleConfig";
import type { HairStyle } from "@/types";
import { BUZZ_CUT_RULES } from "./rules";
import type { HairstyleValidator, StyleValidationResult } from "./types";

type ImageMetrics = Awaited<ReturnType<typeof analyseFaceForStyling>>;

async function loadImage(source: string) {
  const image = new Image();
  if (source.startsWith("data:") || source.startsWith("blob:")) {
    image.src = source;
  } else {
    const response = await fetch(source);
    if (!response.ok) throw new Error("Unable to load the generated image");
    image.src = URL.createObjectURL(await response.blob());
  }
  await image.decode();
  return image;
}

function darkCoverageAboveForehead(
  image: HTMLImageElement,
  face: ImageMetrics,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 120;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const left = Math.max(0, face.bounds.x - face.bounds.width * 0.65);
  const top = Math.max(0, face.bounds.y - face.bounds.height * 0.9);
  const width = Math.min(image.naturalWidth - left, face.bounds.width * 2.3);
  const height = Math.min(image.naturalHeight - top, face.bounds.height * 0.95);
  if (width <= 0 || height <= 0) return null;
  context.drawImage(image, left, top, width, height, 0, 0, 120, 120);
  const pixels = context.getImageData(0, 0, 120, 120).data;
  let dark = 0;
  let samples = 0;
  for (let y = 0; y < 60; y += 2) {
    for (let x = 0; x < 120; x += 2) {
      const offset = (y * 120 + x) * 4;
      const brightness =
        pixels[offset] * 0.2126 +
        pixels[offset + 1] * 0.7152 +
        pixels[offset + 2] * 0.0722;
      const saturation =
        Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) -
        Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      if (brightness < 92 && saturation < 75) dark++;
      samples++;
    }
  }
  return dark / Math.max(1, samples);
}

export class LocalStyleValidator implements HairstyleValidator {
  async validate(
    originalImage: string,
    generatedImage: string,
    selectedStyle: HairStyle,
  ): Promise<StyleValidationResult> {
    const config = resolveStyleProvider(selectedStyle);
    if (config.validation.family !== "buzz_cut") {
      return {
        passed: true,
        reasons: [
          "No reliable local classifier is enabled for this hairstyle family; the raw result is retained for optional future vision validation.",
        ],
      };
    }

    try {
      const [originalFace, generatedFace, generated] = await Promise.all([
        analyseFaceForStyling(originalImage),
        analyseFaceForStyling(generatedImage),
        loadImage(generatedImage),
      ]);
      const coverage = darkCoverageAboveForehead(generated, generatedFace);
      if (coverage === null) {
        return {
          passed: false,
          reasons: [
            "The generated image could not be analysed for buzz-cut coverage.",
          ],
        };
      }
      const faceScale =
        generatedFace.bounds.width / Math.max(1, originalFace.bounds.width);
      if (faceScale < 0.72 || faceScale > 1.35) {
        return {
          passed: false,
          reasons: [
            "The generated face framing changed too much to validate the selected style.",
          ],
        };
      }
      if (coverage > 0.55) {
        return {
          passed: false,
          reasons: [
            `Generated hairstyle has unusually broad dark coverage above the forehead (${BUZZ_CUT_RULES.failureSignals.slice(0, 4).join(", ")}).`,
            "Expected extremely short hair with minimal volume and no side part.",
          ],
        };
      }
      return {
        passed: true,
        reasons: [
          "Local checks found low top coverage consistent with a very short haircut.",
          "No expensive vision validation was requested.",
        ],
      };
    } catch {
      return {
        passed: false,
        reasons: [
          "The generated image could not be analysed for the selected style.",
        ],
      };
    }
  }
}

export const localStyleValidator = new LocalStyleValidator();
