"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState =
  | "idle"
  | "requesting_permission"
  | "starting_camera"
  | "camera_ready"
  | "camera_error";

function friendlyCameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access is required for hairstyle preview.";
  if (name === "NotFoundError") return "No camera was detected.";
  if (name === "NotReadableError")
    return "Camera is being used by another application.";
  return "Camera could not be started. Please try again.";
}

function debug(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production")
    console.info(`[camera] ${event}`, details || {});
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const ready = state === "camera_ready";

  const attachAndPlay = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) throw new Error("Camera preview is unavailable");
    setState("starting_camera");
    await new Promise<void>((resolve, reject) => {
      const onReady = () => resolve();
      const onError = () => reject(new Error("Camera preview could not start"));
      video.addEventListener("loadedmetadata", onReady, { once: true });
      video.addEventListener("canplay", onReady, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.srcObject = stream;
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
    });
    await video.play();
    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      throw new Error("Camera preview is not ready");
    }
    debug("video metadata loaded", {
      width: video.videoWidth,
      height: video.videoHeight,
    });
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support webcam access.");
      setState("camera_error");
      return;
    }
    setError(null);
    try {
      if (streamRef.current) await attachAndPlay(streamRef.current);
      else {
        setState("requesting_permission");
        debug("permission requested");
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (requestError) {
          if (
            requestError instanceof DOMException &&
            requestError.name === "OverconstrainedError"
          ) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } else throw requestError;
        }
        streamRef.current = stream;
        debug("stream received");
        await attachAndPlay(stream);
      }
      setState("camera_ready");
      debug("camera ready");
    } catch (startError) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setError(friendlyCameraError(startError));
      setState("camera_error");
      debug("camera failed");
    }
  }, [attachAndPlay]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setError(null);
    setState("idle");
    debug("camera stopped");
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, ready, state, error, start, stop };
}
