"use client";

import { useActionState, useState } from "react";
import {
  requestAssessmentAction,
  saveDraftEditAction,
  confirmAppealAction,
  setOutcomeAction,
  startIndividualCasePaymentAction,
  type CaseDetailActionState,
} from "@/app/dashboard/cases/[caseId]/actions";
import { groundLabel, type AppealGround } from "@/lib/appeal";

const initialState: CaseDetailActionState = undefined;

type Appeal = {
  ai_strength_rating: "weak" | "moderate" | "strong" | null;
  ai_grounds_json: { ground: AppealGround; evidenceNeeded: string }[] | null;
  ai_reasoning_text: string | null;
  draft_text: string | null;
  user_edited_text: string | null;
  user_confirmed_at: string | null;
  outcome: "pending" | "won" | "lost" | null;
};

const STRENGTH_STYLES: Record<string, string> = {
  strong: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  moderate: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  weak: "bg-red-500/15 text-red-300 border-red-500/30",
};

export function AssessmentPanel({
  caseId,
  appeal,
  disclaimer,
  requiresPayment,
  isPaid,
}: {
  caseId: string;
  appeal: Appeal | null;
  disclaimer: string;
  requiresPayment: boolean;
  isPaid: boolean;
}) {
  const [assessState, assessAction, assessPending] = useActionState(
    requestAssessmentAction,
    initialState
  );
  const [payState, payAction, payPending] = useActionState(
    startIndividualCasePaymentAction,
    initialState
  );
  const [draftState, draftAction, draftPending] = useActionState(saveDraftEditAction, initialState);
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmAppealAction,
    initialState
  );
  const [outcomeState, outcomeAction, outcomePending] = useActionState(
    setOutcomeAction,
    initialState
  );
  const [confirmChecked, setConfirmChecked] = useState(false);

  if (!appeal || !appeal.ai_strength_rating) {
    if (requiresPayment && !isPaid) {
      return (
        <div className="rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-medium">Appeal assessment</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Pay £9.99 to unlock an AI assessment of appeal strength and a draft you can review,
            edit, and submit yourself. Free monitoring stays free — this only applies when you
            want the AI assessment.
          </p>
          <form action={payAction} className="mt-4">
            <input type="hidden" name="caseId" value={caseId} />
            {payState && "error" in payState && (
              <p className="mb-3 text-sm text-red-400">{payState.error}</p>
            )}
            <button
              type="submit"
              disabled={payPending}
              className="rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {payPending ? "Redirecting..." : "Pay £9.99 to unlock"}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-medium">Appeal assessment</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Get an AI assessment of appeal strength and a draft you can review, edit, and submit
          yourself.
        </p>
        <form action={assessAction} className="mt-4">
          <input type="hidden" name="caseId" value={caseId} />
          {assessState && "error" in assessState && (
            <p className="mb-3 text-sm text-red-400">{assessState.error}</p>
          )}
          <button
            type="submit"
            disabled={assessPending}
            className="rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {assessPending ? "Assessing..." : "Assess & draft appeal"}
          </button>
        </form>
      </div>
    );
  }

  const isConfirmed = Boolean(appeal.user_confirmed_at);
  const currentText = appeal.user_edited_text ?? appeal.draft_text ?? "";

  return (
    <div className="rounded-xl border border-white/10 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Appeal assessment</h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${STRENGTH_STYLES[appeal.ai_strength_rating]}`}
        >
          {appeal.ai_strength_rating}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-amber-300">{disclaimer}</p>

      <p className="mt-4 text-sm text-zinc-300">{appeal.ai_reasoning_text}</p>

      {appeal.ai_grounds_json && appeal.ai_grounds_json.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-zinc-300">Applicable grounds</p>
          <ul className="mt-2 space-y-2">
            {appeal.ai_grounds_json.map((g, i) => (
              <li key={i} className="rounded-md bg-white/5 p-3 text-sm">
                <p className="font-medium">{groundLabel(g.ground)}</p>
                <p className="mt-1 text-zinc-400">Evidence needed: {g.evidenceNeeded}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <p className="text-sm font-medium text-zinc-300">Draft appeal text</p>
        {isConfirmed ? (
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-white/5 p-4 text-sm text-zinc-300">
            {currentText}
          </p>
        ) : (
          <form action={draftAction} className="mt-2 space-y-2">
            <input type="hidden" name="caseId" value={caseId} />
            <textarea
              name="editedText"
              defaultValue={currentText}
              rows={10}
              className="w-full rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
            {draftState && "error" in draftState && (
              <p className="text-sm text-red-400">{draftState.error}</p>
            )}
            {draftState && "success" in draftState && (
              <p className="text-sm text-emerald-400">{draftState.success}</p>
            )}
            <button
              type="submit"
              disabled={draftPending}
              className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {draftPending ? "Saving..." : "Save edits"}
            </button>
          </form>
        )}
      </div>

      {!isConfirmed && (
        <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-zinc-300">
            Planal never submits appeals for you. This only marks the case as appealed in your
            dashboard — you still need to copy this text and submit it yourself, on the
            issuer&apos;s (or tribunal&apos;s) own site or by post.
          </p>
          <form action={confirmAction} className="mt-3">
            <input type="hidden" name="caseId" value={caseId} />
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="rounded border-white/20"
              />
              I understand I still need to submit this myself
            </label>
            {confirmState && "error" in confirmState && (
              <p className="mt-2 text-sm text-red-400">{confirmState.error}</p>
            )}
            <button
              type="submit"
              disabled={confirmPending || !confirmChecked}
              className="mt-3 rounded-md bg-amber-500 px-4 py-2.5 font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirmPending ? "Confirming..." : "Confirm — mark as appealed"}
            </button>
          </form>
        </div>
      )}

      {isConfirmed && appeal.outcome === "pending" && (
        <form action={outcomeAction} className="mt-6 flex items-center gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <p className="text-sm text-zinc-400">Heard back?</p>
          <button
            type="submit"
            name="outcome"
            value="won"
            disabled={outcomePending}
            className="rounded-md border border-emerald-500/30 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/10"
          >
            Won
          </button>
          <button
            type="submit"
            name="outcome"
            value="lost"
            disabled={outcomePending}
            className="rounded-md border border-red-500/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
          >
            Lost
          </button>
          {outcomeState && "error" in outcomeState && (
            <p className="text-sm text-red-400">{outcomeState.error}</p>
          )}
        </form>
      )}

      {isConfirmed && appeal.outcome && appeal.outcome !== "pending" && (
        <p className="mt-6 text-sm text-zinc-400">
          Outcome: <span className="font-medium capitalize text-zinc-200">{appeal.outcome}</span>
        </p>
      )}
    </div>
  );
}
