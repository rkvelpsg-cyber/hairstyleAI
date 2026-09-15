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
  | "styles"
  | "colors"
  | "generating"
  | "result"
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
  const [lookCount, setLookCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<1 | 2 | 3 | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [advisor, setAdvisor] = useState<SalonStyleAdvice | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
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
      if (screen !== "attract" && Date.now() - last.current > ms) reset();
    }, 5000);
    return () => clearInterval(i);
  }, [screen]);

  useEffect(() => {
    if (screen !== "capture") return;
    speak("Front view. Face the camera directly.");
  }, [screen, currentCapture]);

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
  }

  function reset() {
    countdownRunRef.current += 1;
    if (countdownTimerRef.current !== null) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
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
  }

  function beginCapture() {
    countdownRunRef.current += 1;
    setCaptureIndex(0);
    setCaptures({});
    setAdvisor(null);
    setError(null);
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
    if (countdown !== null || !ready || !videoRef.current) return;
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
    setCountdown(2);
    announce(2);
    if (!(await waitForCountdown(1000, run))) return;
    setCountdown(3);
    announce(3);
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve()),
    );
    if (countdownRunRef.current !== run) return;
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

    setScreen("styles");
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

      const session = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultImages: nextResults,
          styleLabel: style.label,
          colorLabel: color.label,
        }),
      });
      const sessionData = await session.json();
      if (sessionData?.url) {
        setShareUrl(sessionData.url);
        setQr(
          await QRCode.toDataURL(sessionData.url, { width: 360, margin: 1 }),
        );
      }
      setScreen("result");
      speak("Your hairstyle preview is ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setScreen("colors");
    }
  }

  return (
    <main className="app" onPointerDown={act}>
      {screen === "attract" && (
        <section
          className="attract"
          onClick={() => {
            setScreen("welcome");
            speak(
              `Welcome to ${salon}. Would you like to discover your new look?`,
            );
          }}
        >
          <video
            src="/media/welcome.mp4"
            autoPlay
            loop
            muted
            playsInline
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className="attractContent">
            <span className="pill">Lotus AI Beauty Mirror</span>
            <h1 className="hero">Welcome to {salon}</h1>
            <p className="sub">
              Walk closer or tap to discover your next hairstyle.
            </p>
            <button className="btn primary">Start</button>
          </div>
        </section>
      )}

      {screen === "welcome" && (
        <section className="screen center">
          <span className="pill">AI Hair Preview</span>
          <h1 className="hero">Find Your New Look</h1>
          <p className="sub">
            Take one clear front photo, then preview a new hairstyle and colour.
          </p>
          <button className="btn primary" onClick={beginCapture}>
            Start Front Capture
          </button>
        </section>
      )}

      {screen === "capture" && (
        <section className="screen center">
          <span className="pill">
            View {captureIndex + 1} of {CAPTURE_ORDER.length}
          </span>
          <h1>{VIEW_LABEL[currentCapture]} Capture</h1>
          <p className="sub">
            {currentCapture === "front" &&
              "Face the camera directly. Keep your whole head and hair visible."}
          </p>

          <div className="camera">
            <video ref={videoRef} muted playsInline />
            <div className="guide" />
            <div className="orientationBadge">
              {cameraState === "requesting_permission" && "Allow camera access"}
              {cameraState === "starting_camera" && "Starting camera..."}
              {cameraState === "camera_ready" && "Camera ready"}
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
              Good, even lighting gives better hair edges and colour.
            </div>
          </div>

          <div className="captureSteps">
            {CAPTURE_ORDER.map((view, index) => (
              <div
                key={view}
                className={`captureStep ${captures[view] ? "done" : ""} ${index === captureIndex ? "active" : ""}`}
              >
                {captures[view] ? "✓" : index + 1} {VIEW_LABEL[view]}
              </div>
            ))}
          </div>

          {cameraError && <div className="panel">{cameraError}</div>}
          {error && <div className="panel">{error}</div>}
          <div className="actions">
            <button
              className="btn primary"
              disabled={!ready || countdown !== null}
              onClick={() => void startCountdown()}
            >
              Capture {VIEW_LABEL[currentCapture]}
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
          <h1>Choose an Indian hairstyle</h1>
          <p className="sub">
            Browse women, men, children and senior styles. The selected style is
            applied to your front-view preview.
          </p>
          <section className="advisorPanel panel">
            <div className="top">
              <div>
                <span className="pill">Local recommendations</span>
                <h2>Your AI Style Advisor</h2>
              </div>
              {advisorLoading && (
                <span className="styleCount">Analysing...</span>
              )}
            </div>
            {advisor ? (
              <>
                <div className="advisorProfile">
                  <div>
                    <span className="styleMeta">Approximate face shape</span>
                    <strong>{advisor.faceShape}</strong>
                  </div>
                  <div>
                    <span className="styleMeta">Visible styling notes</span>
                    <span>{advisor.hairCharacteristics?.join(" • ")}</span>
                  </div>
                </div>
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
            placeholder="Search: Tamil bridal, butterfly cut, low fade, school braid…"
          />
          <div className="styleCount">{filteredStyles.length} styles</div>
          <div className="grid">
            {filteredStyles.map((s) => (
              <button
                key={s.id}
                className="card"
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
                <div>
                  Service from ₹{s.servicePrice.toLocaleString("en-IN")}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {screen === "colors" && style && (
        <section className="screen">
          <div className="top">
            <div>
              <div className="brand">{style.label}</div>
              <div>Choose hair colour</div>
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
                className="card"
                style={{ minHeight: 120 }}
                onClick={() => setColor(c)}
              >
                <h2>{c.label}</h2>
                <div>
                  {c.servicePrice
                    ? `₹${c.servicePrice.toLocaleString("en-IN")}`
                    : "Keep natural colour"}
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
          <h1>Creating your hairstyle preview…</h1>
          <p className="sub">
            Generating your front-view preview with face preservation.
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
              <span className="pill">Identity / Face Lock</span>
              <h1>{style.label}</h1>
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
              {qr && (
                <>
                  <h3>Save your look</h3>
                  <img className="qr" src={qr} alt="QR code" />
                </>
              )}
              <div className="actions" style={{ marginTop: 18 }}>
                <button
                  className="btn primary"
                  onClick={() => setScreen("checkout")}
                >
                  Book This Look
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setScreen("styles")}
                >
                  Try Another Style
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
