import { analyzeFaceShape } from "./faceShape";
import { recommendHairColors } from "./colorRules";
import { recommendHairstyles } from "./hairstyleRules";
import type {
  SalonStyleAdvice,
  StyleAdvisorInput,
  StyleAdvisorProvider,
} from "./types";

function optionalRecommendation(id: string, label: string, reason: string) {
  return { id, label, reason, priority: "worth_trying" as const };
}

export class LocalStyleAdvisor implements StyleAdvisorProvider {
  async advise(input: StyleAdvisorInput): Promise<SalonStyleAdvice> {
    const profile = await analyzeFaceShape(input.image);
    const advice: SalonStyleAdvice = {
      ...profile,
      recommendedHairstyles: recommendHairstyles(
        input.styles,
        profile.faceShape,
        input.audience,
      ),
      recommendedHairColors: recommendHairColors(input.colors, input.audience),
      explanation:
        "These are approximate, styling-oriented suggestions based on the selected audience and visible proportions. You can choose any catalogue style and confirm the final result with your salon professional.",
    };

    if (["men", "boys", "senior_men"].includes(input.audience)) {
      advice.groomingSuggestions = [
        optionalRecommendation(
          "natural-moustache",
          "Natural Moustache",
          "Keeps facial hair understated while the haircut is being assessed.",
        ),
        optionalRecommendation(
          "short-boxed-beard",
          "Short Boxed Beard",
          "A tidy outline that can complement structured salon cuts.",
        ),
        optionalRecommendation(
          "eyewear-balance",
          "Balanced Eyewear Styling",
          "Choose frames that leave the brow and hairstyle visible.",
        ),
      ];
    }

    if (["women", "girls", "senior_women"].includes(input.audience)) {
      advice.makeupSuggestions = [
        optionalRecommendation(
          "natural-everyday",
          "Natural Everyday",
          "A light, understated look for everyday salon styling.",
        ),
        optionalRecommendation(
          "soft-glam",
          "Soft Glam",
          "Adds a polished finish without changing facial identity.",
        ),
        optionalRecommendation(
          "festive",
          "Festive",
          "A richer styling direction for celebrations or events.",
        ),
      ];
      advice.lipstickSuggestions = [
        optionalRecommendation(
          "rose-nude",
          "Rose Nude",
          "A soft neutral colour family for an understated finish.",
        ),
        optionalRecommendation(
          "mauve",
          "Mauve",
          "A balanced colour family for a polished salon look.",
        ),
        optionalRecommendation(
          "berry",
          "Berry",
          "A deeper colour family for a more expressive event look.",
        ),
      ];
    }

    return advice;
  }
}

export const localStyleAdvisor = new LocalStyleAdvisor();
