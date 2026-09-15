import type { HairAudience, HairStyle } from "@/types";
import type { Recommendation } from "./types";

const shapeKeywords: Record<string, { prefer: string[]; avoid: string[] }> = {
  Oval: { prefer: [], avoid: [] },
  Round: {
    prefer: [
      "layer",
      "quiff",
      "pompadour",
      "side part",
      "taper",
      "high",
      "textured",
      "pixie",
    ],
    avoid: ["bowl", "round", "chin-length bob"],
  },
  Square: {
    prefer: [
      "wave",
      "curl",
      "layer",
      "side",
      "textured",
      "soft",
      "fringe",
      "bob",
    ],
    avoid: ["sharp", "high fade", "crew"],
  },
  Oblong: {
    prefer: [
      "bob",
      "curl",
      "wave",
      "bang",
      "fringe",
      "layer",
      "low bun",
      "side",
    ],
    avoid: ["quiff", "pompadour", "high pony", "high bun", "top knot"],
  },
  Heart: {
    prefer: ["bob", "bang", "fringe", "side", "wave", "curl", "layer"],
    avoid: ["high pony", "high bun", "slick back"],
  },
  Diamond: {
    prefer: ["bob", "bang", "fringe", "wave", "curl", "layer", "side"],
    avoid: ["slick back", "high fade"],
  },
};

function audienceMatches(style: HairStyle, audience: HairAudience | "all") {
  return (
    audience === "all" ||
    style.audience === audience ||
    style.audience === "unisex"
  );
}

export function recommendHairstyles(
  styles: HairStyle[],
  faceShape: string,
  audience: HairAudience | "all",
): Recommendation[] {
  const rules = shapeKeywords[faceShape] || shapeKeywords.Oval;
  const candidates = styles.filter((style) => audienceMatches(style, audience));
  const scored = candidates.map((style) => {
    const text = `${style.label} ${style.stylePrompt}`.toLowerCase();
    const preferred = rules.prefer.filter((word) => text.includes(word)).length;
    const avoided = rules.avoid.filter((word) => text.includes(word)).length;
    const audienceBonus = audience === "all" ? 0 : 2;
    return { style, score: preferred * 3 - avoided * 2 + audienceBonus };
  });

  const selected = scored
    .sort(
      (a, b) => b.score - a.score || a.style.label.localeCompare(b.style.label),
    )
    .slice(0, 3);

  return selected.map(({ style }, index) => ({
    id: style.id,
    label: style.label,
    priority:
      index === 0 ? "top_pick" : index === 1 ? "great_match" : "worth_trying",
    reason:
      faceShape === "Oval"
        ? "A versatile salon option that keeps the original proportions balanced."
        : `A fashion suggestion for an approximate ${faceShape.toLowerCase()} face shape; confirm the final shape with your stylist.`,
  }));
}
