import type { HairStyle } from "@/types";

export type StyleValidationResult = {
  passed: boolean;
  confidence?: number;
  reasons: string[];
};

export interface HairstyleValidator {
  validate(
    originalImage: string,
    generatedImage: string,
    selectedStyle: HairStyle,
  ): Promise<StyleValidationResult>;
}
