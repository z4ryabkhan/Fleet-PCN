"use client";

import { useId, useState } from "react";
import type { PcnExtraction } from "@/lib/ocr";
import { CloseIcon } from "@/components/ui/icons";

const ISSUER_TYPE_LABELS: Record<string, string> = {
  council_pcn: "Council PCN",
  tfl_pcn: "TfL PCN",
  congestion_charge: "Congestion Charge",
  ulez: "ULEZ",
  dart_charge: "Dart Charge",
  private_pcn: "Private parking",
  bus_lane: "Bus lane",
  moving_traffic: "Moving traffic",
};

type Confidence = "high" | "low";
type ConfidenceMap = Partial<Record<keyof PcnExtraction["fieldConfidence"], Confidence>>;
type ReasonMap = Partial<Record<keyof PcnExtraction["fieldConfidence"], string | null>>;

// UI review item 7: 16px minimum on inputs, 14px minimum body text, 44px
// minimum touch targets, visible focus-visible rings throughout.
const INPUT =
  "mt-1.5 w-full min-h-11 rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-base text-planal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1";
const LABEL_ROW = "flex flex-wrap items-center gap-2 text-sm font-medium text-planal-ink";

function ConfidenceNote({ level, reason }: { level: Confidence | undefined; reason: string | null | undefined }) {
  if (level !== "low") return null;
  // Item 3: auto-expand a low-confidence field with a reason — always
  // rendered when confidence is low, never hidden behind a click.
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-planal-amber-text" role="status">
      <span className="rounded-full bg-planal-amber-bg px-2 py-0.5 text-sm font-semibold">Please check</span>
      <span>{reason || "Not clearly legible — please confirm this is right."}</span>
    </p>
  );
}

function FieldLabel({ level, children }: { level?: Confidence; children: React.ReactNode }) {
  return (
    <div className={LABEL_ROW}>
      {children}
      {level === "high" && (
        <span className="rounded-full bg-planal-brand-tint-2 px-2 py-0.5 text-sm font-semibold text-planal-brand-dark">
          Read from ticket
        </span>
      )}
    </div>
  );
}

export type CheckDetailsFields = PcnExtraction;

