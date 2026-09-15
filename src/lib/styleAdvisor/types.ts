import type { HairAudience, HairColor, HairStyle } from "@/types";

export type AdvicePriority = "top_pick" | "great_match" | "worth_trying";

export type Recommendation = {
  id: string;
  label: string;
  reason: string;
  priority: AdvicePriority;
};

export type StyleProfile = {
  faceShape?: string;
  hairCharacteristics?: string[];
};

export type SalonStyleAdvice = StyleProfile & {
  recommendedHairstyles: Recommendation[];
  recommendedHairColors: Recommendation[];
  groomingSuggestions?: Recommendation[];
  makeupSuggestions?: Recommendation[];
  lipstickSuggestions?: Recommendation[];
  explanation: string;
};

export type StyleAdvisorInput = {
  image: string;
  audience: HairAudience | "all";
  styles: HairStyle[];
  colors: HairColor[];
};

export interface StyleAdvisorProvider {
  advise(input: StyleAdvisorInput): Promise<SalonStyleAdvice>;
}
