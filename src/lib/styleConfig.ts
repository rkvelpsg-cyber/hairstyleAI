import type { HairColor, HairStyle } from "@/types";

export type ProviderMode = "structured" | "custom";
export type ValidationFamily =
  | "buzz_cut"
  | "side_part"
  | "bob_cut"
  | "pixie_cut"
  | "braids"
  | "curly_hair"
  | "straight_hair"
  | "general";

export type StyleValidationRules = {
  family: ValidationFamily;
  maxTopLength?: "very_short" | "short" | "medium" | "long";
  sidePartAllowed?: boolean;
  volume?: "minimal" | "natural" | "moderate" | "high";
};

export type StyleProviderConfig = {
  mode: ProviderMode;
  endpoint: string;
  targetHairstyle?: string;
  validation: StyleValidationRules;
  generationQuality: "verified" | "testing" | "experimental";
};

const STRUCTURED_ENDPOINT = "fal-ai/image-apps-v2/hair-change";
const CUSTOM_ENDPOINT = "fal-ai/image-editing/hair-change";

// Only styles with an exact provider enum belong here. Everything else stays custom.
const STRUCTURED_BY_ID: Record<string, string> = {
  "women-high-pony": "high_ponytail",
  "women-bob": "bob_cut",
  "women-pixie": "pixie_cut",
  "women-straight": "straight_hair",
  "women-waves": "wavy_hair",
  "women-curls": "curly_hair",
  "women-low-bun": "bun",
  "women-high-bun": "bun",
  "women-french-braid": "braids",
  "women-side-braid": "braids",
  "women-single-plait": "braids",
  "women-crown-braid": "braids",
  "women-waterfall": "braids",
  "girls-bob": "bob_cut",
  "girls-double-braid": "braids",
  "girls-single-braid": "braids",
  "girls-soft-curls": "curly_hair",
  "men-classic-side": "side_part",
  "men-buzz-cut": "buzz_cut",
  "men-wavy": "wavy_hair",
  "men-curly": "curly_hair",
  "boys-school-side": "side_part",
  "boys-crew": "buzz_cut",
  "boys-curly-short": "curly_hair",
  "senior-women-short-bob": "bob_cut",
  "senior-women-pixie": "pixie_cut",
  "senior-women-soft-curls": "curly_hair",
  "senior-women-braid": "braids",
  "senior-men-side": "side_part",
  "senior-men-crew": "buzz_cut",
  "senior-men-buzz": "buzz_cut",
};

const VERIFIED_STYLE_IDS = new Set([
  "men-buzz-cut",
  "men-crew",
  "men-classic-side",
  "men-curly",
  "men-wavy",
  "women-bob",
  "women-pixie",
  "women-straight",
  "women-curls",
  "women-u-cut",
]);

function validationFor(target?: string): StyleValidationRules {
  switch (target) {
    case "buzz_cut":
      return {
        family: "buzz_cut",
        maxTopLength: "very_short",
        sidePartAllowed: false,
        volume: "minimal",
      };
    case "side_part":
      return { family: "side_part", sidePartAllowed: true, volume: "natural" };
    case "bob_cut":
      return { family: "bob_cut", maxTopLength: "medium", volume: "natural" };
    case "pixie_cut":
      return { family: "pixie_cut", maxTopLength: "short", volume: "natural" };
    case "braids":
      return { family: "braids", maxTopLength: "long", volume: "moderate" };
    case "curly_hair":
      return { family: "curly_hair", volume: "moderate" };
    case "straight_hair":
      return { family: "straight_hair", volume: "natural" };
    default:
      return { family: "general" };
  }
}

export function resolveStyleProvider(style: HairStyle): StyleProviderConfig {
  const targetHairstyle = STRUCTURED_BY_ID[style.id];
  return targetHairstyle
    ? {
        mode: "structured",
        endpoint: STRUCTURED_ENDPOINT,
        targetHairstyle,
        validation: validationFor(targetHairstyle),
        generationQuality: VERIFIED_STYLE_IDS.has(style.id)
          ? "verified"
          : "testing",
      }
    : {
        mode: "custom",
        endpoint: CUSTOM_ENDPOINT,
        validation: { family: "general" },
        generationQuality: VERIFIED_STYLE_IDS.has(style.id)
          ? "verified"
          : "experimental",
      };
}

const COLOR_PROVIDER_MAP: Record<string, string> = {
  natural: "natural",
  natural_black: "black",
  soft_black: "black",
  dark_brown: "dark_brown",
  chocolate: "dark_brown",
  mahogany: "auburn",
  burgundy: "red",
  copper: "auburn",
  caramel: "highlights",
  highlights: "highlights",
  balayage: "balayage",
  silver: "silver",
};

export function resolveColorProvider(color: HairColor) {
  return COLOR_PROVIDER_MAP[color.id] || color.providerColor || color.falColor;
}
