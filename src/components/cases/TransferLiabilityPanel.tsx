"use client";

import { useState } from "react";
import { useActionState } from "react";
import { sendTransferLiabilityAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";

const initialState: CaseDetailActionState = undefined;

const PRIMARY_BTN =
  "min-h-11 rounded-xl bg-planal-brand px-4 py-2.5 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

/** Build brief Phase 4 "transfer_liability" route (0043): this vehicle's
 * hire record covers the contravention date, so Planal sends a
 * notification naming the hirer instead of an appeal — see
 * src/lib/transfer-liability.ts for why this is a template, not an AI
 * draft. Shown in place of AssessmentPanel whenever cases.route is
 * 'transfer_liability'. */
export function TransferLiabilityPanel({
  caseId,
  hirerName,
  hirerAddress,
  hireStart,
  hireEnd,
  hasAgreement,
  issuerEmail,
  alreadySent,
}: {
  caseId: string;
  hirerName: string;
  hirerAddress: string;
  hireStart: string;
  hireEnd: string;
  hasAgreement: boolean;
  issuerEmail: string | null;
  alreadySent: boolean;
}) {
  const [state, formAction, pending] = useActionState(sendTransferLiabilityAction, initialState);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const window = `${new Date(hireStart).toLocaleDateString("en-GB")} – ${new Date(hireEnd).toLocaleDateString("en-GB")}`;

  return (
    <div className="rounded-2xl border border-planal-border bg-planal-surface p-5">
      <p className="text-base font-semibold text-planal-ink">This ticket matches a hire on record</p>
      <p className="mt-1 text-sm text-planal-ink-muted">
        {hirerName} had this vehicle from {window} — covering the date on the notice. Planal will notify the
        issuer who was driving instead of appealing.
      </p>

      <div className="mt-3 rounded-xl border border-planal-border bg-planal-bg p-3 text-sm text-planal-ink">
        <p className="font-medium">{hirerName}</p>
        <p className="whitespace-pre-line text-planal-ink-muted">{hirerAddress}</p>
        {hasAgreement && <p className="mt-1 text-planal-ink-muted">Hire agreement attached to the letter.</p>}
      </div>

      {alreadySent ? (
        <p className="mt-4 text-sm text-planal-ink-muted">Sent — check back here once you hear the outcome.</p>
      ) : (
        <form action={formAction} className="mt-4 space-y-2">
          <input type="hidden" name="caseId" value={caseId} />
          <label htmlFor="transferTo" className="block text-sm font-medium text-planal-ink">
            Send to
          </label>
          <input
            id="transferTo"
            name="to"
            type="email"
            required
            defaultValue={issuerEmail ?? ""}
            placeholder="appeals@example-operator.co.uk"
            className="mt-1 w-full min-h-11 rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-base text-planal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
          />
          <label className="flex min-h-11 items-center gap-2 text-sm text-planal-ink">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="h-5 w-5 rounded border-planal-border focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand"
            />
            I&apos;ve checked this address and I&apos;m ready to send
          </label>
          {state && "error" in state && (
            <p className="text-sm text-planal-danger-text" role="alert">
              {state.error}
            </p>
          )}
          <button type="submit" disabled={pending || !confirmChecked} className={`w-full ${PRIMARY_BTN}`}>
            {pending ? "Sending…" : "Send transfer notice"}
          </button>
        </form>
      )}
    </div>
  );
}
