"use client";

import { useActionState, useState } from "react";
import { sendEvidenceReplyAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";
import { AlertIcon } from "@/components/ui/icons";

const initialState: CaseDetailActionState = undefined;

/** Evidence-on-request (Zaryab's spec): shown only once the issuer's own
 * reply has actually asked for proof (scan-mailboxes classified it and
 * created the evidence_requests row this reads) — evidence is never
 * required before that. Hints come from the reason the user themselves
 * picked at "Why are you appealing?", never invented here. */
export function EvidenceRequestBanner({
  caseId,
  evidenceRequestId,
  dueAt,
  hints,
}: {
  caseId: string;
  evidenceRequestId: string;
  dueAt: string | null;
  hints: string[];
}) {
  const [state, formAction, pending] = useActionState(sendEvidenceReplyAction, initialState);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 rounded-2xl border border-planal-amber-text/20 bg-planal-amber-bg p-4">
      <div className="flex items-start gap-2">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-planal-amber-text" />
        <div>
          <p className="text-base font-semibold text-planal-amber-text">
            The issuer asked for proof. Here&apos;s what helps for your reason.
          </p>
          {dueAt && (
            <p className="mt-1 text-sm text-planal-amber-text">
              They asked for this by{" "}
              {new Date(`${dueAt}T00:00:00Z`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              })}
              .
            </p>
          )}
          {hints.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-planal-amber-text">
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 min-h-11 rounded-xl bg-planal-brand px-4 py-2.5 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
        >
          Upload and send
        </button>
      ) : (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="evidenceRequestId" value={evidenceRequestId} />

          <label htmlFor="evidenceType" className="block text-sm font-medium text-planal-ink">
            Evidence type
          </label>
          <select
            id="evidenceType"
            name="evidenceType"
            defaultValue="other"
            className="w-full min-h-11 rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-base text-planal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
          >
            <option value="receipt">Receipt</option>
            <option value="permit">Permit</option>
            <option value="blue_badge">Blue Badge</option>
            <option value="breakdown_doc">Breakdown document</option>
            <option value="other">Other</option>
          </select>

          <label htmlFor="evidenceFile" className="block text-sm font-medium text-planal-ink">
            File
          </label>
          <input
            id="evidenceFile"
            name="file"
            type="file"
            required
            accept="application/pdf,image/*"
            className="w-full text-sm text-planal-ink-muted file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-planal-brand-tint file:px-3 file:py-2 file:text-sm file:font-medium file:text-planal-brand-dark hover:file:bg-planal-brand-tint-2"
          />

          <label htmlFor="evidenceNote" className="block text-sm font-medium text-planal-ink">
            Note to include <span className="font-normal text-planal-ink-muted">(optional)</span>
          </label>
          <textarea
            id="evidenceNote"
            name="note"
            rows={2}
            placeholder="Please find the requested evidence attached."
            className="w-full rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-base text-planal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
          />

          {state && "error" in state && (
            <p className="text-sm text-planal-danger-text" role="alert">
              {state.error}
            </p>
          )}
          {state && "success" in state && (
            <p className="text-sm text-planal-brand-dark" role="status">
              {state.success}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full rounded-xl bg-planal-brand px-4 py-2.5 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            aria-live="polite"
          >
            {pending ? "Sending…" : "Send this evidence"}
          </button>
        </form>
      )}
    </div>
  );
}
