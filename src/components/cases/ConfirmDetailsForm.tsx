"use client";

import { useActionState } from "react";
import { confirmDetailsAction, type ConfirmDetailsState } from "@/app/dashboard/cases/[caseId]/confirm/actions";

const initialState: ConfirmDetailsState = undefined;

const ISSUER_TYPE_LABELS: Record<string, string> = {
  council_pcn: "Council PCN",
  tfl_pcn: "TfL PCN",
  congestion_charge: "Congestion Charge",
  ulez: "ULEZ",
  dart_charge: "Dart Charge",
  private_pcn: "Private parking",
  bus_lane: "Bus lane",
  moving_traffic: "Moving traffic",
};

type Confidence = "high" | "low";

type Details = {
  issuerName: string | null;
  issuerType: string | null;
  referenceNumber: string | null;
  contraventionCode: string | null;
  contraventionDescription: string | null;
  locationText: string | null;
  eventDatetime: string | null;
  noticeDate: string | null;
  amountFull: number | null;
  amountDiscounted: number | null;
  discountDeadline: string | null;
  finalDeadline: string | null;
};

function ConfidenceTag({ level }: { level: Confidence | undefined }) {
  if (level === "low") {
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-planal-amber-bg px-2 py-0.5 text-[11px] font-semibold text-planal-amber-text">
        Please check
      </span>
    );
  }
  if (level === "high") {
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-planal-brand-tint-2 px-2 py-0.5 text-[11px] font-semibold text-planal-brand-dark">
        Read
      </span>
    );
  }
  return null;
}

const LABEL = "flex items-center text-sm font-medium text-planal-ink";
const INPUT =
  "mt-1.5 w-full rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-[15px] text-planal-ink focus:border-planal-brand focus:outline-none focus:ring-2 focus:ring-planal-brand-tint";

export function ConfirmDetailsForm({
  caseId,
  vrm,
  details,
  confidence,
}: {
  caseId: string;
  vrm: string;
  details: Details;
  confidence: Record<string, Confidence> | null;
}) {
  const [state, formAction, pending] = useActionState(confirmDetailsAction, initialState);
  const conf = (key: string) => confidence?.[key];

  return (
    <form action={formAction} className="mt-6 space-y-4 pb-28">
      <input type="hidden" name="caseId" value={caseId} />

      {vrm && (
        <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-planal-ink-muted">Vehicle</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold">{vrm}</p>
        </div>
      )}

      <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
        <label className={LABEL}>
          Issuer
          <ConfidenceTag level={conf("issuerName")} />
        </label>
        <input name="issuerName" defaultValue={details.issuerName ?? ""} className={INPUT} />

        <label className={`${LABEL} mt-4`}>
          Type
        </label>
        <select name="issuerType" defaultValue={details.issuerType ?? ""} className={INPUT}>
          <option value="">Not sure</option>
          {Object.entries(ISSUER_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
        <label className={LABEL}>
          Notice number
          <ConfidenceTag level={conf("referenceNumber")} />
        </label>
        <input name="referenceNumber" defaultValue={details.referenceNumber ?? ""} className={INPUT} />

        <label className={`${LABEL} mt-4`}>
          Contravention code
          <ConfidenceTag level={conf("contraventionCode")} />
        </label>
        <input name="contraventionCode" defaultValue={details.contraventionCode ?? ""} className={INPUT} />

        <label className={`${LABEL} mt-4`}>
          What it says on the notice
          <ConfidenceTag level={conf("contraventionDescription")} />
        </label>
        <input
          name="contraventionDescription"
          defaultValue={details.contraventionDescription ?? ""}
          className={INPUT}
        />
      </div>

      <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
        <label className={LABEL}>
          Location
          <ConfidenceTag level={conf("locationText")} />
        </label>
        <input name="locationText" defaultValue={details.locationText ?? ""} className={INPUT} />

        <label className={`${LABEL} mt-4`}>
          When it happened
          <ConfidenceTag level={conf("eventDatetime")} />
        </label>
        <input
          name="eventDatetime"
          type="datetime-local"
          defaultValue={details.eventDatetime?.slice(0, 16) ?? ""}
          className={INPUT}
        />

        <label className={`${LABEL} mt-4`}>
          Date of the notice
          <ConfidenceTag level={conf("noticeDate")} />
        </label>
        <input name="noticeDate" type="date" defaultValue={details.noticeDate ?? ""} className={INPUT} />
      </div>

      <div className="rounded-2xl border border-planal-border bg-planal-surface p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>
              Full amount
              <ConfidenceTag level={conf("amountFull")} />
            </label>
            <input
              name="amountFull"
              type="number"
              step="0.01"
              min="0"
              defaultValue={details.amountFull ?? ""}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>
              Discounted
              <ConfidenceTag level={conf("amountDiscounted")} />
            </label>
            <input
              name="amountDiscounted"
              type="number"
              step="0.01"
              min="0"
              defaultValue={details.amountDiscounted ?? ""}
              className={INPUT}
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-planal-ink-muted">
          Only fill these in if a date is actually printed on the notice — Planal works out the
          standard deadline automatically otherwise, once you confirm.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Discount deadline</label>
            <input
              name="discountDeadline"
              type="date"
              defaultValue={details.discountDeadline ?? ""}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Final deadline</label>
            <input
              name="finalDeadline"
              type="date"
              defaultValue={details.finalDeadline ?? ""}
              className={INPUT}
            />
          </div>
        </div>
      </div>

      {state && "error" in state && <p className="text-sm text-planal-danger-text">{state.error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-planal-border bg-planal-surface p-4">
        <button
          type="submit"
          disabled={pending}
          className="mx-auto block w-full max-w-md rounded-2xl bg-planal-brand px-4 py-3.5 text-center text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Looks right, continue"}
        </button>
      </div>
    </form>
  );
}
