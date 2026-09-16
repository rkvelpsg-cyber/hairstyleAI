"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type WelcomeVideoProps = {
  salonName: string;
  onStart: () => void;
};

const VIDEO_SOURCE =
  process.env.NEXT_PUBLIC_WELCOME_VIDEO ||
  "/videos/lotus-ai-hairstyle-welcome.mp4";
const VIDEO_FIT =
  process.env.NEXT_PUBLIC_WELCOME_VIDEO_FIT === "cover" ? "cover" : "contain";

export default function WelcomeVideo({
  salonName,
  onStart,
}: WelcomeVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = true;
    video.volume = 1;
    const attemptPlay = () => {
      void video.play().then(
        () => setAutoplayFailed(false),
        () => {
          if (process.env.NODE_ENV !== "production")
            console.warn("Welcome video muted autoplay was blocked.");
          setAutoplayFailed(true);
        },
      );
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) attemptPlay();
    else video.addEventListener("canplay", attemptPlay, { once: true });
    return () => video.removeEventListener("canplay", attemptPlay);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.volume = 1;
  }, [isMuted]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null)
        window.clearTimeout(transitionTimerRef.current);
    },
    [],
  );

  async function enableSound() {
    if (hasInteracted || sessionStarted) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    try {
      await video.play();
      setIsMuted(false);
      setHasInteracted(true);
      setAutoplayFailed(false);
    } catch (error) {
      video.muted = true;
      setIsMuted(true);
      if (process.env.NODE_ENV !== "production")
        console.warn("Unable to enable welcome audio", error);
    }
  }

  function toggleSound(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    video.volume = 1;
    setIsMuted(nextMuted);
    setHasInteracted(true);
    if (!nextMuted) void video.play().catch(() => setIsMuted(true));
  }

  function beginSession(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (sessionStarted) return;
    setSessionStarted(true);
    videoRef.current?.pause();
    transitionTimerRef.current = window.setTimeout(onStart, 400);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void enableSound();
    }
  }

  return (
    <section
      className={`welcomeKiosk ${sessionStarted ? "isLeaving" : ""}`}
      onPointerDown={() => void enableSound()}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Welcome to the AI Hairstyle Mirror"
    >
      <video
        ref={videoRef}
        className="welcomeKioskVideo"
        src={VIDEO_SOURCE}
        autoPlay
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        style={{ objectFit: VIDEO_FIT }}
        aria-hidden="true"
        onError={() => setAutoplayFailed(true)}
      />
      <div className="welcomeKioskShade" />
      <div
        className="welcomeKioskContent"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="welcomeKioskEyebrow">AI HAIRSTYLE MIRROR</span>
        <p className="welcomeKioskSubtitle">Discover your next look</p>
        <div className="welcomeKioskActions">
          <button
            className="welcomeSoundButton"
            type="button"
            onPointerDown={
              hasInteracted
                ? toggleSound
                : (event) => {
                    event.stopPropagation();
                    void enableSound();
                  }
            }
            aria-label={isMuted ? "Tap for sound" : "Turn welcome sound off"}
          >
            {isMuted ? "🔊 Tap for Sound" : "🔊 Sound On"}
          </button>
          <button
            className="btn primary welcomeStartButton"
            type="button"
            onPointerDown={beginSession}
            aria-label="Start AI Hairstyle"
          >
            Start AI Hairstyle
          </button>
        </div>
        <span className="welcomeKioskSalon">{salonName}</span>
        {autoplayFailed && (
          <span className="welcomeAutoplayHint">▶ Tap to Play</span>
        )}
      </div>
    </section>
  );
}
