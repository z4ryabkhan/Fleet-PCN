"use client";

import { useActionState } from "react";
import { markCasePaidAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";

const initialState: CaseDetailActionState = undefined;

export function MarkPaidButton({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(markCasePaidAction, initialState);

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="caseId" value={caseId} />
      {state && "error" in state && <p className="mb-2 text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="mb-2 text-sm text-emerald-400">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "I paid this — mark as paid"}
      </button>
    </form>
  );
}