export function CheckDetailsForm({
  initialFields,
  thumbnailUrl,
  onSubmit,
  submitLabel,
  pending,
  error,
}: {
  initialFields: CheckDetailsFields;
  thumbnailUrl: string | null;
  onSubmit: (fields: CheckDetailsFields) => void;
  submitLabel: string;
  pending: boolean;
  error?: string | null;
}) {
  const [fields, setFields] = useState<CheckDetailsFields>(initialFields);
  const [zoomed, setZoomed] = useState(false);
  const confidence = (fields.fieldConfidence ?? {}) as ConfidenceMap;
  const reasons = (fields.lowConfidenceReasons ?? {}) as ReasonMap;
  const idPrefix = useId();

  function set<K extends keyof CheckDetailsFields>(key: K, value: CheckDetailsFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  return (
    <div>
      {thumbnailUrl && (
        <>
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="mt-4 block w-full overflow-hidden rounded-2xl border border-planal-border focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
            aria-label="View full-size photo of the ticket"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a static asset */}
            <img src={thumbnailUrl} alt="Your uploaded ticket" className="max-h-64 w-full bg-planal-surface object-contain" />
          </button>
          {zoomed && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Full-size ticket photo"
              onClick={() => setZoomed(false)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbnailUrl} alt="Your uploaded ticket, enlarged" className="max-h-full max-w-full object-contain" />
              <button
                type="button"
                onClick={() => setZoomed(false)}
                aria-label="Close enlarged photo"
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <CloseIcon />
              </button>
            </div>
          )}
        </>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(fields);
        }}
        className="mt-5 space-y-4"
      >
        {/* Registration */}
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
          <label htmlFor={`${idPrefix}-vrm`}>
            <FieldLabel level={confidence.vrm}>Registration</FieldLabel>
          </label>
          <input
            id={`${idPrefix}-vrm`}
            value={fields.vrm ?? ""}
            onChange={(e) => set("vrm", e.target.value.toUpperCase())}
            className={`${INPUT} font-semibold uppercase tracking-wide`}
          />
          <ConfidenceNote level={confidence.vrm} reason={reasons.vrm} />
        </div>

        {/* Date and time */}
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
          <label htmlFor={`${idPrefix}-event`}>
            <FieldLabel level={confidence.eventDatetime}>Date and time</FieldLabel>
          </label>
          <input
            id={`${idPrefix}-event`}
            type="datetime-local"
            value={fields.eventDatetime?.slice(0, 16) ?? ""}
            onChange={(e) => set("eventDatetime", e.target.value || null)}
            className={INPUT}
          />
          <ConfidenceNote level={confidence.eventDatetime} reason={reasons.eventDatetime} />

          <label htmlFor={`${idPrefix}-noticeDate`} className="mt-4 block">
            <FieldLabel level={confidence.noticeDate}>Date of the notice</FieldLabel>
          </label>
          <input
            id={`${idPrefix}-noticeDate`}
            type="date"
            value={fields.noticeDate ?? ""}
            onChange={(e) => set("noticeDate", e.target.value || null)}
            className={INPUT}
          />
          <ConfidenceNote level={confidence.noticeDate} reason={reasons.noticeDate} />
        </div>

        {/* Location */}
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
          <label htmlFor={`${idPrefix}-location`}>
            <FieldLabel level={confidence.locationText}>Location</FieldLabel>
          </label>
          <input
            id={`${idPrefix}-location`}
            value={fields.locationText ?? ""}
            onChange={(e) => set("locationText", e.target.value || null)}
            className={INPUT}
          />
          <ConfidenceNote level={confidence.locationText} reason={reasons.locationText} />
        </div>

        {/* Issuer */}
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
          <label htmlFor={`${idPrefix}-issuer`}>
            <FieldLabel level={confidence.issuerName}>Issuer</FieldLabel>
          </label>
          <input
            id={`${idPrefix}-issuer`}
            value={fields.issuerName ?? ""}
            onChange={(e) => set("issuerName", e.target.value || null)}
            className={INPUT}
          />
          <ConfidenceNote level={confidence.issuerName} reason={reasons.issuerName} />

          <label htmlFor={`${idPrefix}-issuerType`} className="mt-4 block">
            <FieldLabel>Type</FieldLabel>
          </label>
          <select
            id={`${idPrefix}-issuerType`}
            value={fields.issuerType ?? ""}
            onChange={(e) => set("issuerType", (e.target.value || null) as CheckDetailsFields["issuerType"])}
            className={INPUT}
          >
            <option value="">Not sure</option>
            {Object.entries(ISSUER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Notice number */}
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
          <label htmlFor={`${idPrefix}-ref`}>
            <FieldLabel level={confidence.referenceNumber}>Notice number</FieldLabel>
          </label>
          <input
            id={`${idPrefix}-ref`}
            value={fields.referenceNumber ?? ""}
            onChange={(e) => set("referenceNumber", e.target.value || null)}
            className={INPUT}
          />
          <ConfidenceNote level={confidence.referenceNumber} reason={reasons.referenceNumber} />
        </div>

        {/* Contravention */}
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
          <label htmlFor={`${idPrefix}-desc`}>
            <FieldLabel level={confidence.contraventionDescription}>Contravention description</FieldLabel>
          </label>
          <input
            id={`${idPrefix}-desc`}
            value={fields.contraventionDescription ?? ""}
            onChange={(e) => set("contraventionDescription", e.target.value || null)}
            className={INPUT}
          />
          <ConfidenceNote level={confidence.contraventionDescription} reason={reasons.contraventionDescription} />

          <label htmlFor={`${idPrefix}-code`} className="mt-4 block">
            <FieldLabel level={confidence.contraventionCode}>Contravention code</FieldLabel>
          </label>
          <input
            id={`${idPrefix}-code`}
            value={fields.contraventionCode ?? ""}
            onChange={(e) => set("contraventionCode", e.target.value || null)}
            className={INPUT}
          />
          <ConfidenceNote level={confidence.contraventionCode} reason={reasons.contraventionCode} />
        </div>

        {/* Amount */}
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${idPrefix}-amountFull`}>
                <FieldLabel level={confidence.amountFull}>Full amount</FieldLabel>
              </label>
              <input
                id={`${idPrefix}-amountFull`}
                type="number"
                step="0.01"
                min="0"
                value={fields.amountFull ?? ""}
                onChange={(e) => set("amountFull", e.target.value === "" ? null : Number(e.target.value))}
                className={INPUT}
              />
              <ConfidenceNote level={confidence.amountFull} reason={reasons.amountFull} />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-amountDisc`}>
                <FieldLabel level={confidence.amountDiscounted}>Discounted</FieldLabel>
              </label>
              <input
                id={`${idPrefix}-amountDisc`}
                type="number"
                step="0.01"
                min="0"
                value={fields.amountDiscounted ?? ""}
                onChange={(e) => set("amountDiscounted", e.target.value === "" ? null : Number(e.target.value))}
                className={INPUT}
              />
              <ConfidenceNote level={confidence.amountDiscounted} reason={reasons.amountDiscounted} />
            </div>
          </div>
          <p className="mt-3 text-sm text-planal-ink-muted">
            Only fill in the deadlines below if a date is actually printed on the notice —
            Planal works out the standard deadline automatically otherwise.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${idPrefix}-discDeadline`} className="text-sm font-medium text-planal-ink">
                Discount deadline
              </label>
              <input
                id={`${idPrefix}-discDeadline`}
                type="date"
                value={fields.discountDeadline ?? ""}
                onChange={(e) => set("discountDeadline", e.target.value || null)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-finalDeadline`} className="text-sm font-medium text-planal-ink">
                Final deadline
              </label>
              <input
                id={`${idPrefix}-finalDeadline`}
                type="date"
                value={fields.finalDeadline ?? ""}
                onChange={(e) => set("finalDeadline", e.target.value || null)}
                className={INPUT}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-planal-danger-text" role="alert">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 -mx-5 border-t border-planal-border bg-planal-surface p-4">
          <button
            type="submit"
            disabled={pending}
            className="mx-auto flex min-h-11 w-full max-w-md items-center justify-center rounded-2xl bg-planal-brand px-4 py-3.5 text-center text-base font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            aria-live="polite"
          >
            {pending ? "Working…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
