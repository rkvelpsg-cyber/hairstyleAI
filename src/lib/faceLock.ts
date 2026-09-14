import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

type Landmark = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };
type FaceData = {
  image: HTMLImageElement;
  landmarks: Landmark[];
  bounds: Bounds;
};
type MaskDebug = { hardMask: string; softMask: string };
type IdentityQuality = { valid: boolean; score: number };

const FACE_OUTLINE = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 377, 152, 148,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const QUALITY_POINTS = [
  33, 133, 159, 145, 263, 362, 386, 374, 70, 105, 336, 300, 1, 61, 291, 13, 14,
  152, 172, 132, 361,
];
const LEFT_EYE = 33;
const RIGHT_EYE = 263;
const NOSE = 1;
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
      );
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.65,
      });
    })();
  }
  return landmarkerPromise;
}

async function loadImage(source: string) {
  const image = new Image();
  if (source.startsWith("data:") || source.startsWith("blob:"))
    image.src = source;
  else {
    const response = await fetch(source);
    if (!response.ok) throw new Error("Unable to load the AI result");
    image.src = URL.createObjectURL(await response.blob());
  }
  await image.decode();
  return image;
}

function point(landmark: Landmark, image: HTMLImageElement) {
  return {
    x: landmark.x * image.naturalWidth,
    y: landmark.y * image.naturalHeight,
  };
}

async function analyseFace(source: string): Promise<FaceData> {
  const [image, landmarker] = await Promise.all([
    loadImage(source),
    getLandmarker(),
  ]);
  const landmarks = landmarker.detect(image).faceLandmarks[0] as
    | Landmark[]
    | undefined;
  if (!landmarks?.length) throw new Error("A clear face could not be detected");
  const xs = landmarks.map((landmark) => landmark.x * image.naturalWidth);
  const ys = landmarks.map((landmark) => landmark.y * image.naturalHeight);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    image,
    landmarks,
    bounds: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y },
  };
}

function qualityMetrics(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image analysis is unavailable");
  context.drawImage(image, 0, 0, 96, 96);
  const pixels = context.getImageData(0, 0, 96, 96).data;
  let brightness = 0;
  let sharpness = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray =
      pixels[index] * 0.2126 +
      pixels[index + 1] * 0.7152 +
      pixels[index + 2] * 0.0722;
    brightness += gray;
    if (index >= 4)
      sharpness += Math.abs(
        gray -
          (pixels[index - 4] * 0.2126 +
            pixels[index - 3] * 0.7152 +
            pixels[index - 2] * 0.0722),
      );
  }
  return {
    brightness: brightness / (pixels.length / 4),
    sharpness: sharpness / (pixels.length / 4),
  };
}

export async function validateFrontCapture(source: string) {
  try {
    const face = await analyseFace(source);
    const { image, landmarks, bounds } = face;
    const leftEye = landmarks[LEFT_EYE];
    const rightEye = landmarks[RIGHT_EYE];
    const eyeDistance = Math.max(0.001, Math.abs(rightEye.x - leftEye.x));
    const yaw = Math.abs(
      (landmarks[NOSE].x - (leftEye.x + rightEye.x) / 2) / eyeDistance,
    );
    const roll = Math.abs(leftEye.y - rightEye.y) / eyeDistance;
    const faceWidth = bounds.width / image.naturalWidth;
    const faceTop = bounds.y / image.naturalHeight;
    const faceBottom = (bounds.y + bounds.height) / image.naturalHeight;
    const { brightness, sharpness } = qualityMetrics(image);
    if (faceWidth < 0.2)
      return {
        valid: false,
        message: "Please move closer so your face is clearly visible.",
      };
    if (faceWidth > 0.58 || faceBottom > 0.84)
      return {
        valid: false,
        message:
          "Please move back so your full hairstyle and shoulders are visible.",
      };
    if (faceTop < 0.11)
      return {
        valid: false,
        message: "Please leave more space above your hairstyle.",
      };
    if (landmarks[234].x < 0.06 || landmarks[454].x > 0.94)
      return {
        valid: false,
        message: "Please center your head and keep both temples visible.",
      };
    if (yaw > 0.13 || roll > 0.1)
      return {
        valid: false,
        message: "Please keep your head upright and face the camera directly.",
      };
    if (brightness < 50)
      return {
        valid: false,
        message: "The lighting is too dark. Please add light to your face.",
      };
    if (sharpness < 11)
      return {
        valid: false,
        message: "The image is blurry. Hold still and try again.",
      };
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message:
        error instanceof Error
          ? error.message
          : "Capture quality could not be verified.",
    };
  }
}

function drawFacePath(context: CanvasRenderingContext2D, face: FaceData) {
  FACE_OUTLINE.forEach((index, position) => {
    const target = point(face.landmarks[index], face.image);
    if (position === 0) context.moveTo(target.x, target.y);
    else context.lineTo(target.x, target.y);
  });
  context.closePath();
}

