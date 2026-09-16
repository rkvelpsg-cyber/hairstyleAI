"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { hairColors, hairStyles, retailProducts } from "@/data/catalog";
import { useCamera } from "@/hooks/useCamera";
import { captureFrame } from "@/lib/image";
import { lockFaceOnly, validateFrontCapture } from "@/lib/faceLock";
import { speak } from "@/lib/speech";
import { localStyleAdvisor } from "@/lib/styleAdvisor/advisor";
import { resolveColorProvider, resolveStyleProvider } from "@/lib/styleConfig";
import { localStyleValidator } from "@/lib/styleValidation";
import WelcomeVideo from "@/components/WelcomeVideo";
import type {
  SalonStyleAdvice,
  Recommendation,
} from "@/lib/styleAdvisor/types";
import type {
  HairAudience,
  HairColor,
  HairStyle,
  HairView,
  HairViewImages,
} from "@/types";

type Screen =
  | "attract"
  | "welcome"
  | "capture"
  | "review"
  | "styles"
  | "colors"
  | "generating"
  | "result"
  | "save"
  | "checkout";

const CAPTURE_ORDER: HairView[] = ["front"];
const VIEW_LABEL: Record<HairView, string> = {
  front: "Front",
  left: "Left Side",
  right: "Right Side",
  back: "Back",
};

