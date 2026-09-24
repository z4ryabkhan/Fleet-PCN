"use client";

import { useState } from "react";
import { reasonsForIssuerType, reasonByCode, renderReasonBody, type AppealReasonCode } from "@/lib/appeal-reasons";

// "Why are you appealing?" (design mockup Reason.dc.html + Zaryab's spec,
// 2026-09-24). The preview below is rendered from the same body template
// assessAppeal() itself starts from — not a separate cosmetic copy of it —
// so what the user sees here is what the AI is actually grounded in, filled
// with this ticket's real facts and never inventing any.

const INPUT =
  "mt-1.5 w-full min-h-11 rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-base text-planal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1";

const REASON_DETAILS_MAX = 500;

export function AppealReasonForm({
  issuerType,
  ticket,
  onSubmit,
  pending,
  error,
}: {
  issuerType: string | null;
  ticket: { referenceNumber?: string | null; vrm?: string | null; date?: string | null; location?: string | null };
  onSubmit: (reason: AppealReasonCode, details: string | null) => void;
  pending: boolean;
  error: string | null;
}) {
  const options = reasonsForIssuerType(issuerType);
  const legal = options.filter((r) => r.kind === "ground");
  const discretion = options.filter((r) => r.kind === "mitigation");

  const [reason, setReason] = useState<AppealReasonCode>(legal[0]?.code ?? discretion[0].code);
  const [details, setDetails] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const current = reasonByCode(reason) ?? legal[0] ?? discretion[0];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(reason, details.trim() || null);
      }}
      className="mt-6 space-y-5"
    >
      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-planal-ink">
          Your reason
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as AppealReasonCode)}
          className={INPUT}
        >
          <optgroup label="Legal grounds">
            {legal.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Ask them to use discretion">
            {discretion.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="rounded-2xl border border-planal-border bg-planal-surface p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-planal-ink">What your letter will say</p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
              current.kind === "ground"
                ? "bg-planal-brand-tint-2 text-planal-brand-dark"
                : "bg-planal-amber-bg text-planal-amber-text"
            }`}
          >
            {current.kind === "ground" ? "Legal ground" : "Asking for discretion"}
          </span>
        </div>
        <p className="mt-2 text-sm text-planal-ink-muted">{renderReasonBody(current, ticket)}</p>
        <p className="mt-2 text-sm text-planal-ink-muted">
          Appeals with evidence are more likely to succeed. You can add it any time.
        </p>
      </div>

      <div>
        <label htmlFor="reasonDetails" className="block text-sm font-medium text-planal-ink">
          Anything to add? <span className="font-normal text-planal-ink-muted">(optional)</span>
        </label>
        <textarea
          id="reasonDetails"
          rows={3}
          maxLength={REASON_DETAILS_MAX}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="One or two sentences about what happened"
          className={INPUT}
        />
        <p className="mt-1 text-sm text-planal-ink-muted">{details.length}/{REASON_DETAILS_MAX}</p>
      </div>

      <label className="flex min-h-11 items-start gap-2.5 text-sm text-planal-ink">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-planal-border focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand"
        />
        I confirm this is true to the best of my knowledge.
      </label>

      {error && (
        <p className="text-sm text-planal-danger-text" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !confirmed}
        className="flex min-h-11 w-full items-center justify-center rounded-2xl bg-planal-brand px-4 py-3.5 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        aria-live="polite"
      >
        {pending ? "Writing your appeal…" : "Write my appeal"}
      </button>
    </form>
  );
}
