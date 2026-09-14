# GitHub Copilot Prompt — Lotus AI Hair Salon Mirror Multi-View Edition

You are working inside an EXISTING Next.js + React + TypeScript project named `lotus-ai-hair-salon-mirror`.

Do not create a replacement project. Improve this project in place.

## Product goal

Build a production-ready 32-inch portrait AI salon mirror for Lotus Prime Digital Solutions. The mirror must preserve the customer's real identity while allowing realistic hairstyle and hair-colour previews.

The customer must be captured from FOUR views:

1. FRONT
2. LEFT
3. RIGHT
4. BACK

After AI generation, the standee camera stays active. When the customer turns front, left, right or back, the displayed generated hairstyle should automatically switch to the matching generated view. Movement/orientation tracking should run locally and must NOT call a paid AI API for every camera frame.

## Existing flow to preserve

Attract/welcome video → approach detection → welcome → guided 4-view capture → hairstyle selection → colour selection → multi-view AI generation → live movement-driven result → product recommendations → QR → booking/payment.

## Highest-priority requirements

### 1. Identity / Face Lock

The customer's face must not change.

- Preserve eyes, nose, mouth, cheeks, facial geometry and skin identity.
- Hair is allowed to change.
- Do not restore the whole head because that would restore the original hairstyle.
- Apply face-lock compositing to front/left/right views.
- Back view normally has no visible face.
- Add a production-grade face similarity validation step before showing results.
- If similarity fails, reject/retry the generated result rather than showing a changed identity.

### 2. Four-view capture

Use these capture states:

```ts
type HairView = "front" | "left" | "right" | "back";
```

Guide the customer with voice and UI. Validate that the expected orientation is being held before capture. Add countdown, blur/sharpness checks, lighting checks, head visibility checks and retake controls.

### 3. Live orientation tracking

Improve `src/hooks/useHeadOrientation.ts`.

Use MediaPipe locally:

- FaceLandmarker for front/left/right head yaw.
- PoseLandmarker/body orientation for back-view detection.
- Smooth detections to prevent flicker.
- Make thresholds configurable.
- Respect mirrored camera mode.
- Do not send live camera frames to cloud AI.

The result screen must switch smoothly among generated front/left/right/back images as orientation changes.

### 4. Better multi-view consistency

The current starter can call a single-image hair API independently for each view. Improve this architecture so a future multi-view/reference-conditioned provider can be plugged in without changing the UI.

Create a provider interface such as:

```ts
interface HairGenerationProvider {
  generateMultiView(input: {
    views: Record<HairView, string>;
    style: string;
    color: string;
    preserveIdentity: true;
  }): Promise<Record<HairView, string>>;
}
```

Keep the existing fal provider as one implementation/fallback.

### 5. Cost control

A complete four-angle look can consume four paid generations. Add:

- per-session multi-view look limit;
- server-side usage accounting;
- configurable monthly budget;
- warning threshold;
- hard stop;
- lazy side/back generation option;
- preview vs HD-final modes;
- provider abstraction for later self-hosted Lotus AI Cloud.

Do not claim that switching images locally costs AI credits.

### 6. 32-inch portrait kiosk UX

Target 1080x1920 portrait.

- large touch targets;
- high contrast;
- customer distance roughly 0.8–1.5m;
- camera at/near eye level;
- clear silhouette/pose guides;
- fullscreen kiosk mode;
- inactivity reset;
- offline-friendly attract video;
- graceful camera/API/network errors.

### 7. Privacy

Add explicit consent before capture.

- State what images are captured and why.
- Do not persist biometric/face data longer than necessary.
- Delete captures/results after session timeout unless customer explicitly chooses save/share.
- QR links must be random, short-lived and non-guessable.
- Never expose raw API keys in browser code.

### 8. Supabase migration

Replace local `.data` session files with Supabase/Postgres + object storage when productionizing.

Suggested tables:

- salons
- standees
- services
- hairstyles
- hair_colors
- products
- sessions
- generated_looks
- ai_usage
- bookings
- payments

Use row-level security where applicable.

### 9. Lotus AI Cloud readiness

The UI should call Lotus-controlled backend endpoints, not provider APIs directly.

Target architecture:

Next.js kiosk → Lotus API → queue → GPU/provider worker → identity lock → quality check → temporary storage → kiosk/QR.

Prepare interfaces so fal.ai can later be replaced with a self-hosted commercially licensed hair-generation model.

### 10. Build quality

Before adding new features:

1. run `npm install`;
2. run `npm run build`;
3. fix every TypeScript/build error;
4. do not use `any` in new code unless absolutely necessary;
5. add reusable types and provider interfaces;
6. preserve existing functionality;
7. add comments only where they explain non-obvious vision/math behavior.

## Acceptance criteria

The project is acceptable when:

- a customer can capture front/left/right/back;
- wrong pose is rejected or clearly warned;
- all four hairstyle views can be generated;
- face identity is preserved on visible-face views;
- result automatically follows customer orientation locally;
- manual angle controls work as fallback;
- no continuous cloud AI calls happen during movement;
- QR/save and booking/payment flows still work;
- idle reset clears personal session data;
- project builds successfully with zero TypeScript errors.

## INDIAN HAIRSTYLE CATALOGUE REQUIREMENT

The project now contains an expanded Indian hairstyle catalogue in `src/data/catalog.ts` for:
- Women
- Men
- Girls
- Boys
- Senior women
- Senior men

Preserve and extend this catalogue. Do NOT replace it with a small generic Western hairstyle list.

Required coverage includes:
- Women's U-cut, V-cut, step cut, feather cut, butterfly cut, curtain bangs, bob/lob, pixie, waves/curls, ponytails, buns and multiple braid types.
- Regional/traditional/bridal references including Tamil bridal kondai/jadai, Telugu poola jada, Kerala bridal bun/jasmine braid, Karnataka bridal braid, Bengali bridal bun, Maharashtrian ambada, Punjabi paranda braid, Gujarati bridal bun and North Indian bridal bun.
- Men's classic and modern Indian salon cuts: side part, taper, low/mid/high fade, taper fade, undercut, textured crop, quiff, pompadour, crew, buzz, slick back, Bollywood textured, wavy/curly, long hair, man bun, top knot and traditional combed-back styles.
- Girls' and boys' age-appropriate school, everyday and festive styles.
- Senior women and senior men styles that preserve realistic hair density, natural grey/salt-and-pepper colour and existing/receding hairline unless the user explicitly asks to change it.

Each `HairStyle` has both:
- `falStyle`: current provider-compatible base hairstyle.
- `stylePrompt`: detailed style description for Lotus AI Cloud / future prompt-capable providers.

When implementing the Lotus AI Cloud provider, use `stylePrompt` plus the customer's front/left/right/back captures and optional salon-owned reference images. Maintain multi-view consistency and strict identity preservation.

For children, never add adult glamour/beautification logic. Use age-appropriate haircuts and styling only.

For senior customers, do not automatically make them younger or artificially increase hair density. Preserve age, facial identity, natural hairline and realistic density unless the customer explicitly selects a transformation that changes those characteristics.
