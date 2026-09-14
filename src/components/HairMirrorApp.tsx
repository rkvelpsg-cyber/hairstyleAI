"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { hairColors, hairStyles, retailProducts } from "@/data/catalog";
import { useCamera } from "@/hooks/useCamera";
import { usePresenceDetector } from "@/hooks/usePresenceDetector";
import {
  useHeadOrientation,
  type HeadOrientation,
} from "@/hooks/useHeadOrientation";
import { captureFrame } from "@/lib/image";
import { lockFaceOnly } from "@/lib/faceLock";
import { speak } from "@/lib/speech";
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
  const [manualView, setManualView] = useState<HairView>("front");
  const [qr, setQr] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [lookCount, setLookCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const last = useRef(Date.now());

  const { videoRef, streamRef, ready, error: cameraError, start } = useCamera();
  const present = usePresenceDetector(
    videoRef.current,
    screen === "attract" && ready,
  );
  const trackingEnabled = ready && screen === "capture";
  const orientation = useHeadOrientation(videoRef, trackingEnabled);

  const currentCapture =
    CAPTURE_ORDER[Math.min(captureIndex, CAPTURE_ORDER.length - 1)];
  const liveView = (
    orientation.available ? orientation.orientation : manualView
  ) as HairView;
  const shownResult =
    results[liveView] || results.front || Object.values(results)[0] || null;

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
    start();
  }, [start]);

  useEffect(() => {
    if (screen === "attract" && present) {
      setScreen("welcome");
      speak(`Welcome to ${salon}. Would you like to discover your new look?`);
    }
  }, [present, screen, salon]);

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

  function act() {
    last.current = Date.now();
  }

  function reset() {
    setScreen("attract");
    setCaptureIndex(0);
    setCaptures({});
    setStyle(null);
    setAudience("all");
    setStyleSearch("");
    setColor(hairColors[0]);
    setResults({});
    setManualView("front");
    setQr(null);
    setShareUrl(null);
    setLookCount(0);
    setProgress(0);
    setError(null);
  }

  function beginCapture() {
    setCaptureIndex(0);
    setCaptures({});
    setError(null);
    setScreen("capture");
  }

  async function captureCurrentView() {
    if (!videoRef.current) return;
    act();
    const expected = currentCapture;
    const yaw = orientation.yaw ?? 0;
    if (orientation.available && Math.abs(yaw) >= 0.18) {
      setError("Please face the camera directly for the front photo.");
      speak("Please face the camera directly for the front photo.");
      return;
    }

    const image = captureFrame(videoRef.current);
    setCaptures((prev) => ({ ...prev, [expected]: image }));
    setError(null);

    setScreen("styles");
    speak(
      "Your front photo is captured. Now choose the hairstyle you would like to preview.",
    );
  }

  async function generateOne(view: HairView, image: string) {
    if (!style) throw new Error("Choose a hairstyle first");
    const response = await fetch("/api/hair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        style: style.falStyle,
        stylePrompt: style.stylePrompt,
        styleId: style.id,
        color: color.falColor,
        view,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.resultImage) {
      throw new Error(data.error || `${VIEW_LABEL[view]} generation failed`);
    }

    if (view === "back") return data.resultImage as string;
    const locked = await lockFaceOnly(image, data.resultImage);
    if (!locked.applied && process.env.NODE_ENV === "production") {
      throw new Error(`${VIEW_LABEL[view]} face lock could not be verified.`);
    }
    return locked.image;
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
      for (let i = 0; i < CAPTURE_ORDER.length; i++) {
        const view = CAPTURE_ORDER[i];
        nextResults[view] = await generateOne(view, captures[view]!);
        setProgress(Math.round(((i + 1) / CAPTURE_ORDER.length) * 100));
      }

      setResults(nextResults);
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

  const cloneVideo = (el: HTMLVideoElement | null) => {
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  };

  return (
    <main className="app" onPointerDown={act}>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          position: "fixed",
          width: 2,
          height: 2,
          opacity: 0.001,
          pointerEvents: "none",
        }}
      />

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
            <video ref={cloneVideo} muted playsInline />
            <div className="guide" />
            <div className="orientationBadge">
              {orientation.available
                ? `Detected: ${VIEW_LABEL[orientation.orientation as HairView]}`
                : "Orientation tracker loading…"}
            </div>
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
              disabled={!ready}
              onClick={captureCurrentView}
            >
              Capture {VIEW_LABEL[currentCapture]}
            </button>
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
          <div className="actions">
            <button className="btn primary" onClick={generate}>
              Generate Preview
            </button>
            <button className="btn secondary" onClick={beginCapture}>
              Retake Photo
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
                  Retake 4 Views
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
