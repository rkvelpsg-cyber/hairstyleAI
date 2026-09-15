import type { HairAudience, HairColor } from "@/types";
import type { Recommendation } from "./types";

const preferredIdsByAudience: Record<string, string[]> = {
  women: ["dark_brown", "chocolate", "caramel", "mahogany"],
  girls: ["natural", "natural_black", "dark_brown"],
  men: ["natural_black", "dark_brown", "natural", "silver"],
  boys: ["natural", "natural_black", "dark_brown"],
  senior_women: ["natural", "dark_brown", "silver", "chocolate"],
  senior_men: ["natural", "natural_black", "silver", "dark_brown"],
  all: ["natural", "dark_brown", "chocolate", "natural_black"],
};

export function recommendHairColors(
  colors: HairColor[],
  audience: HairAudience | "all",
): Recommendation[] {
  const preferred =
    preferredIdsByAudience[audience] || preferredIdsByAudience.all;
  return preferred
    .map((id) => colors.find((color) => color.id === id))
    .filter((color): color is HairColor => Boolean(color))
    .slice(0, 3)
    .map((color, index) => ({
      id: color.id,
      label: color.label,
      priority:
        index === 0 ? "top_pick" : index === 1 ? "great_match" : "worth_trying",
      reason:
        color.id === "natural"
          ? "Keeps the customer’s existing look authentic and low maintenance."
          : "A natural salon colour direction that can be adjusted after an in-person consultation.",
    }));
}
