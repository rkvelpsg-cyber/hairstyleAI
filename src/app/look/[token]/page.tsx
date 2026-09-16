"use client";

import { useEffect, useState } from "react";

export default function LookPage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<"loading" | "ready" | "expired">(
    "loading",
  );
  const [details, setDetails] = useState<{
    styleLabel?: string;
    colorLabel?: string;
    expiresAt?: string;
  }>({});
  const imageUrl = `/api/look/${params.token}`;
  const mirrorUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || "/";

  useEffect(() => {
    void fetch(`${imageUrl}?metadata=1`)
      .then((response) => {
        if (!response.ok) throw new Error("expired");
        return response.json();
      })
      .then((data) => {
        setDetails(data);
        setState("ready");
      })
      .catch(() => setState("expired"));
  }, [imageUrl]);

  async function sharePhoto() {
    if (!navigator.share) {
      document.getElementById("download-look")?.click();
      return;
    }
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "my-ai-hairstyle.jpg", {
        type: "image/jpeg",
      });
      await navigator.share({
        title: "My New Look",
        text: "My AI hairstyle preview",
        files: [file],
      });
    } catch {
      document.getElementById("download-look")?.click();
    }
  }

  if (state === "loading")
    return (
      <main className="mobileLookPage">
        <p>Preparing your look...</p>
      </main>
    );
  if (state === "expired") {
    return (
      <main className="mobileLookPage mobileLookExpired">
        <span className="pill">Lotus AI Hair Salon</span>
        <h1>This hairstyle preview has expired.</h1>
        <p>For your privacy, AI hairstyle photos are only kept temporarily.</p>
        <a className="btn primary" href={mirrorUrl}>
          Try AI Hairstyle Mirror
        </a>
      </main>
    );
  }

  return (
    <main className="mobileLookPage">
      <span className="pill">Your AI Hair Preview</span>
      <h1>Your New Look</h1>
      <div className="mobileLookImageWrap">
        <img src={imageUrl} alt="Your final AI hairstyle" />
      </div>
      <div className="mobileLookDetails">
        <p>
          Hairstyle <strong>{details.styleLabel || "Selected style"}</strong>
        </p>
        <p>
          Colour <strong>{details.colorLabel || "Selected colour"}</strong>
        </p>
      </div>
      <a
        id="download-look"
        className="btn primary"
        href={imageUrl}
        download="my-ai-hairstyle.jpg"
      >
        Download Photo
      </a>
      <button className="btn secondary" onClick={() => void sharePhoto()}>
        Share Photo
      </button>
      <a className="mobileMirrorLink" href={mirrorUrl}>
        Try AI Hairstyle Mirror
      </a>
    </main>
  );
}