export default function HairMirrorApp() {
  const salon = process.env.NEXT_PUBLIC_SALON_NAME || "Maria Salon";
  const [screen, setScreen] = useState<Screen>("attract");
  const [captureIndex, setCaptureIndex] = useState(0);
  const [captures, setCaptures] = useState<HairViewImages>({});
  const [style, setStyle] = useState<HairStyle | null>(null);
  const [audience, setAudience] = useState<HairAudience | "all">("all");
  const [styleSearch, setStyleSearch] = useState("");
  const [color, setColor] = useState<HairColor>(hairColors[0]);
  const [results, setResults] = useState<HairViewImages>({});
  const [rawResults, setRawResults] = useState<HairViewImages>({});
  const [generationDebug, setGenerationDebug] = useState<{
    selectedStyle?: string;
    selectedStyleId?: string;
    provider?: string;
    providerMode?: string;
    endpoint?: string;
    providerTarget?: string;
    generationQuality?: string;
    selectedColor?: string;
    providerColor?: string;
    validationPassed?: boolean;
    validationReasons?: string[];
  }>({});
  const [maskDebug, setMaskDebug] = useState<{
    hardMask?: string;
    softMask?: string;
    hairEditMask?: string;
  }>({});
  const [showDebug, setShowDebug] = useState(false);
  const [manualView, setManualView] = useState<HairView>("front");
  const [qr, setQr] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [lookCount, setLookCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<1 | 2 | 3 | null>(null);
  const [captureReady, setCaptureReady] = useState(false);
  const [captureMessage, setCaptureMessage] = useState(
    "Position your full head inside the guide.",
  );
  const captureReadyRef = useRef(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [advisor, setAdvisor] = useState<SalonStyleAdvice | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const countdownTimerRef = useRef<number | null>(null);
  const countdownRunRef = useRef(0);
  const last = useRef(Date.now());

  const {
    videoRef,
    ready,
    state: cameraState,
    error: cameraError,
    start,
    stop,
  } = useCamera();

  const currentCapture =
    CAPTURE_ORDER[Math.min(captureIndex, CAPTURE_ORDER.length - 1)];
  const shownResult = results.front || Object.values(results)[0] || null;

  const filteredStyles = useMemo(() => {
    const q = styleSearch.trim().toLowerCase();
    return hairStyles.filter((s) => {
      const audienceOk =
        audience === "all" ||
        s.audience === audience ||
        s.audience === "unisex";
      const searchOk =
        !q ||
        [s.label, s.category, s.region || "", s.stylePrompt]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return audienceOk && searchOk;
    });
  }, [audience, styleSearch]);

  const recommended = useMemo(
    () =>
      retailProducts
        .filter(
          (p) =>
            p.tags.includes(style?.falStyle || "") ||
            p.tags.includes(color.falColor),
        )
        .slice(0, 3),
    [style, color],
  );

  useEffect(() => {
    if (screen !== "capture") return;
    void start();
    return stop;
  }, [screen, start, stop]);

  useEffect(() => {
    const i = setInterval(() => {
      const ms =
        Number(process.env.NEXT_PUBLIC_IDLE_RESET_SECONDS || 90) * 1000;
      const protectedScreen =
        screen === "generating" || screen === "checkout" || countdown !== null;
      const inactiveFor = Date.now() - last.current;
      if (screen === "attract" || protectedScreen) return;
      if (inactiveFor > ms + 5000) reset();
      else if (inactiveFor > ms) setIdleWarning(true);
    }, 5000);
    return () => clearInterval(i);
  }, [countdown, screen]);

  useEffect(() => {
    if (screen !== "capture") return;
    speak("Front view. Face the camera directly.");
  }, [screen, currentCapture]);

  useEffect(() => {
    if (screen !== "capture") return;
    let active = true;
    let checking = false;
    const check = async () => {
      const video = videoRef.current;
      if (!active || checking || !ready || !video?.videoWidth) return;
      checking = true;
      try {
        const quality = await validateFrontCapture(captureFrame(video));
        if (!active) return;
        captureReadyRef.current = quality.valid;
        setCaptureReady(quality.valid);
        setCaptureMessage(
          quality.valid
            ? "Perfect - Ready to capture"
            : quality.message || "Adjust your position and lighting.",
        );
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 900);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [ready, screen, videoRef]);

  useEffect(() => {
    if (screen !== "styles" || !captures.front) return;
    let active = true;
    setAdvisorLoading(true);
    void localStyleAdvisor
      .advise({
        image: captures.front,
        audience,
        styles: hairStyles,
        colors: hairColors,
      })
      .then((advice) => {
        if (active) setAdvisor(advice);
      })
      .catch(() => {
        if (active) setAdvisor(null);
      })
      .finally(() => {
        if (active) setAdvisorLoading(false);
      });
    return () => {
      active = false;
    };
  }, [audience, captures.front, screen]);

  function act() {
    last.current = Date.now();
    setIdleWarning(false);
  }

  function reset() {
    countdownRunRef.current += 1;
    if (countdownTimerRef.current !== null) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    setCaptureReady(false);
    captureReadyRef.current = false;
    setCaptureMessage("Position your full head inside the guide.");
    setScreen("attract");
    setCaptureIndex(0);
    setCaptures({});
    setStyle(null);
    setAudience("all");
    setStyleSearch("");
    setColor(hairColors[0]);
    setResults({});
    setRawResults({});
    setGenerationDebug({});
    setMaskDebug({});
    setShowDebug(false);
    setManualView("front");
    setQr(null);
    setShareUrl(null);
    setLookCount(0);
    setProgress(0);
    setError(null);
    setShutterFlash(false);
    setAdvisor(null);
    setAdvisorLoading(false);
    setIdleWarning(false);
  }

  function beginCapture() {
    countdownRunRef.current += 1;
    setCaptureIndex(0);
    setCaptures({});
    setAdvisor(null);
    setError(null);
    setCaptureReady(false);
    captureReadyRef.current = false;
    setCaptureMessage("Position your full head inside the guide.");
    setScreen("capture");
  }

  function waitForCountdown(milliseconds: number, run: number) {
    return new Promise<boolean>((resolve) => {
      countdownTimerRef.current = window.setTimeout(() => {
        countdownTimerRef.current = null;
        resolve(countdownRunRef.current === run);
      }, milliseconds);
    });
  }

  async function startCountdown() {
    if (
      countdown !== null ||
      !ready ||
      !captureReadyRef.current ||
      !videoRef.current
    )
      return;
    if (
      videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !videoRef.current.videoWidth ||
      !videoRef.current.videoHeight
    ) {
      setError("Camera is still starting. Please wait a moment and try again.");
      return;
    }

    const run = ++countdownRunRef.current;
    const useVoice = process.env.NEXT_PUBLIC_CAPTURE_VOICE !== "false";
    const announce = (number: 1 | 2 | 3) => {
      if (useVoice) speak(["One", "Two", "Three"][number - 1]);
    };
    setError(null);
    setCountdown(1);
    announce(1);
    if (!(await waitForCountdown(1000, run))) return;
    if (!captureReadyRef.current) {
      setCountdown(null);
      setError("Please hold still and try again.");
      return;
    }
    setCountdown(2);
    announce(2);
    if (!(await waitForCountdown(1000, run))) return;
    if (!captureReadyRef.current) {
      setCountdown(null);
      setError("Please hold still and try again.");
      return;
    }
    setCountdown(3);
    announce(3);
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve()),
    );
    if (countdownRunRef.current !== run) return;
    if (!captureReadyRef.current) {
      setCountdown(null);
      setError("Please hold still and try again.");
      return;
    }
    await captureCurrentView();
    setCountdown(null);
  }

  async function captureCurrentView() {
    if (!videoRef.current) return;
    act();
    const expected = currentCapture;
    if (
      videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !videoRef.current.videoWidth ||
      !videoRef.current.videoHeight
    ) {
      setError("Camera is still starting. Please wait a moment and try again.");
      return;
    }
    setShutterFlash(true);
    window.setTimeout(() => setShutterFlash(false), 180);
    const image = captureFrame(videoRef.current);
    const quality = await validateFrontCapture(image);
    if (!quality.valid && quality.available !== false) {
      setError(
        quality.message || "Please improve the capture quality and try again.",
      );
      speak(
        quality.message || "Please improve the capture quality and try again.",
      );
      return;
    }
    if (quality.available === false) {
      setError(
        "Face guide is unavailable. Make sure your full head and hair are visible.",
      );
    }
    setCaptures((prev) => ({ ...prev, [expected]: image }));
    if (quality.available !== false) setError(null);

    setScreen("review");
    speak(
      "Your front photo is captured. Now choose the hairstyle you would like to preview.",
    );
  }

  async function generateOne(view: HairView, image: string) {
    if (!style) throw new Error("Choose a hairstyle first");
    const styleConfig = resolveStyleProvider(style);
    const providerColor = resolveColorProvider(color);
    const response = await fetch("/api/hair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        styleId: style.id,
        colorId: color.id,
        view,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.resultImage) {
      throw new Error(data.error || `${VIEW_LABEL[view]} generation failed`);
    }
    const validation = await localStyleValidator.validate(
      image,
      data.resultImage,
      style,
    );
    const debug = {
      selectedStyle: data.selectedStyle || style.label,
      selectedStyleId: data.selectedStyleId || style.id,
      provider: data.provider,
      providerMode: data.providerMode || styleConfig.mode,
      endpoint: data.endpoint || styleConfig.endpoint,
      providerTarget: data.providerTarget || styleConfig.targetHairstyle,
      generationQuality:
        data.generationQuality || styleConfig.generationQuality,
      selectedColor: data.selectedColor || color.label,
      providerColor: data.providerColor || providerColor,
      validationPassed: validation.passed,
      validationReasons: validation.reasons,
    };
    if (!validation.passed) {
      return {
        final: undefined,
        raw: data.resultImage as string,
        requestDebug: debug,
        faceDebug: undefined,
        validation,
      };
    }

    const locked = await lockFaceOnly(image, data.resultImage);
    if (!locked.applied) {
      throw new Error(
        locked.message || "Result quality is low. Please try again.",
      );
    }
    return {
      final: locked.image,
      raw: data.resultImage as string,
      requestDebug: debug,
      faceDebug: locked.debug,
      validation,
    };
  }

  async function generate() {
    if (!style) return;
    const missing = CAPTURE_ORDER.filter((v) => !captures[v]);
    if (missing.length) {
      setError(
        `Missing capture: ${missing.map((v) => VIEW_LABEL[v]).join(", ")}`,
      );
      return;
    }

    const capturedQuality = await validateFrontCapture(captures.front!);
    if (!capturedQuality.valid) {
      setError(
        capturedQuality.message ||
          "This photo may not give a realistic hairstyle preview.",
      );
      setScreen("review");
      return;
    }

    const maxLooks = Number(
      process.env.NEXT_PUBLIC_MAX_MULTI_VIEW_LOOKS_PER_SESSION || 3,
    );
    if (lookCount >= maxLooks) {
      setError(`Session limit reached: ${maxLooks} AI looks.`);
      return;
    }

    setScreen("generating");
    setProgress(0);
    setError(null);

    try {
      const nextResults: HairViewImages = {};
      const nextRawResults: HairViewImages = {};
      let nextMaskDebug: {
        hardMask?: string;
        softMask?: string;
        hairEditMask?: string;
      } = {};
      let nextGenerationDebug: {
        selectedStyle?: string;
        selectedStyleId?: string;
        provider?: string;
        providerMode?: string;
        endpoint?: string;
        providerTarget?: string;
        generationQuality?: string;
        selectedColor?: string;
        providerColor?: string;
        validationPassed?: boolean;
        validationReasons?: string[];
      } = {};
      for (let i = 0; i < CAPTURE_ORDER.length; i++) {
        const view = CAPTURE_ORDER[i];
        const generated = await generateOne(view, captures[view]!);
        nextRawResults[view] = generated.raw;
        nextGenerationDebug = generated.requestDebug || nextGenerationDebug;
        if (!generated.validation.passed) {
          setRawResults(nextRawResults);
          setGenerationDebug(nextGenerationDebug);
          setError(
            `We couldn't create an accurate preview for this style. ${generated.validation.reasons[0] || "Please try again."}`,
          );
          setScreen("colors");
          return;
        }
        nextResults[view] = generated.final!;
        nextMaskDebug = generated.faceDebug || nextMaskDebug;
        setProgress(Math.round(((i + 1) / CAPTURE_ORDER.length) * 100));
      }

      setResults(nextResults);
      setRawResults(nextRawResults);
      setMaskDebug(nextMaskDebug);
      setGenerationDebug(nextGenerationDebug);
      setManualView("front");
      setLookCount((x) => x + 1);

      setScreen("result");
      speak("Your hairstyle preview is ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setScreen("colors");
    }
  }

  async function saveLook() {
    if (!style || !color || !results.front || saveLoading) return;
    setSaveLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: results.front,
          styleLabel: style.label,
          colorLabel: color.label,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.url) {
        throw new Error(data.error || "Unable to save your look");
      }
      setShareUrl(data.url);
      setQr(await QRCode.toDataURL(data.url, { width: 320, margin: 2 }));
      setScreen("save");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your look",
      );
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <main className="app" onPointerDown={act}>
      {screen === "attract" && (
        <WelcomeVideo
          salonName={salon}
          onStart={() => {
            act();
            setScreen("welcome");
            speak(
              `Welcome to ${salon}. Would you like to discover your new look?`,
            );
          }}
        />
      )}

      {idleWarning && (
        <div className="idleWarning" role="status">
          Still there?
        </div>
      )}

      {screen === "welcome" && (
        <section className="screen center">
          <span className="pill">AI Hair Experience</span>
          <h1 className="hero">Find Your Signature Look</h1>
          <p className="sub">
            See how a new hairstyle and colour could look on you - before making
            the change.
          </p>
          <button className="btn primary" onClick={beginCapture}>
            Begin My Hair Preview
          </button>
          <span className="trustLine">
            One photo • Private session • AI-powered preview
          </span>
        </section>
      )}

      {screen === "capture" && (
        <section className="screen center">
          <span className="pill">Your Hair Preview</span>
          <h1>Let&apos;s capture your best angle</h1>
          <p className="sub">
            {currentCapture === "front" &&
              "Look straight ahead and keep your full hair and shoulders comfortably inside the guide."}
          </p>

          <div className="camera">
            <video ref={videoRef} muted playsInline />
            <div className="guide" />
            <div className="orientationBadge">
              {cameraState === "requesting_permission" && "Allow camera access"}
              {cameraState === "starting_camera" && "Starting camera..."}
              {cameraState === "camera_ready" && captureMessage}
              {cameraState === "camera_error" && "Camera unavailable"}
            </div>
            {countdown !== null && (
              <div className="countdownOverlay" aria-live="assertive">
                <strong key={countdown}>{countdown}</strong>
                <span>CAMERA LIVE</span>
              </div>
            )}
            {shutterFlash && (
              <div className="shutterFlash" aria-hidden="true" />
            )}
            <div className="note">
              ✦ For the most realistic result, use soft, even lighting.
            </div>
          </div>

          {cameraError && <div className="panel">{cameraError}</div>}
          {error && <div className="panel">{error}</div>}
          <div className="actions">
            <button
              className="btn primary"
              disabled={!ready || !captureReady || countdown !== null}
              onClick={() => void startCountdown()}
            >
              Capture My Photo
            </button>
            {cameraState === "camera_error" && (
              <button className="btn secondary" onClick={() => void start()}>
                Retry Camera
              </button>
            )}
            <button className="btn secondary" onClick={reset}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {screen === "styles" && (
        <section className="screen">
          <div className="top">
            <div className="brand">{salon}</div>
            <button className="btn secondary" onClick={reset}>
              Home
            </button>
          </div>
          <span className="pill">The Lookbook</span>
          <h1>Choose Your Hairstyle</h1>
          <p className="sub">
            Explore a look, then let AI create it on your photo.
          </p>
          <section className="advisorPanel panel">
            <div className="top">
              <div>
                <span className="pill">Recommended for you</span>
                <h2>Your AI Style Advisor</h2>
              </div>
              {advisorLoading && (
                <span className="styleCount">Analysing...</span>
              )}
            </div>
            {advisor ? (
              <>
                <p className="advisorExplanation">{advisor.explanation}</p>
                <AdvisorRecommendations
                  title="Top hairstyle picks"
                  recommendations={advisor.recommendedHairstyles}
                  onTry={(recommendation) => {
                    const selected = hairStyles.find(
                      (item) => item.id === recommendation.id,
                    );
                    if (!selected) return;
                    setStyle(selected);
                    setScreen("colors");
                    speak(
                      `${selected.label} selected. Now choose a hair colour.`,
                    );
                  }}
                />
                <AdvisorRecommendations
                  title="Hair color ideas"
                  recommendations={advisor.recommendedHairColors}
                  onTry={(recommendation) => {
                    const selected = hairColors.find(
                      (item) => item.id === recommendation.id,
                    );
                    if (selected) setColor(selected);
                  }}
                  actionLabel="Try This Color"
                />
                {advisor.groomingSuggestions && (
                  <AdvisorRecommendations
                    title="Grooming"
                    recommendations={advisor.groomingSuggestions}
                  />
                )}
                {advisor.makeupSuggestions && (
                  <AdvisorRecommendations
                    title="Makeup looks"
                    recommendations={advisor.makeupSuggestions}
                  />
                )}
                {advisor.lipstickSuggestions && (
                  <AdvisorRecommendations
                    title="Lip colors"
                    recommendations={advisor.lipstickSuggestions}
                  />
                )}
              </>
            ) : !advisorLoading ? (
              <p className="advisorExplanation">
                Choose an audience to receive local salon suggestions.
              </p>
            ) : null}
          </section>
          <div className="audienceFilters">
            {[
              ["all", "All"],
              ["women", "Women"],
              ["men", "Men"],
              ["girls", "Girls"],
              ["boys", "Boys"],
              ["senior_women", "Senior Women"],
              ["senior_men", "Senior Men"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`btn ${audience === value ? "primary" : "secondary"}`}
                onClick={() => setAudience(value as HairAudience | "all")}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className="styleSearch"
            value={styleSearch}
            onChange={(e) => setStyleSearch(e.target.value)}
            placeholder="Search hairstyles..."
          />
          <div className="styleCount">{filteredStyles.length} styles</div>
          <div className="grid">
            {filteredStyles.map((s) => (
              <button
                key={s.id}
                className={`card ${style?.id === s.id ? "selected" : ""}`}
                onClick={() => {
                  setStyle(s);
                  setScreen("colors");
                  speak(`${s.label} selected. Now choose a hair colour.`);
                }}
              >
                <img src={s.thumbnail} alt={s.label} />
                <h3>{s.label}</h3>
                <div className="styleMeta">
                  {s.category}
                  {s.region ? ` • ${s.region}` : ""}
                </div>
                {style?.id === s.id && (
                  <span className="selectedBadge">✓ Selected</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {screen === "review" && captures.front && (
        <section className="screen center">
          <span className="pill">Photo review</span>
          <h1>Check your front photo</h1>
          <p className="sub">
            Make sure your full hairstyle, face, shoulders, and surrounding
            space are visible before continuing.
          </p>
          <img
            className="reviewPhoto"
            src={captures.front}
            alt="Captured front photo"
          />
          <div className="actions">
            <button className="btn secondary" onClick={beginCapture}>
              Retake Photo
            </button>
            <button className="btn primary" onClick={() => setScreen("styles")}>
              Continue
            </button>
          </div>
        </section>
      )}

      {screen === "colors" && style && (
        <section className="screen">
          <div className="top">
            <div>
              <div className="brand">{style.label}</div>
              <div className="sectionLabel">Choose Your Colour</div>
            </div>
            <button
              className="btn secondary"
              onClick={() => setScreen("styles")}
            >
              Back
            </button>
          </div>
          <div className="grid">
            {hairColors.map((c) => (
              <button
                key={c.id}
                className={`card colorCard ${color.id === c.id ? "selected" : ""}`}
                style={{ minHeight: 120 }}
                onClick={() => setColor(c)}
              >
                <span
                  className={`colorSwatch color-${c.id}`}
                  aria-hidden="true"
                />
                <h2>{c.label}</h2>
                <div className="styleMeta">
                  {c.servicePrice ? "Salon colour" : "Keep natural colour"}
                </div>
                {color.id === c.id && <span className="pill">Selected</span>}
              </button>
            ))}
          </div>
          {error && <div className="panel">{error}</div>}
          {process.env.NODE_ENV !== "production" && rawResults.front && (
            <div className="panel">
              <strong>REQUEST / VALIDATION DEBUG</strong>
              <div>
                Selected Style: {generationDebug.selectedStyle || style.label}
              </div>
              <div>
                Selected Style ID: {generationDebug.selectedStyleId || style.id}
              </div>
              <div>Provider: {generationDebug.provider || "unknown"}</div>
              <div>
                Generation Quality:{" "}
                {generationDebug.generationQuality || "unknown"}
              </div>
              <div>
                Provider Mode: {generationDebug.providerMode || "unknown"}
              </div>
              <div>Endpoint: {generationDebug.endpoint || "unknown"}</div>
              <div>
                Provider Target:{" "}
                {generationDebug.providerTarget || "custom prompt"}
              </div>
              <div>
                Selected Color: {generationDebug.selectedColor || color.label}
              </div>
              <div>
                Provider Color: {generationDebug.providerColor || "unknown"}
              </div>
              <div>
                Validation: {generationDebug.validationPassed ? "PASS" : "FAIL"}
              </div>
              {generationDebug.validationReasons?.map((reason) => (
                <div key={reason}>Reason: {reason}</div>
              ))}
              <img
                className="main"
                src={rawResults.front}
                alt="Raw AI result"
              />
            </div>
          )}
          <div className="actions">
            <button className="btn primary" onClick={generate}>
              {rawResults.front && generationDebug.validationPassed === false
                ? "Try Again"
                : "Generate Preview"}
            </button>
            <button className="btn secondary" onClick={beginCapture}>
              Retake Photo
            </button>
            <button
              className="btn secondary"
              onClick={() => setScreen("styles")}
            >
              Choose Another Style
            </button>
          </div>
        </section>
      )}

      {screen === "generating" && (
        <section className="screen center">
          <div className="loading" />
          <h1>Creating Your Look…</h1>
          <p className="sub">
            Our AI stylist is applying your selected hairstyle and colour.
          </p>
          <div className="progress">
            <div style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
        </section>
      )}

      {screen === "result" && style && shownResult && (
        <section className="screen">
          <div className="top">
            <div>
              <div className="brand">{salon}</div>
              <div className="orientationText">
                Front-view hairstyle preview
              </div>
            </div>
            <button className="btn secondary" onClick={reset}>
              Home
            </button>
          </div>

          <div className="result">
            <div className="panel liveMirrorPanel">
              <div className="liveResultFrame">
                <img
                  key="front"
                  className="main angleResult"
                  src={shownResult}
                  alt="Front-view AI hairstyle result"
                />
                <div className="liveViewPill">Front</div>
              </div>
              {process.env.NODE_ENV !== "production" && (
                <>
                  <button
                    className="btn secondary"
                    onClick={() => setShowDebug((visible) => !visible)}
                  >
                    {showDebug ? "Hide Debug Images" : "Show Debug Images"}
                  </button>
                  {showDebug && (
                    <div className="grid" style={{ marginTop: 16 }}>
                      <div className="panel">
                        <strong>GENERATION DEBUG</strong>
                        <div>Selected style ID: {style.id}</div>
                        <div>Selected color ID: {color.id}</div>
                        <div>
                          Provider: {generationDebug.provider || "unknown"}
                        </div>
                        <div>
                          Endpoint: {generationDebug.endpoint || "unknown"}
                        </div>
                        <div>
                          Provider Target:{" "}
                          {generationDebug.providerTarget || "custom prompt"}
                        </div>
                        <div>
                          Selected Style:{" "}
                          {generationDebug.selectedStyle || style.label}
                        </div>
                        <div>
                          Selected Style ID:{" "}
                          {generationDebug.selectedStyleId || style.id}
                        </div>
                        <div>
                          Selected Color:{" "}
                          {generationDebug.selectedColor || color.label}
                        </div>
                        <div>
                          Provider Color:{" "}
                          {generationDebug.providerColor || "unknown"}
                        </div>
                        <div>
                          Validation:{" "}
                          {generationDebug.validationPassed ? "PASS" : "FAIL"}
                        </div>
                        {generationDebug.validationReasons?.map((reason) => (
                          <div key={reason}>Reason: {reason}</div>
                        ))}
                      </div>
                      <div className="panel">
                        <strong>ORIGINAL</strong>
                        <img
                          className="main"
                          src={captures.front}
                          alt="Original front capture"
                        />
                      </div>
                      <div className="panel">
                        <strong>RAW AI RESULT</strong>
                        <img
                          className="main"
                          src={rawResults.front}
                          alt="Raw AI result"
                        />
                      </div>
                      <div className="panel">
                        <strong>FACE-LOCKED FINAL RESULT</strong>
                        <img
                          className="main"
                          src={results.front}
                          alt="Face-locked final result"
                        />
                      </div>
                      {maskDebug.hardMask && (
                        <div className="panel">
                          <strong>HARD IDENTITY MASK</strong>
                          <img
                            className="main"
                            src={maskDebug.hardMask}
                            alt="Hard identity protection mask"
                          />
                        </div>
                      )}
                      {maskDebug.softMask && (
                        <div className="panel">
                          <strong>SOFT BLEND MASK</strong>
                          <img
                            className="main"
                            src={maskDebug.softMask}
                            alt="Soft transition mask"
                          />
                        </div>
                      )}
                      {maskDebug.hairEditMask && (
                        <div className="panel">
                          <strong>HAIR EDIT MASK</strong>
                          <img
                            className="main"
                            src={maskDebug.hairEditMask}
                            alt="AI-priority scalp hair edit mask"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <aside className="panel">
              <span className="pill">Your New Look</span>
              <h1>Meet Your New Look</h1>
              <div className="resultDetails">
                {style.label} <span>•</span> {color.label}
              </div>
              <p>{color.label}</p>
              <div className="row">
                <span>{style.serviceName}</span>
                <b>₹{style.servicePrice.toLocaleString("en-IN")}</b>
              </div>
              {color.servicePrice > 0 && (
                <div className="row">
                  <span>{color.serviceName}</span>
                  <b>₹{color.servicePrice.toLocaleString("en-IN")}</b>
                </div>
              )}
              <h3>Recommended products</h3>
              {recommended.map((p) => (
                <div className="row" key={p.id}>
                  <span>{p.name}</span>
                  <b>₹{p.price}</b>
                </div>
              ))}
              <div className="actions" style={{ marginTop: 18 }}>
                <button
                  className="btn primary"
                  onClick={() => void saveLook()}
                  disabled={saveLoading}
                >
                  {saveLoading ? "Saving Your Look..." : "Keep This Look"}
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setScreen("styles")}
                >
                  Try Another Look
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setScreen("colors")}
                >
                  Change Colour
                </button>
                <button className="btn secondary" onClick={beginCapture}>
                  Retake Photo
                </button>
              </div>
              {error && <div className="panel luxeError">{error}</div>}
            </aside>
          </div>
        </section>
      )}

      {screen === "save" && style && results.front && (
        <section className="screen saveScreen">
          <div className="top">
            <div>
              <span className="pill">Save Your Look</span>
              <h1>Take your new look with you</h1>
            </div>
            <button className="btn secondary" onClick={reset}>
              Finish
            </button>
          </div>
          <div className="saveLayout">
            <div className="panel printCard">
              <span className="printBrand">LOTUS AI HAIRSTYLE MIRROR</span>
              <img
                className="savedLookImage"
                src={results.front}
                alt="Final AI hairstyle result"
              />
              <h2>Your New Look</h2>
              <p>
                {style.label} <span>•</span> {color.label}
              </p>
            </div>
            <aside className="panel saveActions">
              {qr && (
                <img
                  className="saveQr"
                  src={qr}
                  alt="Scan to get your AI hairstyle photo"
                />
              )}
              <h2>Scan to get your photo</h2>
              <p className="privacyNote">
                Your hairstyle preview is stored temporarily. This link expires
                in {Number(process.env.NEXT_PUBLIC_RESULT_EXPIRY_MINUTES || 60)}{" "}
                minutes.
              </p>
              <div className="actions">
                <button className="btn primary" onClick={() => window.print()}>
                  Print My Look
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setScreen("styles")}
                >
                  Try Another Look
                </button>
                <button className="btn secondary" onClick={reset}>
                  Finish
                </button>
              </div>
            </aside>
          </div>
        </section>
      )}

      {screen === "checkout" && style && (
        <Checkout
          style={style}
          color={color}
          products={recommended}
          shareUrl={shareUrl}
          onBack={() => setScreen("result")}
          onDone={reset}
        />
      )}
    </main>
  );
}

function AdvisorRecommendations({
  title,
  recommendations,
  onTry,
  actionLabel = "Try This Style",
}: {
  title: string;
  recommendations: Recommendation[];
  onTry?: (recommendation: Recommendation) => void;
  actionLabel?: string;
}) {
  return (
    <div className="advisorRecommendations">
      <h3>{title}</h3>
      <div className="advisorList">
        {recommendations.map((recommendation) => (
          <div className="advisorRecommendation" key={recommendation.id}>
            <div>
              <strong>{recommendation.label}</strong>
              <span className="advisorPriority">
                {recommendation.priority === "top_pick"
                  ? "Top Pick"
                  : recommendation.priority === "great_match"
                    ? "Great Match"
                    : "Worth Trying"}
              </span>
              <p>{recommendation.reason}</p>
            </div>
            {onTry && (
              <button
                className="btn secondary"
                onClick={() => onTry(recommendation)}
              >
                {actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Checkout({ style, color, products, shareUrl, onBack, onDone }: any) {
  const [ids, setIds] = useState<string[]>([]);
  const chosen = products.filter((p: any) => ids.includes(p.id));
  const total =
    style.servicePrice +
    color.servicePrice +
    chosen.reduce((a: number, p: any) => a + p.price, 0);

  async function pay() {
    const r = await fetch("/api/payment/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: total, receipt: `salon-${Date.now()}` }),
    });
    const d = await r.json();
    if (!r.ok || !d.ok) {
      alert(d.error || "Razorpay is not configured. Use Pay at Counter.");
      return;
    }
    await load("https://checkout.razorpay.com/v1/checkout.js");
    const R = (window as any).Razorpay;
    new R({
      key: d.keyId,
      amount: d.order.amount,
      currency: d.order.currency,
      name: process.env.NEXT_PUBLIC_SALON_NAME || "Salon",
      description: `${style.label} + ${color.label}`,
      order_id: d.order.id,
      handler: () => {
        alert(
          "Payment successful. Add server-side signature verification before production.",
        );
        onDone();
      },
    }).open();
  }

  return (
    <section className="screen">
      <div className="top">
        <h1>Book This Look</h1>
        <button className="btn secondary" onClick={onBack}>
          Back
        </button>
      </div>
      <div className="result">
        <div className="panel">
          <div className="row">
            <span>{style.serviceName}</span>
            <b>₹{style.servicePrice}</b>
          </div>
          {color.servicePrice > 0 && (
            <div className="row">
              <span>{color.serviceName}</span>
              <b>₹{color.servicePrice}</b>
            </div>
          )}
          <h3>Add products</h3>
          {products.map((p: any) => (
            <label className="row" key={p.id}>
              <span>
                <input
                  type="checkbox"
                  checked={ids.includes(p.id)}
                  onChange={(e) =>
                    setIds((x: string[]) =>
                      e.target.checked
                        ? [...x, p.id]
                        : x.filter((i) => i !== p.id),
                    )
                  }
                />{" "}
                {p.name}
              </span>
              <b>₹{p.price}</b>
            </label>
          ))}
        </div>
        <aside className="panel">
          <h2>Total</h2>
          <div className="hero" style={{ fontSize: 48 }}>
            ₹{total.toLocaleString("en-IN")}
          </div>
          {shareUrl && (
            <p className="sub" style={{ fontSize: 15 }}>
              Your saved look is available through the QR link.
            </p>
          )}
          <div className="actions">
            <button className="btn primary" onClick={pay}>
              Pay Online
            </button>
            <button
              className="btn secondary"
              onClick={() =>
                alert("Please show this screen at the salon billing counter.")
              }
            >
              Pay at Counter
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function load(src: string) {
  return new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej();
    document.body.appendChild(s);
  });
}
