import type { HairColor, HairStyle, RetailProduct } from "@/types";

type Seed = Omit<HairStyle, "serviceName" | "servicePrice" | "thumbnail"> & {
  servicePrice?: number;
  thumbnail?: string;
};

const thumbFor = (falStyle: string) => {
  const map: Record<string, string> = {
    long_hair: "/styles/long.png",
    curly_hair: "/styles/curly.png",
    wavy_hair: "/styles/wavy.png",
    bob_cut: "/styles/bob.png",
    pixie_cut: "/styles/pixie.png",
    bangs: "/styles/bangs.png",
    side_part: "/styles/side.png",
    buzz_cut: "/styles/buzz.png",
    mohawk: "/styles/mohawk.png",
    braids: "/styles/braids.png"
  };
  return map[falStyle] || "/styles/long.png";
};

const seeds: Seed[] = [
  // WOMEN / GIRLS - modern and everyday Indian salon styles
  { id:"women-u-cut", label:"U-Cut Long Hair", falStyle:"long_hair", stylePrompt:"Indian woman with a clean long U-shaped haircut, natural volume, salon finish", audience:"women", category:"everyday" },
  { id:"women-v-cut", label:"V-Cut Long Hair", falStyle:"long_hair", stylePrompt:"Indian woman with long V-shaped layered haircut, neat tapered back", audience:"women", category:"everyday" },
  { id:"women-step-cut", label:"Classic Step Cut", falStyle:"long_hair", stylePrompt:"Indian woman with classic multi-step haircut, visible graduated layers", audience:"women", category:"modern" },
  { id:"women-feather", label:"Feather Cut", falStyle:"long_hair", stylePrompt:"Indian woman with soft feathered layers and face framing ends", audience:"women", category:"modern" },
  { id:"women-butterfly", label:"Butterfly Cut", falStyle:"long_hair", stylePrompt:"Indian woman with butterfly haircut, airy face-framing layers and long back", audience:"women", category:"modern" },
  { id:"women-curtain", label:"Curtain Bangs + Layers", falStyle:"bangs", stylePrompt:"Indian woman with long layered hair and soft curtain bangs", audience:"women", category:"modern" },
  { id:"women-side-bangs", label:"Side-Swept Bangs", falStyle:"bangs", stylePrompt:"Indian woman with elegant side-swept fringe and medium-long layers", audience:"women", category:"modern" },
  { id:"women-lob", label:"Long Bob (Lob)", falStyle:"bob_cut", stylePrompt:"Indian woman with polished shoulder-length long bob", audience:"women", category:"modern" },
  { id:"women-bob", label:"Classic Bob", falStyle:"bob_cut", stylePrompt:"Indian woman with neat chin-length classic bob", audience:"women", category:"modern" },
  { id:"women-a-line-bob", label:"A-Line Bob", falStyle:"bob_cut", stylePrompt:"Indian woman with A-line bob, slightly longer in front", audience:"women", category:"modern" },
  { id:"women-pixie", label:"Soft Pixie Cut", falStyle:"pixie_cut", stylePrompt:"Indian woman with feminine textured pixie cut", audience:"women", category:"modern" },
  { id:"women-straight", label:"Sleek Straight", falStyle:"long_hair", stylePrompt:"Indian woman with sleek straight long hair and natural center part", audience:"women", category:"everyday" },
  { id:"women-waves", label:"Soft Bollywood Waves", falStyle:"wavy_hair", stylePrompt:"Indian woman with soft glamorous Bollywood waves, realistic salon styling", audience:"women", category:"festive" },
  { id:"women-curls", label:"Defined Curls", falStyle:"curly_hair", stylePrompt:"Indian woman with defined natural-looking curls and balanced volume", audience:"women", category:"modern" },
  { id:"women-half-up", label:"Half-Up Half-Down", falStyle:"long_hair", stylePrompt:"Indian woman with half-up half-down hairstyle, soft volume and face framing", audience:"women", category:"festive" },
  { id:"women-high-pony", label:"High Ponytail", falStyle:"long_hair", stylePrompt:"Indian woman with sleek high ponytail and clean crown", audience:"women", category:"modern" },
  { id:"women-low-pony", label:"Low Ponytail", falStyle:"long_hair", stylePrompt:"Indian woman with elegant low ponytail and soft front strands", audience:"women", category:"everyday" },
  { id:"women-messy-bun", label:"Soft Messy Bun", falStyle:"long_hair", stylePrompt:"Indian woman with soft textured messy bun, elegant loose strands", audience:"women", category:"festive" },
  { id:"women-low-bun", label:"Classic Low Bun", falStyle:"long_hair", stylePrompt:"Indian woman with smooth classic low bun at the nape", audience:"women", category:"traditional" },
  { id:"women-high-bun", label:"High Bun", falStyle:"long_hair", stylePrompt:"Indian woman with polished high bun and smooth crown", audience:"women", category:"festive" },
  { id:"women-braided-bun", label:"Braided Bun", falStyle:"braids", stylePrompt:"Indian woman with elegant braided bun, realistic braid texture", audience:"women", category:"traditional" },
  { id:"women-fishtail", label:"Fishtail Braid", falStyle:"braids", stylePrompt:"Indian woman with long detailed fishtail braid", audience:"women", category:"festive" },
  { id:"women-french-braid", label:"French Braid", falStyle:"braids", stylePrompt:"Indian woman with neat full-length French braid", audience:"women", category:"everyday" },
  { id:"women-side-braid", label:"Side Braid", falStyle:"braids", stylePrompt:"Indian woman with long side braid over one shoulder", audience:"women", category:"traditional" },
  { id:"women-single-plait", label:"Traditional Single Plait", falStyle:"braids", stylePrompt:"Indian woman with long traditional single plait, clean center part", audience:"women", category:"traditional" },
  { id:"women-crown-braid", label:"Crown Braid", falStyle:"braids", stylePrompt:"Indian woman with elegant crown braid wrapped around the head", audience:"women", category:"festive" },
  { id:"women-waterfall", label:"Waterfall Braid", falStyle:"braids", stylePrompt:"Indian woman with soft waterfall braid and loose waves", audience:"women", category:"festive" },

  // REGIONAL / BRIDAL INDIAN WOMEN
  { id:"tamil-kondai", label:"Tamil Bridal Kondai", falStyle:"long_hair", stylePrompt:"Tamil bride hairstyle with traditional kondai bun, smooth crown, realistic floral-ready structure", audience:"women", category:"bridal", region:"Tamil Nadu" },
  { id:"tamil-jadai", label:"Tamil Bridal Jadai", falStyle:"braids", stylePrompt:"Tamil bridal long jadai braid with traditional structured plait suitable for jadai alankaram", audience:"women", category:"bridal", region:"Tamil Nadu" },
  { id:"telugu-poola-jada", label:"Telugu Poola Jada", falStyle:"braids", stylePrompt:"Telugu bridal long poola jada braid, traditional South Indian bridal silhouette", audience:"women", category:"bridal", region:"Andhra Pradesh / Telangana" },
  { id:"kerala-bridal-bun", label:"Kerala Bridal Low Bun", falStyle:"long_hair", stylePrompt:"Kerala bride with smooth low bun, center part, elegant traditional bridal finish", audience:"women", category:"bridal", region:"Kerala" },
  { id:"kerala-jasmine-braid", label:"Kerala Jasmine Braid", falStyle:"braids", stylePrompt:"Kerala woman with long traditional braid prepared for jasmine flowers, natural sleek crown", audience:"women", category:"traditional", region:"Kerala" },
  { id:"karnataka-bridal-braid", label:"Karnataka Bridal Braid", falStyle:"braids", stylePrompt:"Karnataka bride with long traditional braid and smooth center-part crown", audience:"women", category:"bridal", region:"Karnataka" },
  { id:"andhra-bridal-bun", label:"Andhra Bridal Bun", falStyle:"long_hair", stylePrompt:"Andhra bride with traditional voluminous low bridal bun and center part", audience:"women", category:"bridal", region:"Andhra Pradesh" },
  { id:"bengali-bridal-bun", label:"Bengali Bridal Bun", falStyle:"long_hair", stylePrompt:"Bengali bride with classic low rounded bun, center part and smooth traditional finish", audience:"women", category:"bridal", region:"West Bengal" },
  { id:"maharashtrian-ambada", label:"Maharashtrian Ambada", falStyle:"long_hair", stylePrompt:"Maharashtrian woman with traditional ambada bun at the back, neat and realistic", audience:"women", category:"traditional", region:"Maharashtra" },
  { id:"punjabi-paranda", label:"Punjabi Paranda Braid", falStyle:"braids", stylePrompt:"Punjabi woman with long thick braid styled for a traditional paranda", audience:"women", category:"traditional", region:"Punjab" },
  { id:"rajasthani-braid", label:"Rajasthani Traditional Braid", falStyle:"braids", stylePrompt:"Rajasthani woman with long traditional braid and smooth center part", audience:"women", category:"traditional", region:"Rajasthan" },
  { id:"gujarati-bridal-bun", label:"Gujarati Bridal Bun", falStyle:"long_hair", stylePrompt:"Gujarati bride with elegant traditional low bun and polished crown", audience:"women", category:"bridal", region:"Gujarat" },
  { id:"north-indian-bridal-bun", label:"North Indian Bridal Bun", falStyle:"long_hair", stylePrompt:"North Indian bride with full textured low bridal bun, center part and soft face framing", audience:"women", category:"bridal", region:"North India" },

  // GIRLS / TEENS
  { id:"girls-long-layers", label:"Girls Long Layers", falStyle:"long_hair", stylePrompt:"Indian teenage girl with age-appropriate long soft layers", audience:"girls", category:"everyday" },
  { id:"girls-shoulder-cut", label:"Shoulder-Length Cut", falStyle:"bob_cut", stylePrompt:"Indian girl with neat shoulder-length haircut, simple and age appropriate", audience:"girls", category:"school" },
  { id:"girls-bob", label:"Girls Bob Cut", falStyle:"bob_cut", stylePrompt:"Indian girl with neat classic bob suitable for school", audience:"girls", category:"school" },
  { id:"girls-single-braid", label:"School Single Braid", falStyle:"braids", stylePrompt:"Indian school girl with neat single braid and simple center part", audience:"girls", category:"school" },
  { id:"girls-double-braid", label:"School Double Braids", falStyle:"braids", stylePrompt:"Indian school girl with two neat braids, symmetrical and age appropriate", audience:"girls", category:"school" },
  { id:"girls-pigtails", label:"Pigtails", falStyle:"braids", stylePrompt:"Indian girl with two simple pigtails, tidy and age appropriate", audience:"girls", category:"school" },
  { id:"girls-half-up", label:"Girls Half-Up Style", falStyle:"long_hair", stylePrompt:"Indian girl with simple half-up half-down hairstyle", audience:"girls", category:"festive" },
  { id:"girls-festival-braid", label:"Festival Braid", falStyle:"braids", stylePrompt:"Indian girl with neat festive braid suitable for traditional dress", audience:"girls", category:"festive" },
  { id:"girls-soft-curls", label:"Soft Party Curls", falStyle:"curly_hair", stylePrompt:"Indian girl with soft age-appropriate party curls", audience:"girls", category:"festive" },

  // MEN
  { id:"men-classic-side", label:"Classic Side Part", falStyle:"side_part", stylePrompt:"Indian man with clean classic side-part haircut, professional salon finish", audience:"men", category:"everyday" },
  { id:"men-taper", label:"Classic Taper", falStyle:"side_part", stylePrompt:"Indian man with classic taper haircut and natural top", audience:"men", category:"modern" },
  { id:"men-low-fade", label:"Low Fade", falStyle:"side_part", stylePrompt:"Indian man with clean low fade and textured top", audience:"men", category:"modern" },
  { id:"men-mid-fade", label:"Mid Fade", falStyle:"side_part", stylePrompt:"Indian man with balanced mid fade and textured top", audience:"men", category:"modern" },
  { id:"men-high-fade", label:"High Fade", falStyle:"side_part", stylePrompt:"Indian man with sharp high fade and short textured top", audience:"men", category:"modern" },
  { id:"men-taper-fade", label:"Taper Fade", falStyle:"side_part", stylePrompt:"Indian man with clean taper fade and natural textured top", audience:"men", category:"modern" },
  { id:"men-undercut", label:"Undercut", falStyle:"side_part", stylePrompt:"Indian man with modern undercut and longer styled top", audience:"men", category:"modern" },
  { id:"men-textured-crop", label:"Textured Crop", falStyle:"side_part", stylePrompt:"Indian man with short textured crop and neat sides", audience:"men", category:"modern" },
  { id:"men-quiff", label:"Quiff", falStyle:"side_part", stylePrompt:"Indian man with voluminous quiff and clean tapered sides", audience:"men", category:"modern" },
  { id:"men-pompadour", label:"Pompadour", falStyle:"side_part", stylePrompt:"Indian man with polished pompadour, realistic volume and clean sides", audience:"men", category:"modern" },
  { id:"men-crew", label:"Crew Cut", falStyle:"buzz_cut", stylePrompt:"Indian man with classic crew cut, slightly longer top", audience:"men", category:"everyday" },
  { id:"men-buzz", label:"Buzz Cut", falStyle:"buzz_cut", stylePrompt:"Indian man with clean even buzz cut", audience:"men", category:"everyday" },
  { id:"men-slick-back", label:"Slick Back", falStyle:"side_part", stylePrompt:"Indian man with medium slicked-back hair, elegant salon finish", audience:"men", category:"festive" },
  { id:"men-bollywood", label:"Bollywood Textured Hair", falStyle:"wavy_hair", stylePrompt:"Indian man with medium textured Bollywood-style hair, natural movement", audience:"men", category:"modern" },
  { id:"men-wavy", label:"Natural Wavy Medium", falStyle:"wavy_hair", stylePrompt:"Indian man with medium natural wavy hair and balanced volume", audience:"men", category:"everyday" },
  { id:"men-curly", label:"Curly Top", falStyle:"curly_hair", stylePrompt:"Indian man with defined curly top and tidy sides", audience:"men", category:"modern" },
  { id:"men-long", label:"Long Layered Hair", falStyle:"long_hair", stylePrompt:"Indian man with long layered hair and natural movement", audience:"men", category:"modern" },
  { id:"men-man-bun", label:"Man Bun", falStyle:"long_hair", stylePrompt:"Indian man with neat man bun and natural hairline", audience:"men", category:"modern" },
  { id:"men-top-knot", label:"Top Knot", falStyle:"long_hair", stylePrompt:"Indian man with modern top knot and clean side profile", audience:"men", category:"modern" },
  { id:"men-traditional-comb", label:"Traditional Combed Back", falStyle:"side_part", stylePrompt:"Indian man with classic neatly combed-back hairstyle suitable for traditional wear", audience:"men", category:"traditional" },
  { id:"men-south-classic", label:"South Indian Classic Short", falStyle:"side_part", stylePrompt:"Indian man with simple classic short haircut, natural side part and conservative finish", audience:"men", category:"traditional" },

  // BOYS
  { id:"boys-school-side", label:"Boys School Side Part", falStyle:"side_part", stylePrompt:"Indian school boy with tidy short side-part haircut", audience:"boys", category:"school" },
  { id:"boys-crew", label:"Boys Crew Cut", falStyle:"buzz_cut", stylePrompt:"Indian boy with clean age-appropriate crew cut", audience:"boys", category:"school" },
  { id:"boys-short-crop", label:"Short Textured Crop", falStyle:"side_part", stylePrompt:"Indian boy with short textured crop, tidy and age appropriate", audience:"boys", category:"modern" },
  { id:"boys-curly-short", label:"Curly Short Cut", falStyle:"curly_hair", stylePrompt:"Indian boy with neat short natural curls", audience:"boys", category:"everyday" },
  { id:"boys-bowl", label:"Modern Bowl Cut", falStyle:"bob_cut", stylePrompt:"Indian boy with modern soft bowl haircut, tidy edges", audience:"boys", category:"modern" },
  { id:"boys-spikes", label:"Soft Spikes", falStyle:"side_part", stylePrompt:"Indian boy with soft short spikes and tidy sides", audience:"boys", category:"modern" },
  { id:"boys-taper", label:"Boys Taper", falStyle:"side_part", stylePrompt:"Indian boy with subtle taper haircut, school-friendly and neat", audience:"boys", category:"school" },

  // SENIOR WOMEN
  { id:"senior-women-short-bob", label:"Senior Short Bob", falStyle:"bob_cut", stylePrompt:"Older Indian woman with elegant short bob, natural grey or salt-and-pepper texture", audience:"senior_women", category:"everyday" },
  { id:"senior-women-pixie", label:"Senior Soft Pixie", falStyle:"pixie_cut", stylePrompt:"Older Indian woman with soft low-maintenance pixie haircut", audience:"senior_women", category:"modern" },
  { id:"senior-women-shoulder", label:"Shoulder-Length Layers", falStyle:"long_hair", stylePrompt:"Older Indian woman with graceful shoulder-length layers and natural volume", audience:"senior_women", category:"everyday" },
  { id:"senior-women-soft-curls", label:"Soft Short Curls", falStyle:"curly_hair", stylePrompt:"Older Indian woman with soft short curls and realistic natural texture", audience:"senior_women", category:"festive" },
  { id:"senior-women-low-bun", label:"Traditional Low Bun", falStyle:"long_hair", stylePrompt:"Older Indian woman with classic low bun and smooth center or side part", audience:"senior_women", category:"traditional" },
  { id:"senior-women-braid", label:"Traditional Long Braid", falStyle:"braids", stylePrompt:"Older Indian woman with neat traditional long braid, natural grey or dark hair", audience:"senior_women", category:"traditional" },
  { id:"senior-women-volume", label:"Soft Crown Volume", falStyle:"wavy_hair", stylePrompt:"Older Indian woman with elegant soft crown volume and short-medium styled hair", audience:"senior_women", category:"festive" },

  // SENIOR MEN
  { id:"senior-men-side", label:"Senior Classic Side Part", falStyle:"side_part", stylePrompt:"Older Indian man with classic side part, natural salt-and-pepper hair", audience:"senior_men", category:"everyday" },
  { id:"senior-men-taper", label:"Senior Taper", falStyle:"side_part", stylePrompt:"Older Indian man with conservative taper haircut and natural grey texture", audience:"senior_men", category:"everyday" },
  { id:"senior-men-crew", label:"Senior Crew Cut", falStyle:"buzz_cut", stylePrompt:"Older Indian man with neat crew cut, natural receding hairline preserved", audience:"senior_men", category:"everyday" },
  { id:"senior-men-buzz", label:"Senior Buzz Cut", falStyle:"buzz_cut", stylePrompt:"Older Indian man with clean low-maintenance buzz cut", audience:"senior_men", category:"everyday" },
  { id:"senior-men-combed-back", label:"Classic Combed Back", falStyle:"side_part", stylePrompt:"Older Indian man with dignified combed-back hair, natural grey and realistic density", audience:"senior_men", category:"traditional" },
  { id:"senior-men-medium", label:"Medium Natural Sweep", falStyle:"wavy_hair", stylePrompt:"Older Indian man with medium natural swept hairstyle and realistic salt-and-pepper texture", audience:"senior_men", category:"festive" }
];

