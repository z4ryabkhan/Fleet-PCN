"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestAssessmentAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";

const initialState: CaseDetailActionState = undefined;

/** UI review item 4: "run assessment and draft automatically after
 * confirm, with a loading state" — rendered by the case page only when
 * details_confirmed_at is set but no appeal exists yet, so it fires once
 * per case, not on every visit. revalidatePath inside the action refreshes
 * the page's server data once it completes, which swaps this component out
 * for the real AssessmentPanel. */
export function AutoAssess({ caseId }: { caseId: string }) {
  const [state, formAction] = useActionState(requestAssessmentAction, initialState);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const formData = new FormData();
    formData.set("caseId", caseId);
    formAction(formData);
  }, [caseId, formAction]);

  if (state && "error" in state) {
    return (
      <div className="rounded-2xl border border-planal-border bg-planal-surface p-5" role="alert">
        <p className="text-base font-semibold">Couldn&apos;t check your chances yet</p>
        <p className="mt-1 text-sm text-planal-ink-muted">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-planal-border bg-planal-surface p-5 text-center" role="status" aria-live="polite">
      <p className="text-base font-medium">Checking your chances and writing your appeal…</p>
      <p className="mt-1 text-sm text-planal-ink-muted">This usually takes a few seconds.</p>
    </div>
  );
}
