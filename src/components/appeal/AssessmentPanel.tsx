"use client";

import { useActionState, useState } from "react";
import {
  requestAssessmentAction,
  saveDraftEditAction,
  sendAppealAction,
  setOutcomeAction,
  startIndividualCasePaymentAction,
  createGmailDraftAction,
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

type IssuerMatch = {
  appeal_channel: "email" | "portal" | "post";
  appeal_email: string | null;
  portal_url: string | null;
  postal_address: string | null;
  verified_at: string | null;
} | null;

const STRENGTH_STYLES: Record<string, string> = {
  strong: "bg-planal-brand-tint-2 text-planal-brand-dark",
  moderate: "bg-planal-amber-bg text-planal-amber-text",
  weak: "bg-planal-danger-bg text-planal-danger-text",
};

const PRIMARY_BTN =
  "rounded-2xl bg-planal-brand px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BTN =
  "rounded-xl border border-planal-border px-4 py-2 text-sm text-planal-ink-muted hover:bg-planal-bg disabled:cursor-not-allowed disabled:opacity-60";

export function AssessmentPanel({
  caseId,
  appeal,
  disclaimer,
  requiresPayment,
  isPaid,
  gmailDraftAvailable,
  issuerMatch,
}: {
  caseId: string;
  appeal: Appeal | null;
  disclaimer: string;
  requiresPayment: boolean;
  isPaid: boolean;
  gmailDraftAvailable: boolean;
  issuerMatch: IssuerMatch;
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
  const [sendState, sendAction, sendPending] = useActionState(sendAppealAction, initialState);
  const [outcomeState, outcomeAction, outcomePending] = useActionState(
    setOutcomeAction,
    initialState
  );
  const [gmailState, gmailAction, gmailPending] = useActionState(
    createGmailDraftAction,
    initialState
  );
  const [confirmChecked, setConfirmChecked] = useState(false);

  if (!appeal || !appeal.ai_strength_rating) {
    if (requiresPayment && !isPaid) {
      return (
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
            Appeal assessment
          </h2>
          <p className="mt-2 text-sm text-planal-ink-muted">
            Pay £9.99 to unlock an AI assessment of appeal strength and a draft you can review,
            edit, and submit yourself. Free monitoring stays free — this only applies when you
            want the AI assessment.
          </p>
          <form action={payAction} className="mt-4">
            <input type="hidden" name="caseId" value={caseId} />
            {payState && "error" in payState && (
              <p className="mb-3 text-sm text-planal-danger-text">{payState.error}</p>
            )}
            <button type="submit" disabled={payPending} className={PRIMARY_BTN}>
              {payPending ? "Redirecting..." : "Pay £9.99 to unlock"}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-planal-border bg-planal-surface p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
          Appeal assessment
        </h2>
        <p className="mt-2 text-sm text-planal-ink-muted">
          Get an AI assessment of appeal strength and a draft you can review, edit, and submit
          yourself.
        </p>
        <form action={assessAction} className="mt-4">
          <input type="hidden" name="caseId" value={caseId} />
          {assessState && "error" in assessState && (
            <p className="mb-3 text-sm text-planal-danger-text">{assessState.error}</p>
          )}
          <button type="submit" disabled={assessPending} className={PRIMARY_BTN}>
            {assessPending ? "Assessing..." : "Assess & draft appeal"}
          </button>
        </form>
      </div>
    );
  }

  const isConfirmed = Boolean(appeal.user_confirmed_at);
  const currentText = appeal.user_edited_text ?? appeal.draft_text ?? "";

  return (
    <div className="rounded-2xl border border-planal-border bg-planal-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
          Appeal assessment
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STRENGTH_STYLES[appeal.ai_strength_rating]}`}
        >
          {appeal.ai_strength_rating}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-planal-amber-text">{disclaimer}</p>

      <p className="mt-4 text-sm text-planal-ink">{appeal.ai_reasoning_text}</p>

      {appeal.ai_grounds_json && appeal.ai_grounds_json.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-planal-ink">Applicable grounds</p>
          <ul className="mt-2 space-y-2">
            {appeal.ai_grounds_json.map((g, i) => (
              <li key={i} className="rounded-xl bg-planal-bg p-3 text-sm">
                <p className="font-medium">{groundLabel(g.ground)}</p>
                <p className="mt-1 text-planal-ink-muted">Evidence needed: {g.evidenceNeeded}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <p className="text-sm font-medium text-planal-ink">Draft appeal text</p>
        {isConfirmed ? (
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-planal-bg p-4 text-sm text-planal-ink">
            {currentText}
          </p>
        ) : (
          <form action={draftAction} className="mt-2 space-y-2">
            <input type="hidden" name="caseId" value={caseId} />
            <textarea
              name="editedText"
              defaultValue={currentText}
              rows={10}
              className="w-full rounded-xl border border-planal-border bg-planal-surface p-3 text-sm text-planal-ink focus:border-planal-brand focus:outline-none focus:ring-2 focus:ring-planal-brand-tint"
            />
            {draftState && "error" in draftState && (
              <p className="text-sm text-planal-danger-text">{draftState.error}</p>
            )}
            {draftState && "success" in draftState && (
              <p className="text-sm text-planal-brand-dark">{draftState.success}</p>
            )}
            <button type="submit" disabled={draftPending} className={SECONDARY_BTN}>
              {draftPending ? "Saving..." : "Save edits"}
            </button>
          </form>
        )}
      </div>

      {!isConfirmed && gmailDraftAvailable && (
        <div className="mt-4">
          <form action={gmailAction}>
            <input type="hidden" name="caseId" value={caseId} />
            {gmailState && "error" in gmailState && (
              <p className="mb-2 text-sm text-planal-danger-text">{gmailState.error}</p>
            )}
            {gmailState && "success" in gmailState && (
              <p className="mb-2 text-sm text-planal-brand-dark">{gmailState.success}</p>
            )}
            <button type="submit" disabled={gmailPending} className={SECONDARY_BTN}>
              {gmailPending ? "Creating draft..." : "Create this as a Gmail draft"}
            </button>
            <p className="mt-2 text-xs text-planal-ink-muted">
              Saves this text as an unsent draft in your Gmail — you add who it&apos;s going to
              and hit send yourself. Planal never sends it for you.
            </p>
          </form>
        </div>
      )}

      {!isConfirmed && issuerMatch && issuerMatch.appeal_channel !== "email" && (
        <div className="mt-6 rounded-xl border border-planal-amber-text/20 bg-planal-amber-bg p-4 text-sm text-planal-amber-text">
          {issuerMatch.appeal_channel === "portal"
            ? <>This issuer only accepts appeals through their own portal — email won&apos;t reach them. Copy the draft above and submit it there{issuerMatch.portal_url ? ` (${issuerMatch.portal_url})` : ""}.</>
            : <>This issuer only accepts appeals by post. Use the PDF pack below instead of emailing.</>}
        </div>
      )}

      {!isConfirmed && (!issuerMatch || issuerMatch.appeal_channel === "email") && (
        <div className="mt-6 rounded-xl border border-planal-border bg-planal-bg p-4">
          <p className="text-sm text-planal-ink">
            Sends immediately from your own connected Gmail or Outlook, with any evidence
            attached — there is no further step after this.
          </p>
          {issuerMatch?.verified_at ? null : (
            <p className="mt-2 text-xs text-planal-ink-muted">
              No verified address on file for this issuer yet — check the notice itself for
              where appeals should go.
            </p>
          )}
          <form action={sendAction} className="mt-3 space-y-2">
            <input type="hidden" name="caseId" value={caseId} />
            <label className="block text-sm font-medium text-planal-ink">
              Send to
              <input
                name="to"
                type="email"
                required
                defaultValue={issuerMatch?.appeal_email ?? ""}
                placeholder="appeals@example-council.gov.uk"
                className="mt-1 w-full rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-[15px] text-planal-ink focus:border-planal-brand focus:outline-none focus:ring-2 focus:ring-planal-brand-tint"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-planal-ink">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="h-4 w-4 rounded border-planal-border"
              />
              I&apos;ve checked this address and I&apos;m ready to send
            </label>
            {sendState && "error" in sendState && (
              <p className="text-sm text-planal-danger-text">{sendState.error}</p>
            )}
            {sendState && "success" in sendState && (
              <p className="text-sm text-planal-brand-dark">{sendState.success}</p>
            )}
            <button
              type="submit"
              disabled={sendPending || !confirmChecked}
              className={PRIMARY_BTN}
            >
              {sendPending ? "Sending..." : "Send from my email"}
            </button>
          </form>
        </div>
      )}

      {isConfirmed && appeal.outcome === "pending" && (
        <form action={outcomeAction} className="mt-6 flex items-center gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <p className="text-sm text-planal-ink-muted">Heard back?</p>
          <button
            type="submit"
            name="outcome"
            value="won"
            disabled={outcomePending}
            className="rounded-xl border border-planal-brand/30 px-3 py-1.5 text-sm text-planal-brand-dark hover:bg-planal-brand-tint"
          >
            Won
          </button>
          <button
            type="submit"
            name="outcome"
            value="lost"
            disabled={outcomePending}
            className="rounded-xl border border-planal-danger-text/30 px-3 py-1.5 text-sm text-planal-danger-text hover:bg-planal-danger-bg"
          >
            Lost
          </button>
          {outcomeState && "error" in outcomeState && (
            <p className="text-sm text-planal-danger-text">{outcomeState.error}</p>
          )}
        </form>
      )}

      {isConfirmed && appeal.outcome && appeal.outcome !== "pending" && (
        <p className="mt-6 text-sm text-planal-ink-muted">
          Outcome: <span className="font-medium capitalize text-planal-ink">{appeal.outcome}</span>
        </p>
      )}
    </div>
  );
}
