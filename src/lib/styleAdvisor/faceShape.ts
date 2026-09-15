import { analyseFaceForStyling } from "@/lib/faceLock";

export type FaceShapeAnalysis = {
  faceShape: "Oval" | "Round" | "Square" | "Oblong" | "Heart" | "Diamond";
  hairCharacteristics: string[];
};

type FaceMetrics = Awaited<ReturnType<typeof analyseFaceForStyling>>;

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function estimateShape(metrics: FaceMetrics) {
  const { landmarks, bounds } = metrics;
  const faceRatio = bounds.height / Math.max(1, bounds.width);
  const cheekWidth = distance(landmarks[234], landmarks[454]);
  const jawWidth = distance(landmarks[172], landmarks[397]);
  const foreheadWidth = distance(landmarks[54], landmarks[284]);
  const jawRatio = jawWidth / Math.max(1, cheekWidth);
  const foreheadRatio = foreheadWidth / Math.max(1, cheekWidth);

  if (faceRatio >= 1.48) return "Oblong" as const;
  if (faceRatio <= 1.17 && jawRatio >= 0.76) return "Square" as const;
  if (faceRatio <= 1.2) return "Round" as const;
  if (foreheadRatio >= 0.9 && jawRatio <= 0.62) return "Heart" as const;
  if (jawRatio <= 0.58 && foreheadRatio < 0.82) return "Diamond" as const;
  return "Oval" as const;
}

export async function analyzeFaceShape(
  source: string,
): Promise<FaceShapeAnalysis> {
  const metrics = await analyseFaceForStyling(source);
  return {
    faceShape: estimateShape(metrics),
    hairCharacteristics: [
      "Visible hair texture: natural photo estimate",
      `Visible face proportions: ${Math.round((metrics.bounds.height / Math.max(1, metrics.bounds.width)) * 100) / 100} height-to-width ratio`,
      "Hair density and texture should be confirmed in the salon before service",
    ],
  };
}
