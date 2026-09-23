"use client";

import { useActionState } from "react";
import { markCasePaidAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";

const initialState: CaseDetailActionState = undefined;

export function MarkPaidButton({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(markCasePaidAction, initialState);

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="caseId" value={caseId} />
      {state && "error" in state && <p className="mb-2 text-sm text-planal-danger-text">{state.error}</p>}
      {state && "success" in state && <p className="mb-2 text-sm text-planal-brand-dark">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-planal-border px-3 py-1.5 text-xs text-planal-ink-muted hover:bg-planal-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "I paid this — mark as paid"}
      </button>
    </form>
  );
}