export function createFaceProtectionMask(
  width: number,
  height: number,
  face: FaceData,
) {
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const context = mask.getContext("2d");
  if (!context) throw new Error("Face mask is unavailable");
  context.beginPath();
  drawFacePath(context, face);
  context.fillStyle = "white";
  context.fill();
  const eyeRadius = face.bounds.width * 0.16;
  [LEFT_EYE, RIGHT_EYE].forEach((index) => {
    const eye = point(face.landmarks[index], face.image);
    context.beginPath();
    context.ellipse(
      eye.x,
      eye.y,
      eyeRadius,
      eyeRadius * 0.62,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  });
  return mask;
}

function createSoftTransitionMask(hardMask: HTMLCanvasElement) {
  const mask = document.createElement("canvas");
  mask.width = hardMask.width;
  mask.height = hardMask.height;
  const context = mask.getContext("2d");
  if (!context) throw new Error("Soft mask is unavailable");
  context.filter = `blur(${Math.max(10, hardMask.width * 0.018)}px)`;
  context.drawImage(hardMask, 0, 0);
  return mask;
}

function alignGeneratedToOriginal(original: FaceData, generated: FaceData) {
  const sourceLeft = point(generated.landmarks[LEFT_EYE], generated.image);
  const sourceRight = point(generated.landmarks[RIGHT_EYE], generated.image);
  const targetLeft = point(original.landmarks[LEFT_EYE], original.image);
  const targetRight = point(original.landmarks[RIGHT_EYE], original.image);
  const sourceVector = {
    x: sourceRight.x - sourceLeft.x,
    y: sourceRight.y - sourceLeft.y,
  };
  const targetVector = {
    x: targetRight.x - targetLeft.x,
    y: targetRight.y - targetLeft.y,
  };
  const sourceLength = Math.max(1, Math.hypot(sourceVector.x, sourceVector.y));
  const targetLength = Math.max(1, Math.hypot(targetVector.x, targetVector.y));
  const scale = targetLength / sourceLength;
  const cosine =
    (sourceVector.x * targetVector.x + sourceVector.y * targetVector.y) /
    (sourceLength * targetLength);
  const sine =
    (sourceVector.x * targetVector.y - sourceVector.y * targetVector.x) /
    (sourceLength * targetLength);
  const a = scale * cosine;
  const b = scale * sine;
  const c = -b;
  const d = a;
  const e = targetLeft.x - a * sourceLeft.x - c * sourceLeft.y;
  const f = targetLeft.y - b * sourceLeft.x - d * sourceLeft.y;
  const canvas = document.createElement("canvas");
  canvas.width = original.image.naturalWidth;
  canvas.height = original.image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image alignment is unavailable");
  context.setTransform(a, b, c, d, e, f);
  context.drawImage(generated.image, 0, 0);
  context.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

export function featherComposite(original: FaceData, generated: FaceData) {
  const aligned = alignGeneratedToOriginal(original, generated);
  const output = document.createElement("canvas");
  output.width = original.image.naturalWidth;
  output.height = original.image.naturalHeight;
  const context = output.getContext("2d");
  if (!context) throw new Error("Face compositing is unavailable");
  context.drawImage(aligned, 0, 0);
  const hardMask = createFaceProtectionMask(
    output.width,
    output.height,
    original,
  );
  const softMask = createSoftTransitionMask(hardMask);
  const protectedFace = document.createElement("canvas");
  protectedFace.width = output.width;
  protectedFace.height = output.height;
  const protectedContext = protectedFace.getContext("2d");
  if (!protectedContext) throw new Error("Face compositing is unavailable");
  protectedContext.drawImage(original.image, 0, 0);
  protectedContext.globalCompositeOperation = "destination-in";
  protectedContext.drawImage(softMask, 0, 0);
  context.drawImage(protectedFace, 0, 0);
  return {
    output,
    debug: {
      hardMask: hardMask.toDataURL("image/png"),
      softMask: softMask.toDataURL("image/png"),
    },
  };
}

export function applyOriginalFace(original: FaceData, generated: FaceData) {
  return featherComposite(original, generated).output.toDataURL(
    "image/jpeg",
    0.95,
  );
}

export async function validateIdentity(
  originalSource: string,
  finalSource: string,
): Promise<IdentityQuality> {
  try {
    const [original, final] = await Promise.all([
      analyseFace(originalSource),
      analyseFace(finalSource),
    ]);
    const geometry =
      QUALITY_POINTS.reduce((total, index) => {
        const source = original.landmarks[index];
        const result = final.landmarks[index];
        const sourceX =
          (source.x * original.image.naturalWidth - original.bounds.x) /
          original.bounds.width;
        const sourceY =
          (source.y * original.image.naturalHeight - original.bounds.y) /
          original.bounds.height;
        const resultX =
          (result.x * final.image.naturalWidth - final.bounds.x) /
          final.bounds.width;
        const resultY =
          (result.y * final.image.naturalHeight - final.bounds.y) /
          final.bounds.height;
        return total + Math.hypot(sourceX - resultX, sourceY - resultY);
      }, 0) / QUALITY_POINTS.length;
    const sizeDifference = Math.abs(
      original.bounds.width / original.image.naturalWidth -
        final.bounds.width / final.image.naturalWidth,
    );
    const positionDifference = Math.hypot(
      original.bounds.x / original.image.naturalWidth -
        final.bounds.x / final.image.naturalWidth,
      original.bounds.y / original.image.naturalHeight -
        final.bounds.y / final.image.naturalHeight,
    );
    const score = Math.max(
      0,
      1 - geometry * 3 - sizeDifference * 1.5 - positionDifference * 1.5,
    );
    return { valid: score >= 0.78, score };
  } catch {
    return { valid: false, score: 0 };
  }
}

export async function lockFaceOnly(
  originalSource: string,
  generatedSource: string,
): Promise<{
  image: string;
  applied: boolean;
  message?: string;
  debug?: MaskDebug;
}> {
  try {
    const [original, generated] = await Promise.all([
      analyseFace(originalSource),
      analyseFace(generatedSource),
    ]);
    const composite = featherComposite(original, generated);
    const image = composite.output.toDataURL("image/jpeg", 0.95);
    const quality = await validateIdentity(originalSource, image);
    return quality.valid
      ? { image, applied: true, debug: composite.debug }
      : {
          image: originalSource,
          applied: false,
          message: "Result quality is low. Please try again.",
        };
  } catch {
    return {
      image: originalSource,
      applied: false,
      message: "Result quality is low. Please try again.",
    };
  }
}
