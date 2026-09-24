"use client";

import { useActionState, useState } from "react";
import {
  saveDraftEditAction,
  sendAppealAction,
  confirmManualAppealSubmissionAction,
  setOutcomeAction,
  startIndividualCasePaymentAction,
  createGmailDraftAction,
  type CaseDetailActionState,
} from "@/app/dashboard/cases/[caseId]/actions";
import { groundLabel, type AppealGround } from "@/lib/appeal";
import { CheckIcon } from "@/components/ui/icons";

const initialState: CaseDetailActionState = undefined;

// Only ever rendered by the case page once an appeal already exists
// (AutoAssess handles the "no appeal yet" state before this mounts) — so
// every field below can be assumed present, no more null-appeal branch.
type Appeal = {
  ai_strength_rating: "weak" | "moderate" | "strong";
  ai_grounds_json: { ground: AppealGround; evidenceNeeded: string }[] | null;
  ai_reasoning_text: string | null;
  draft_text: string | null;
  user_edited_text: string | null;
  user_confirmed_at: string | null;
  outcome: "pending" | "won" | "lost" | null;
  sent_to_email: string | null;
  send_method: "gmail" | "outlook" | "manual" | null;
};

type IssuerMatch = {
  appeal_channel: "email" | "portal" | "post";
  appeal_email: string | null;
  portal_url: string | null;
  postal_address: string | null;
  verified_at: string | null;
  tribunal_name: string | null;
} | null;

const STRENGTH_STYLES: Record<string, string> = {
  strong: "bg-planal-brand-tint-2 text-planal-brand-dark",
  moderate: "bg-planal-amber-bg text-planal-amber-text",
  weak: "bg-planal-danger-bg text-planal-danger-text",
};

const PRIMARY_BTN =
  "min-h-11 rounded-2xl bg-planal-brand px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BTN =
  "min-h-11 rounded-xl border border-planal-border px-4 py-2 text-sm text-planal-ink-muted hover:bg-planal-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";

function SendMethodLabel({ method }: { method: Appeal["send_method"] }) {
  if (method === "gmail") return <>Gmail</>;
  if (method === "outlook") return <>Outlook</>;
  return <>your email</>;
}

