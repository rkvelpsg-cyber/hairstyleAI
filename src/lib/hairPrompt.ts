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
  const isBuzzCut = /^buzz cut$/i.test(styleLabel || "");
  const colour =
    color && color !== "natural"
      ? `Use a realistic ${color} hair colour.`
      : "Keep the natural hair colour.";
  return [
    "Modify only scalp hair. Preserve exact customer identity.",
    "Preserve eyes, eyebrows, nose, mouth, skin tone, moustache, beard, eyeglasses and facial geometry.",
    "Do not beautify the customer. Do not change apparent age. Do not change head pose unnecessarily.",
    `Create this professional salon hairstyle: ${hairstyle}.`,
    isBuzzCut
      ? "Create a true very short uniform clipper-cut buzz cut with approximately a #1 to #2 guard appearance. Keep hair closely cropped across the entire scalp with minimal volume, short top, short sides, and short back. Do not create a side part, comb-over, quiff, pompadour, swept-back hair, layered hair, fringe, long top, or styled volume. Show realistic scalp visibility, a natural hairline, realistic Indian male hair texture, and a professional barber finish."
      : isLowFade
        ? "Create a realistic men's low fade haircut. Start the gradual fade low near the ears and temples, with smooth short sides, preserved natural top length, a textured top, a realistic hairline, natural Indian male hair texture, and a salon-quality finish."
        : "Keep a natural hairline, realistic strand texture, and a salon-quality finish.",
    colour,
    color === "gray"
      ? "Apply silver only to scalp hair. Do not recolour eyebrows, moustache, beard, or any other facial hair."
      : "",
    "Maintain the original background, shoulders, and camera framing.",
  ].join(" ");
}
