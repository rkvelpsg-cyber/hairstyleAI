"use client";

import { useEffect, useRef, useState } from "react";

type WelcomeVideoProps = {
  salonName: string;
  onStart: () => void;
};

const VIDEO_SOURCE =
  process.env.NEXT_PUBLIC_WELCOME_VIDEO ||
  "/videos/lotus-ai-hairstyle-welcome.mp4";
const VIDEO_FIT =
  process.env.NEXT_PUBLIC_WELCOME_VIDEO_FIT === "contain" ? "contain" : "cover";

export default function WelcomeVideo({
  salonName,
  onStart,
}: WelcomeVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    const attemptPlay = () => {
      void video.play().then(
        () => setAutoplayFailed(false),
        () => setAutoplayFailed(true),
      );
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) attemptPlay();
    else video.addEventListener("canplay", attemptPlay, { once: true });
    return () => video.removeEventListener("canplay", attemptPlay);
  }, []);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null)
        window.clearTimeout(transitionTimerRef.current);
    },
    [],
  );

  function beginSession() {
    if (sessionStarted) return;
    setSessionStarted(true);
    videoRef.current?.pause();
    transitionTimerRef.current = window.setTimeout(onStart, 400);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      beginSession();
    }
  }

  return (
    <section
      className={`welcomeKiosk ${sessionStarted ? "isLeaving" : ""}`}
      onPointerDown={beginSession}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Touch anywhere to discover your new look"
    >
      <video
        ref={videoRef}
        className="welcomeKioskVideo"
        src={VIDEO_SOURCE}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{ objectFit: VIDEO_FIT }}
        aria-hidden="true"
        onError={() => setAutoplayFailed(true)}
      />
      <div className="welcomeKioskShade" />
      <div className="welcomeKioskContent">
        <span className="pill">AI HAIRSTYLE MIRROR</span>
        <h1>Discover your next look</h1>
        <p>
          {autoplayFailed
            ? "Touch to Start"
            : "Touch anywhere to discover your new look"}
        </p>
        <span className="welcomeKioskSalon">{salonName}</span>
      </div>
    </section>
  );
}