export function AssessmentPanel({
  caseId,
  appeal,
  disclaimer,
  requiresPayment,
  isPaid,
  priceLabel,
  gmailDraftAvailable,
  issuerMatch,
}: {
  caseId: string;
  appeal: Appeal;
  disclaimer: string;
  requiresPayment: boolean;
  isPaid: boolean;
  priceLabel: string | null;
  gmailDraftAvailable: boolean;
  issuerMatch: IssuerMatch;
}) {
  const [payState, payAction, payPending] = useActionState(
    startIndividualCasePaymentAction,
    initialState
  );
  const [draftState, draftAction, draftPending] = useActionState(saveDraftEditAction, initialState);
  const [sendState, sendAction, sendPending] = useActionState(sendAppealAction, initialState);
  const [manualState, manualAction, manualPending] = useActionState(
    confirmManualAppealSubmissionAction,
    initialState
  );
  const [outcomeState, outcomeAction, outcomePending] = useActionState(
    setOutcomeAction,
    initialState
  );
  const [gmailState, gmailAction, gmailPending] = useActionState(
    createGmailDraftAction,
    initialState
  );
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [manualConfirmChecked, setManualConfirmChecked] = useState(false);

  const isConfirmed = Boolean(appeal.user_confirmed_at);
  const currentText = appeal.user_edited_text ?? appeal.draft_text ?? "";

  // UI review item 5: a proper success screen once it's actually sent —
  // what was sent, to whom, and what happens next. Deadline tracking is
  // real (send-reminders already runs); automatic reply detection isn't
  // built yet, so this deliberately doesn't promise it — it points back
  // at the inbox the appeal was sent from instead of claiming Planal will
  // notice a reply on its own.
  if (isConfirmed) {
    return (
      <div className="rounded-2xl border border-planal-border bg-planal-surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-planal-brand-tint text-planal-brand-dark">
            <CheckIcon className="h-5 w-5" />
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
            {appeal.send_method === "manual" ? "Appeal submitted" : "Appeal sent"}
          </h2>
        </div>

        {appeal.sent_to_email ? (
          <p className="mt-4 text-base text-planal-ink">
            Sent to <span className="font-medium">{appeal.sent_to_email}</span> from{" "}
            <SendMethodLabel method={appeal.send_method} />
            {appeal.user_confirmed_at && (
              <>
                {" "}
                on{" "}
                {new Date(appeal.user_confirmed_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                })}
              </>
            )}
            .
          </p>
        ) : (
          appeal.send_method === "manual" && (
            <p className="mt-4 text-base text-planal-ink">
              Marked as submitted{" "}
              {issuerMatch?.appeal_channel === "portal" ? "through the issuer's own portal" : "by post"}
              {appeal.user_confirmed_at && (
                <>
                  {" "}
                  on{" "}
                  {new Date(appeal.user_confirmed_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                  })}
                </>
              )}
              .
            </p>
          )
        )}

        <p className="mt-3 text-sm text-planal-ink-muted">
          We&apos;ll keep tracking this case&apos;s deadlines and remind you before they pass.
          {appeal.send_method === "manual"
            ? " Check back on the issuer's own site (or your post) for their decision — we can't see it from here."
            : ` Keep an eye on the inbox you sent from for a reply from ${appeal.sent_to_email ? "them" : "the issuer"}.`}
        </p>

        <div className="mt-4 rounded-xl bg-planal-bg p-3">
          <p className="whitespace-pre-wrap text-sm text-planal-ink-muted">{currentText}</p>
        </div>

        {appeal.outcome === "pending" ? (
          <form action={outcomeAction} className="mt-5 flex flex-wrap items-center gap-3">
            <input type="hidden" name="caseId" value={caseId} />
            <p className="w-full text-sm text-planal-ink-muted">
              Heard back?
              {requiresPayment && appeal.send_method !== "manual" && (
                <>
                  {" "}
                  No win, no fee: marking this <span className="font-medium">Won</span> charges
                  the card you saved{priceLabel ? ` (${priceLabel})` : ""} — marking it{" "}
                  <span className="font-medium">Lost</span> charges nothing.
                </>
              )}
            </p>
            <button
              type="submit"
              name="outcome"
              value="won"
              disabled={outcomePending}
              className="min-h-11 rounded-xl border border-planal-brand/30 px-3 py-1.5 text-sm text-planal-brand-dark hover:bg-planal-brand-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand"
            >
              Won
            </button>
            <button
              type="submit"
              name="outcome"
              value="lost"
              disabled={outcomePending}
              className="min-h-11 rounded-xl border border-planal-danger-text/30 px-3 py-1.5 text-sm text-planal-danger-text hover:bg-planal-danger-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-danger-text"
            >
              Lost
            </button>
            {outcomeState && "error" in outcomeState && (
              <p className="w-full text-sm text-planal-danger-text" role="alert">
                {outcomeState.error}
              </p>
            )}
          </form>
        ) : (
          appeal.outcome && (
            <p className="mt-5 text-sm text-planal-ink-muted">
              Outcome: <span className="font-medium capitalize text-planal-ink">{appeal.outcome}</span>
            </p>
          )
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-planal-border bg-planal-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
          Appeal assessment
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${STRENGTH_STYLES[appeal.ai_strength_rating]}`}
        >
          {appeal.ai_strength_rating}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-planal-amber-text" role="status">
        {disclaimer}
      </p>

      <p className="mt-4 text-base text-planal-ink">{appeal.ai_reasoning_text}</p>

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
        <label htmlFor="draftText" className="text-sm font-medium text-planal-ink">
          Draft appeal text
        </label>
        <form action={draftAction} className="mt-2 space-y-2">
          <input type="hidden" name="caseId" value={caseId} />
          <textarea
            id="draftText"
            name="editedText"
            defaultValue={currentText}
            rows={10}
            className="w-full rounded-xl border border-planal-border bg-planal-surface p-3 text-base text-planal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
          />
          {draftState && "error" in draftState && (
            <p className="text-sm text-planal-danger-text" role="alert">
              {draftState.error}
            </p>
          )}
          {draftState && "success" in draftState && (
            <p className="text-sm text-planal-brand-dark" role="status">
              {draftState.success}
            </p>
          )}
          <button type="submit" disabled={draftPending} className={SECONDARY_BTN}>
            {draftPending ? "Saving..." : "Save edits"}
          </button>
        </form>
      </div>

      {gmailDraftAvailable && (
        <div className="mt-4">
          <form action={gmailAction}>
            <input type="hidden" name="caseId" value={caseId} />
            {gmailState && "error" in gmailState && (
              <p className="mb-2 text-sm text-planal-danger-text" role="alert">
                {gmailState.error}
              </p>
            )}
            {gmailState && "success" in gmailState && (
              <p className="mb-2 text-sm text-planal-brand-dark" role="status">
                {gmailState.success}
              </p>
            )}
            <button type="submit" disabled={gmailPending} className={SECONDARY_BTN}>
              {gmailPending ? "Creating draft..." : "Create this as a Gmail draft"}
            </button>
            <p className="mt-2 text-sm text-planal-ink-muted">
              Saves this text as an unsent draft in your Gmail — you add who it&apos;s going to
              and hit send yourself. Planal never sends it for you.
            </p>
          </form>
        </div>
      )}

      {issuerMatch && issuerMatch.appeal_channel !== "email" && (
        <>
          <div className="mt-6 rounded-xl border border-planal-amber-text/20 bg-planal-amber-bg p-4 text-sm text-planal-amber-text">
            {issuerMatch.appeal_channel === "portal" ? (
              <>
                This issuer only accepts appeals through their own portal — email won&apos;t reach
                them. Copy the draft above and submit it there
                {issuerMatch.portal_url ? ` (${issuerMatch.portal_url})` : ""}.
              </>
            ) : (
              <>This issuer only accepts appeals by post. Use the PDF pack below instead of emailing.</>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-planal-border bg-planal-bg p-4">
            <p className="text-sm text-planal-ink-muted">
              Free — Planal drafted this for you, but can&apos;t submit it on your behalf here, so
              there&apos;s no charge for this step.
            </p>
            <form action={manualAction} className="mt-3 space-y-2">
              <input type="hidden" name="caseId" value={caseId} />
              <label className="flex min-h-11 items-center gap-2 text-sm text-planal-ink">
                <input
                  type="checkbox"
                  checked={manualConfirmChecked}
                  onChange={(e) => setManualConfirmChecked(e.target.checked)}
                  className="h-5 w-5 rounded border-planal-border focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand"
                />
                I&apos;ve submitted this appeal
                {issuerMatch.appeal_channel === "portal" ? " on their portal" : " by post"}
              </label>
              {manualState && "error" in manualState && (
                <p className="text-sm text-planal-danger-text" role="alert">
                  {manualState.error}
                </p>
              )}
              <button
                type="submit"
                disabled={manualPending || !manualConfirmChecked}
                className={`w-full ${PRIMARY_BTN}`}
                aria-live="polite"
              >
                {manualPending ? "Saving..." : "I've submitted this"}
              </button>
            </form>
          </div>
        </>
      )}

      {(!issuerMatch || issuerMatch.appeal_channel === "email") &&
        (requiresPayment && !isPaid ? (
          <div className="mt-6 rounded-xl border border-planal-border bg-planal-bg p-4">
            <p className="text-base text-planal-ink">
              No win, no fee — save a card to send now. We only charge {priceLabel ?? "you"} if
              this appeal wins; nothing is taken if it&apos;s rejected.
            </p>
            <form action={payAction} className="mt-3">
              <input type="hidden" name="caseId" value={caseId} />
              {payState && "error" in payState && (
                <p className="mb-2 text-sm text-planal-danger-text" role="alert">
                  {payState.error}
                </p>
              )}
              <button type="submit" disabled={payPending} className={`w-full ${PRIMARY_BTN}`}>
                {payPending ? "Redirecting…" : "Save card & send"}
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-planal-border bg-planal-bg p-4">
            <p className="text-base text-planal-ink">
              Sends immediately from your own connected Gmail or Outlook, with any evidence
              attached — there is no further step after this.
            </p>
            {!issuerMatch?.verified_at && (
              <p className="mt-2 text-sm text-planal-ink-muted">
                No verified address on file for this issuer yet — check the notice itself for
                where appeals should go.
              </p>
            )}
            <form action={sendAction} className="mt-3 space-y-2">
              <input type="hidden" name="caseId" value={caseId} />
              <label htmlFor="sendTo" className="block text-sm font-medium text-planal-ink">
                Send to
              </label>
              <input
                id="sendTo"
                name="to"
                type="email"
                required
                defaultValue={issuerMatch?.appeal_email ?? ""}
                placeholder="appeals@example-council.gov.uk"
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
              {sendState && "error" in sendState && (
                <p className="text-sm text-planal-danger-text" role="alert">
                  {sendState.error}
                </p>
              )}
              <button
                type="submit"
                disabled={sendPending || !confirmChecked}
                className={`w-full ${PRIMARY_BTN}`}
                aria-live="polite"
              >
                {sendPending ? "Sending..." : "Send from my email"}
              </button>
            </form>
          </div>
        ))}
    </div>
  );
}
