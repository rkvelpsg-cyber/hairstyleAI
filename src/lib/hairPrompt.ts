type HairPromptInput = {
  styleId?: string;
  styleLabel?: string;
  stylePrompt?: string;
  color?: string;
};

export function buildStylePrompt({ styleId, stylePrompt }: HairPromptInput) {
  if (styleId === "men-buzz-cut") {
    return "Give this person a genuine professional men's BUZZ CUT. The scalp hair must be extremely short and closely clipped, approximately clipper guard #1 to #2 with about 3 to 6 mm visible hair length. Keep nearly uniform short length across the top, closely cropped sides and back, minimal hair volume, visible scalp contour, stubble-like hair texture, natural hairline, realistic Indian male hair density, and a professional barber finish. Do NOT create side-combed hair, a side part, swept hair, brushed hair, comb-over, quiff, pompadour, fringe, long top, layered hair, voluminous hair, styled strands, or medium-length hair. This must visibly look recently cut with electric clippers.";
  }
  return stylePrompt || "a natural salon hairstyle";
}

export function buildHairPrompt({
  styleId,
  styleLabel,
  stylePrompt,
  color,
}: HairPromptInput) {
  const hairstyle = buildStylePrompt({ styleId, stylePrompt });
  const isLowFade = /low fade/i.test(styleLabel || "");
  const isBuzzCut = styleId === "men-buzz-cut";
  const colour =
    color && color !== "natural"
      ? `Use a realistic ${color} hair colour.`
      : "Keep the natural hair colour.";
  return [
    "Edit the original photograph in place. Modify only the scalp hair and, when requested, its colour. Preserve the exact customer identity and the original face as real pixels.",
    "Preserve eyes, eyebrows, nose, mouth, skin tone, moustache, beard, eyeglasses and facial geometry.",
    "Keep the entire face as one continuous natural face: no face mask, face overlay, split face, duplicate face, hard vertical or horizontal boundary, patch, halo, translucent band, or different skin tone on any part of the forehead, cheeks, nose, mouth, jaw, or neck.",
    "Do not redraw, repaint, retouch, smooth, reshape, relight, beautify, age, de-age, or reconstruct any facial area. Do not add makeup or facial shadows.",
    "Do not beautify the customer. Do not change apparent age. Do not change head pose unnecessarily.",
    `Create this professional salon hairstyle: ${hairstyle}.`,
    isBuzzCut
      ? "Use the exact Buzz Cut definition above as the highest-priority hairstyle instruction."
      : isLowFade
        ? "Create a realistic men's low fade haircut. Start the gradual fade low near the ears and temples, with smooth short sides, preserved natural top length, a textured top, a realistic hairline, natural Indian male hair texture, and a salon-quality finish."
        : "Keep a natural hairline, realistic strand texture, and a salon-quality finish.",
    colour,
    color === "gray" || color === "silver"
      ? "Change only scalp hair colour to realistic natural human silver, not metallic paint. Do not recolour eyebrows, moustache, beard, eyelashes, or any other facial hair."
      : "",
    "Maintain the original background, shoulders, clothing, lighting, camera framing, perspective, and image texture. Blend new hair naturally into the existing hairline with realistic strands and shadows.",
  ].join(" ");
}
