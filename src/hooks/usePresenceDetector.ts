"use client";
import { useEffect, useRef, useState } from "react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

export function usePresenceDetector(
  video: HTMLVideoElement | null,
  enabled: boolean,
) {
  const detector = useRef<FaceDetector | null>(null);
  const [present, setPresent] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setPresent(false);
      return;
    }

    let dead = false;
    let timer: number | undefined;

    const loop = () => {
      if (dead) return;

      if (
        video &&
        video.readyState >= 2 &&
        detector.current &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const result = detector.current.detectForVideo(
          video,
          performance.now(),
        );
        const ratio = Number(
          process.env.NEXT_PUBLIC_PRESENCE_FACE_RATIO || 0.17,
        );
        const found = result.detections.some(
          (d) =>
            !!d.boundingBox && d.boundingBox.width / video.videoWidth >= ratio,
        );
        setPresent(found);
      } else {
        setPresent(false);
      }

      timer = window.setTimeout(loop, 400);
    };

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
        );

        detector.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });

        loop();
      } catch (e) {
        console.warn("Presence detector fallback", e);
        setPresent(false);
      }
    })();

    return () => {
      dead = true;
      if (timer) clearTimeout(timer);
      detector.current?.close();
      detector.current = null;
    };
  }, [video, enabled]);

  return present;
}
