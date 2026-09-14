"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("This browser does not support webcam access.");
      setReady(false);
      return;
    }

    try {
      if (streamRef.current) {
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
          await videoRef.current.play().catch(() => undefined);
          setReady(true);
        }
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      setReady(true);
      setError(null);
    } catch (e) {
      setReady(false);
      setError(e instanceof Error ? e.message : "Camera unavailable");
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, streamRef, ready, error, start, stop };
}
