"use client";

import { useActionState } from "react";
import { resolveHireMatchAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";

const initialState: CaseDetailActionState = undefined;

type Candidate = { id: string; hirerName: string; startAt: string; endAt: string };

/** Build brief Phase 4 "needs_review" route (0043): more than one hire
 * record overlaps this vehicle's contravention date, so compute_case_route
 * couldn't pick one automatically — an admin has to. */
export function NeedsReviewPanel({ caseId, candidates }: { caseId: string; candidates: Candidate[] }) {
  const [state, formAction, pending] = useActionState(resolveHireMatchAction, initialState);

  return (
    <div className="rounded-2xl border border-planal-border bg-planal-surface p-5">
      <p className="text-base font-semibold text-planal-ink">Which hire does this ticket belong to?</p>
      <p className="mt-1 text-sm text-planal-ink-muted">
        More than one hire on record covers this vehicle on the date of the notice — pick the right one, or treat
        this as a normal appeal.
      </p>

      <form action={formAction} className="mt-4 space-y-2">
        <input type="hidden" name="caseId" value={caseId} />
        {candidates.map((c) => (
          <label
            key={c.id}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-planal-border bg-planal-bg px-3 py-2 text-sm text-planal-ink"
          >
            <input type="radio" name="choice" value={c.id} required className="h-4 w-4" />
            {c.hirerName} — {new Date(c.startAt).toLocaleDateString("en-GB")} to{" "}
            {new Date(c.endAt).toLocaleDateString("en-GB")}
          </label>
        ))}
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-planal-border bg-planal-bg px-3 py-2 text-sm text-planal-ink">
          <input type="radio" name="choice" value="appeal" required className="h-4 w-4" />
          None of these — treat as a normal appeal
        </label>

        {state && "error" in state && (
          <p className="text-sm text-planal-danger-text" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-planal-brand px-4 py-2.5 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Confirm"}
        </button>
      </form>
    </div>
  );
}
