export type HairAudience =
  | "women"
  | "men"
  | "girls"
  | "boys"
  | "senior_women"
  | "senior_men"
  | "unisex";

export type HairStyle = {
  id: string;
  label: string;
  falStyle: string;
  /** Rich description for future Lotus AI Cloud / prompt-capable providers. */
  stylePrompt: string;
  audience: HairAudience;
  category:
    | "traditional"
    | "modern"
    | "bridal"
    | "everyday"
    | "school"
    | "festive";
  region?: string;
  serviceName: string;
  servicePrice: number;
  thumbnail: string;
};

export type HairColor = {
  id: string;
  label: string;
  falColor: string;
  providerColor?: string;
  serviceName: string;
  servicePrice: number;
};

export type RetailProduct = {
  id: string;
  name: string;
  price: number;
  tags: string[];
};

export type HairView = "front" | "left" | "right" | "back";
export type HairViewImages = Partial<Record<HairView, string>>;