export const hairStyles: HairStyle[] = seeds.map((s) => ({
  ...s,
  serviceName: s.label,
  servicePrice: s.servicePrice ?? (s.category === "bridal" ? 3500 : s.category === "festive" ? 1800 : 900),
  thumbnail: s.thumbnail ?? thumbFor(s.falStyle)
}));

export const hairColors: HairColor[] = [
  { id:"natural", label:"Keep Natural", falColor:"natural", serviceName:"Natural Hair", servicePrice:0 },
  { id:"natural_black", label:"Natural Black", falColor:"black", serviceName:"Natural Black Colour", servicePrice:1800 },
  { id:"soft_black", label:"Soft Black", falColor:"black", serviceName:"Soft Black Colour", servicePrice:1900 },
  { id:"dark_brown", label:"Dark Brown", falColor:"dark_brown", serviceName:"Dark Brown Colour", servicePrice:2200 },
  { id:"chocolate", label:"Chocolate Brown", falColor:"dark_brown", serviceName:"Chocolate Brown Colour", servicePrice:2500 },
  { id:"mahogany", label:"Mahogany", falColor:"auburn", serviceName:"Mahogany Colour", servicePrice:2700 },
  { id:"burgundy", label:"Burgundy", falColor:"red", serviceName:"Burgundy Colour", servicePrice:2800 },
  { id:"copper", label:"Copper", falColor:"auburn", serviceName:"Copper Colour", servicePrice:2900 },
  { id:"caramel", label:"Caramel", falColor:"highlights", serviceName:"Caramel Colour", servicePrice:3200 },
  { id:"highlights", label:"Caramel Highlights", falColor:"highlights", serviceName:"Caramel Highlights", servicePrice:3400 },
  { id:"balayage", label:"Brown Balayage", falColor:"balayage", serviceName:"Brown Balayage", servicePrice:4200 },
  { id:"grey", label:"Natural Grey / Silver", falColor:"gray", serviceName:"Grey / Silver Tone", servicePrice:2400 }
];

export const retailProducts: RetailProduct[] = [
  { id:"rp1", name:"Heat Protection Spray", price:699, tags:["wavy_hair","curly_hair","long_hair"] },
  { id:"rp2", name:"Curl Defining Cream", price:799, tags:["curly_hair"] },
  { id:"rp3", name:"Colour Protect Shampoo", price:899, tags:["black","dark_brown","auburn","red","highlights","balayage","gray"] },
  { id:"rp4", name:"Hair Serum", price:599, tags:["long_hair","wavy_hair","bob_cut","pixie_cut","braids"] }
];
