"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CameraCapture } from "@/components/capture/CameraCapture";
import { CheckDetailsForm, type CheckDetailsFields } from "@/components/cases/CheckDetailsForm";
import type { AppealAssessment } from "@/lib/appeal";
import {
  startAnonymousDraftAction,
  runAnonymousAssessmentAction,
  confirmAsAuthenticatedUserAction,
} from "@/app/try/actions";

type Step = "capture" | "reading" | "checkDetails" | "assessing" | "preview" | "error";

const STRENGTH_LABEL: Record<AppealAssessment["strength"], string> = {
  weak: "Weak",
  moderate: "Moderate",
  strong: "Strong",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function TryFlow({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [step, setStep] = useState<Step>("capture");
  const [token, setToken] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<CheckDetailsFields | null>(null);
  const [assessment, setAssessment] = useState<AppealAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCapture(file: File) {
    setStep("reading");
    setError(null);
    const formData = new FormData();
    formData.set("ticket", file);
    const result = await startAnonymousDraftAction(formData);
    if ("error" in result) {
      setError(result.error);
      setStep("capture");
      return;
    }
    setToken(result.token);
    setThumbnailUrl(result.thumbnailUrl);
    setFields(result.extraction);
    setStep("checkDetails");
  }

  async function handleConfirm(edited: CheckDetailsFields) {
    if (!token) return;
    setFields(edited);
    setPending(true);
    setError(null);

    if (isAuthenticated) {
      const result = await confirmAsAuthenticatedUserAction(token, edited);
      // A successful call redirects server-side and never returns here —
      // only a failure produces a value to react to.
      if (result && "error" in result) {
        setError(result.error);
        setPending(false);
      }
      return;
    }

    setStep("assessing");
    const result = await runAnonymousAssessmentAction(token, edited);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      setStep("checkDetails");
      return;
    }
    setAssessment(result.assessment);
    setStep("preview");
  }

  function goToSignup() {
    if (!token) return;
    window.location.href = `/signup?draft=${token}`;
  }

  return (
    <main className="min-h-full bg-planal-bg px-5 py-8 pb-16 text-planal-ink">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-bold">
            Planal
          </Link>
          {!isAuthenticated && (
            <Link href="/login" className="text-sm font-medium text-planal-ink-muted hover:text-planal-ink">
              Log in
            </Link>
          )}
        </div>

        {step === "capture" && (
          <div className="mt-6">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Photograph your ticket</h1>
            <p className="mt-2 text-base text-planal-ink-muted">
              No account needed to see what we find — you only sign up when you&apos;re ready to send.
            </p>
            {error && (
              <p className="mt-3 text-sm text-planal-danger-text" role="alert">
                {error}
              </p>
            )}
            <div className="mt-5">
              <CameraCapture onCapture={handleCapture} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCapture(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 min-h-11 w-full rounded-2xl border border-planal-border bg-planal-surface px-4 py-3 text-base font-medium text-planal-ink hover:bg-planal-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
            >
              Upload a letter or PDF instead
            </button>
          </div>
        )}

        {step === "reading" && (
          <div className="mt-16 text-center" role="status" aria-live="polite">
            <p className="text-base font-medium">Reading your ticket…</p>
            <p className="mt-2 text-sm text-planal-ink-muted">This usually takes a few seconds.</p>
          </div>
        )}

        {step === "checkDetails" && fields && (
          <div className="mt-6">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Check the details</h1>
            <p className="mt-2 text-base text-planal-ink-muted">
              We read this off your ticket. Anything marked{" "}
              <span className="rounded-full bg-planal-amber-bg px-2 py-0.5 text-sm font-semibold text-planal-amber-text">
                Please check
              </span>{" "}
              is worth a second look.
            </p>
            <CheckDetailsForm
              initialFields={fields}
              thumbnailUrl={thumbnailUrl}
              onSubmit={handleConfirm}
              submitLabel="Check my chances and write my appeal"
              pending={pending}
              error={error}
            />
          </div>
        )}

        {step === "assessing" && (
          <div className="mt-16 text-center" role="status" aria-live="polite">
            <p className="text-base font-medium">Checking your chances and writing your appeal…</p>
            <p className="mt-2 text-sm text-planal-ink-muted">This usually takes a few seconds.</p>
          </div>
        )}

        {step === "preview" && assessment && fields && (
          <div className="mt-6">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Your appeal is ready</h1>

            <div className="mt-4 rounded-2xl border border-planal-border bg-planal-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold">Appeal strength</p>
                <span className="rounded-full bg-planal-amber-bg px-3 py-1 text-sm font-semibold text-planal-amber-text">
                  {STRENGTH_LABEL[assessment.strength]}
                </span>
              </div>
              <p className="mt-2 text-sm text-planal-ink">{assessment.reasoningText}</p>
              <div className="mt-3 whitespace-pre-wrap rounded-xl bg-planal-bg p-3 text-sm text-planal-ink-muted">
                {assessment.draftText}
              </div>
            </div>

            {fields.amountDiscounted != null && fields.discountDeadline && (
              <p className="mt-3 text-sm text-planal-ink-muted">
                Prefer to just pay it? £{fields.amountDiscounted} before {formatDate(fields.discountDeadline)} gets
                you the discount — you can still choose that after signing up, no obligation to appeal.
              </p>
            )}

            <button
              type="button"
              onClick={goToSignup}
              className="mt-5 flex min-h-11 w-full items-center justify-center rounded-2xl bg-planal-brand px-4 py-3.5 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
            >
              Create account to send this
            </button>
            <p className="mt-2 text-center text-sm text-planal-ink-muted">
              Free to create an account. You only pay when you&apos;re ready to send.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
