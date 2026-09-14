# Lotus AI Hair Salon Mirror — Multi-View Edition

A 32-inch portrait AI salon mirror prototype built with Next.js, React, TypeScript, MediaPipe and a pluggable hair-generation API.

## What changed in this edition

The customer is now captured from four guided views:

1. Front
2. Left side
3. Right side
4. Back

After the hairstyle is generated for all four views, the standee keeps the camera active and uses local MediaPipe head/body orientation tracking. When the customer turns left, right, front or back, the displayed AI hairstyle switches to the matching generated view.

This avoids generating a fresh AI frame continuously. AI generation happens only when the customer chooses a hairstyle/colour; the live movement tracking itself runs locally.

## Customer flow

Welcome video → customer approaches → welcome message → four-view capture → hairstyle selection → hair colour → generate four views → live movement-driven preview → QR/save → recommended products → booking/payment.

## Important identity rule

Front/left/right generated views are post-processed with `src/lib/faceLock.ts`, which restores the inner face region from the original captured angle. The back view has no visible face, so face lock is not applied there.

This starter improves identity preservation but is not a biometric guarantee. Before commercial deployment, add a production-grade identity similarity check and test the selected hair model on your real salon dataset.

## Run in Visual Studio Code

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and allow camera access.

For initial UI testing, keep:

```env
HAIR_AI_PROVIDER=mock
```

For the configured fal.ai integration:

```env
HAIR_AI_PROVIDER=fal
FAL_KEY=your_key_here
```

## Multi-view settings

```env
NEXT_PUBLIC_MIRROR_CAMERA=true
NEXT_PUBLIC_MAX_MULTI_VIEW_LOOKS_PER_SESSION=3
```

Each complete multi-view hairstyle currently makes up to **four AI image generations**: front, left, right and back. This gives a more realistic movement experience, but it costs roughly four times as much as a single-image hairstyle preview when using a per-image provider.

For production cost reduction, consider:

- generating front first and lazy-generating side/back only when requested;
- using lower-cost preview inference for side/back;
- self-hosting a commercially licensed hair model;
- caching customer preprocessing within the session;
- generating HD only for the final selected style.

## Live orientation tracking

`src/hooks/useHeadOrientation.ts` uses MediaPipe FaceLandmarker and PoseLandmarker.

- Front/left/right: estimated from face landmarks and head yaw.
- Back: inferred when shoulders remain visible while face/nose confidence disappears.
- Five recent detections are smoothed to reduce flicker.
- Manual angle buttons remain available as fallback.

This is a practical kiosk heuristic, not full 3D reconstruction.

## Key files

- `src/components/HairMirrorApp.tsx` — full customer journey
- `src/hooks/useHeadOrientation.ts` — live front/left/right/back tracking
- `src/hooks/useCamera.ts` — webcam management
- `src/lib/faceLock.ts` — identity-preserving face composite
- `src/app/api/hair/route.ts` — hair AI provider route
- `src/app/api/session/route.ts` — QR session storage
- `src/app/api/payment/order/route.ts` — Razorpay order creation
- `COPILOT_PROMPT.md` — continuation prompt for GitHub Copilot

## Production work still required

- benchmark hairstyle consistency across four angles;
- use a true multi-view/reference-conditioned model if available;
- add automatic image quality scoring before capture;
- add explicit privacy/consent UI and timed deletion;
- move session data from local `.data` files to Supabase/object storage;
- add server-side usage accounting and rate limits;
- add payment signature verification;
- package MediaPipe models locally if kiosk must work offline;
- run a full TypeScript/build/test pass before deployment.

## Indian hairstyle catalogue update

This build includes an expanded Indian salon catalogue covering women, men, girls, boys, senior women and senior men. It includes modern cuts, school-friendly children styles, traditional braids/buns, and regional bridal references such as Tamil bridal kondai/jadai, Telugu poola jada, Kerala bridal bun/jasmine braid, Karnataka bridal braid, Bengali bridal bun, Maharashtrian ambada, Punjabi paranda braid, Gujarati bridal bun and North Indian bridal bun.

The style picker now has audience filters and free-text search.

### Important provider note

The current `fal-ai/image-apps-v2/hair-change` integration accepts a limited predefined hairstyle vocabulary. Each Indian catalogue style therefore has:

- `falStyle`: a compatible base hairstyle used by the current provider.
- `stylePrompt`: a richer description intended for Lotus AI Cloud or another prompt-capable/custom hairstyle model.

For exact bridal/regional styling, do not assume the base FAL hairstyle enum alone can reproduce every accessory, flower arrangement, braid ornament or regional bridal construction. The production Lotus AI Cloud should use `stylePrompt`, reference images and a model/provider that supports reference-conditioned or prompt-conditioned hair editing while preserving the customer's face.
