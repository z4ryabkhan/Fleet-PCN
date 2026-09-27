"use client";

import { useState } from "react";

/** Option A ("prefilled portal helper"): the issuer's own portal still has
 * to be filled in by hand — there's no submission automation (see the
 * cost/risk write-up this replaces manual copy-from-a-textarea with
 * one-click-per-field copying, so the user is pasting, not retyping. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — the
      // value is still shown on screen, so the user can select it by hand.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-planal-ink-muted">{label}</p>
        <p className="truncate text-sm text-planal-ink">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="min-h-11 shrink-0 rounded-lg border border-planal-border px-3 text-sm font-medium text-planal-brand-dark hover:bg-planal-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Same one-click copy as CopyField, without the label/value row — for
 * dropping next to an existing control (e.g. "Save edits") rather than as
 * its own list item. */
export function CopyButton({ value, className, label = "Copy letter" }: { value: string; className: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // See CopyField's note — text is still visible for manual selection.
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={className}>
      {copied ? "Copied" : label}
    </button>
  );
}
