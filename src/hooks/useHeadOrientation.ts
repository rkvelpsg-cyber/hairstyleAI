"use client";
import { RefObject, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export type HeadOrientation = "front" | "left" | "right" | "back";

type TrackerState = {
  orientation: HeadOrientation;
  confidence: number;
  yaw: number;
  available: boolean;
  status: string;
};

const INITIAL: TrackerState = {
  orientation: "front",
  confidence: 0,
  yaw: 0,
  available: false,
  status: "Starting orientation tracker…"
};

let visionPromise: Promise<{ face: FaceLandmarker; pose: PoseLandmarker }> | null = null;

async function getVisionModels() {
  if (!visionPromise) {
    visionPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );
      const [face, pose] = await Promise.all([
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        }),
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minTrackingConfidence: 0.45
        })
      ]);
      return { face, pose };
    })();
  }
  return visionPromise;
}

function smoothOrientation(history: HeadOrientation[], next: HeadOrientation) {
  history.push(next);
  if (history.length > 5) history.shift();
  const counts = history.reduce<Record<HeadOrientation, number>>(
    (acc, value) => {
      acc[value] += 1;
      return acc;
    },
    { front: 0, left: 0, right: 0, back: 0 }
  );
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "front") as HeadOrientation;
}

export function useHeadOrientation(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean
) {
  const [state, setState] = useState<TrackerState>(INITIAL);
  const history = useRef<HeadOrientation[]>([]);
  const mirror = process.env.NEXT_PUBLIC_MIRROR_CAMERA !== "false";

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastVideoTime = -1;

    async function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.currentTime === lastVideoTime) {
        timer = setTimeout(tick, 140);
        return;
      }
      lastVideoTime = video.currentTime;
      try {
        const { face, pose } = await getVisionModels();
        const now = performance.now();
        const faceResult = face.detectForVideo(video, now);
        const poseResult = pose.detectForVideo(video, now);
        const faceLm = faceResult.faceLandmarks?.[0];
        const poseLm = poseResult.landmarks?.[0];

        let raw: HeadOrientation = "front";
        let confidence = 0.35;
        let yaw = 0;

        if (faceLm?.length) {
          const leftEye = faceLm[33];
          const rightEye = faceLm[263];
          const nose = faceLm[1];
          const eyeDistance = Math.max(0.0001, Math.abs(rightEye.x - leftEye.x));
          const eyeMid = (leftEye.x + rightEye.x) / 2;
          yaw = (nose.x - eyeMid) / eyeDistance;
          if (mirror) yaw *= -1;

          if (yaw < -0.22) raw = "left";
          else if (yaw > 0.22) raw = "right";
          else raw = "front";
          confidence = Math.min(0.98, 0.7 + Math.abs(yaw) * 0.25);
        } else if (poseLm?.length) {
          const nose = poseLm[0];
          const leftShoulder = poseLm[11];
          const rightShoulder = poseLm[12];
          const shouldersVisible =
            (leftShoulder?.visibility ?? 0) > 0.45 &&
            (rightShoulder?.visibility ?? 0) > 0.45;
          const noseVisible = (nose?.visibility ?? 0) > 0.35;
          if (shouldersVisible && !noseVisible) {
            raw = "back";
            confidence = 0.72;
          }
        }

        const orientation = smoothOrientation(history.current, raw);
        if (!cancelled) {
          setState({
            orientation,
            confidence,
            yaw,
            available: true,
            status: `Tracking ${orientation}`
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            available: false,
            status: error instanceof Error ? error.message : "Orientation tracker unavailable"
          }));
        }
      }
      timer = setTimeout(tick, 140);
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, mirror, videoRef]);

  return state;
}
