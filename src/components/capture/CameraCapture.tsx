"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, AlertIcon, CloseIcon } from "@/components/ui/icons";

// UI review item 9: a live camera viewfinder with an edge guide overlay
// (real UK PCN notices are close to A5/A6 aspect ratio — the guide is a
// rough aid, not a hard crop) and a brightness/glare check run on the
// captured frame before it's sent anywhere. Falls back to a plain file
// input if getUserMedia isn't available (older browser, no permission, or
// not a secure context) — capture="environment" still opens the native
// camera app on mobile in that case, it just skips the live guide/checks.

type Warning = { kind: "dark" | "glare"; message: string } | null;

function analyzeFrame(canvas: HTMLCanvasElement): Warning {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let totalLuma = 0;
  let brightPixels = 0;
  let sampled = 0;
  const step = 4 * 8; // every 8th pixel — plenty for a rough average on a phone-sized frame

  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalLuma += 0.299 * r + 0.587 * g + 0.114 * b;
    if (r > 245 && g > 245 && b > 245) brightPixels++;
    sampled++;
  }
  if (sampled === 0) return null;

  const avgLuma = totalLuma / sampled;
  const brightFraction = brightPixels / sampled;

  if (brightFraction > 0.08) {
    return { kind: "glare", message: "Looks like there's glare or a reflection on the ticket. Try tilting it or moving out of direct light." };
  }
  if (avgLuma < 55) {
    return { kind: "dark", message: "This looks quite dark. Try somewhere brighter, or turn on a light." };
  }
  return null;
}

export function CameraCapture({ onCapture }: { onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [warning, setWarning] = useState<Warning>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const capturedFileRef = useRef<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setUnsupported(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1280 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        setUnsupported(true);
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function takePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    setWarning(analyzeFrame(canvas));

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `ticket-${Date.now()}.jpg`, { type: "image/jpeg" });
        capturedFileRef.current = file;
        setCapturedPreview(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.9
    );
  }

  function retake() {
    setCapturedPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    capturedFileRef.current = null;
    setWarning(null);
  }

  function useThisPhoto() {
    if (capturedFileRef.current) onCapture(capturedFileRef.current);
  }

  if (unsupported) {
    return (
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onCapture(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-planal-brand px-4 py-4 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
        >
          <CameraIcon /> Photograph your ticket
        </button>
      </div>
    );
  }

  if (capturedPreview) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element -- object URL of an in-memory capture, not a static asset */}
        <img src={capturedPreview} alt="Your captured ticket photo" className="w-full rounded-2xl border border-planal-border" />
        {warning && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-planal-amber-bg p-3 text-sm text-planal-amber-text" role="alert">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {warning.message}
          </p>
        )}
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={retake}
            className="min-h-11 flex-1 rounded-2xl border border-planal-border px-4 py-3 text-base font-medium text-planal-ink hover:bg-planal-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={useThisPhoto}
            className="min-h-11 flex-1 rounded-2xl bg-planal-brand px-4 py-3 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
          >
            {warning ? "Use anyway" : "Use this photo"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "3/4" }}>
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        {ready && (
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-white/70" aria-hidden="true" />
        )}
        {ready && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white drop-shadow">
            Line the ticket up with the frame
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={takePhoto}
        disabled={!ready}
        className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-planal-border bg-planal-brand text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2 disabled:opacity-50"
        aria-label="Take photo"
      >
        <CameraIcon className="h-6 w-6" />
      </button>
    </div>
  );
}

export function CloseCaptureButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close camera"
      className="flex h-11 w-11 items-center justify-center rounded-full text-planal-ink-muted hover:bg-planal-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand"
    >
      <CloseIcon />
    </button>
  );
}
