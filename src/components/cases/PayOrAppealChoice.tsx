"use client";

import { useActionState } from "react";
import { markCasePaidAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";

const initialState: CaseDetailActionState = undefined;

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** UI review item 4: a clear fork right after the assessment appears —
 * pay the discounted fine now (reusing the existing mark-as-paid record;
 * Planal is never merchant of record for the fine itself), or go ahead
 * with the appeal already drafted below. */
export function PayOrAppealChoice({
  caseId,
  amountDiscounted,
  discountDeadline,
}: {
  caseId: string;
  amountDiscounted: number | null;
  discountDeadline: string | null;
}) {
  const [state, formAction, pending] = useActionState(markCasePaidAction, initialState);

  if (amountDiscounted == null) return null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <form action={formAction}>
        <input type="hidden" name="caseId" value={caseId} />
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-11 w-full flex-col items-center justify-center rounded-2xl border border-planal-border bg-planal-surface px-3 py-3 text-center hover:bg-planal-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1 disabled:opacity-60"
        >
          <span className="text-base font-semibold">Pay £{amountDiscounted} now</span>
          {discountDeadline && (
            <span className="mt-0.5 text-sm text-planal-ink-muted">by {formatDate(discountDeadline)}</span>
          )}
        </button>
      </form>
      <a
        href="#send-appeal"
        className="flex min-h-11 w-full items-center justify-center rounded-2xl bg-planal-brand px-3 py-3 text-center text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
      >
        Appeal
      </a>
      {state && "error" in state && (
        <p className="col-span-2 text-sm text-planal-danger-text" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
