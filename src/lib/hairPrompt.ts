type HairPromptInput = {
  styleLabel?: string;
  stylePrompt?: string;
  color?: string;
};

export function buildHairPrompt({
  styleLabel,
  stylePrompt,
  color,
}: HairPromptInput) {
  const hairstyle = stylePrompt || styleLabel || "a natural salon hairstyle";
  const isLowFade = /low fade/i.test(styleLabel || "");
  const colour =
    color && color !== "natural"
      ? `Use a realistic ${color} hair colour.`
      : "Keep the natural hair colour.";
  return [
    "Modify only scalp hair. Preserve exact customer identity.",
    "Preserve eyes, eyebrows, nose, mouth, skin tone, moustache, beard, eyeglasses and facial geometry.",
    "Do not beautify the customer. Do not change apparent age. Do not change head pose unnecessarily.",
    `Create this professional salon hairstyle: ${hairstyle}.`,
    isLowFade
      ? "Create a realistic men's low fade haircut. Start the gradual fade low near the ears and temples, with smooth short sides, preserved natural top length, a textured top, a realistic hairline, natural Indian male hair texture, and a salon-quality finish."
      : "Keep a natural hairline, realistic strand texture, and a salon-quality finish.",
    colour,
    "Maintain the original background, shoulders, and camera framing.",
  ].join(" ");
}
