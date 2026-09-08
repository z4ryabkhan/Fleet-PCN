"use client";

import { useActionState, useState } from "react";
import {
  updateCaseDetailsAction,
  type CaseDetailActionState,
} from "@/app/dashboard/cases/[caseId]/actions";
import { MarkPaidButton } from "@/components/cases/MarkPaidButton";

const initialState: CaseDetailActionState = undefined;

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

type CaseDetails = {
  issuer_name: string | null;
  issuer_type: string | null;
  reference_number: string | null;
  contravention_code: string | null;
  contravention_description: string | null;
  location_text: string | null;
  amount_full: number | null;
  amount_discounted: number | null;
  discount_deadline: string | null;
  final_deadline: string | null;
  status: string;
};

const FIELD = "text-sm text-zinc-400";
const INPUT =
  "mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";

export function CaseDetailsCard({ caseId, details }: { caseId: string; details: CaseDetails }) {
  const [state, formAction, pending] = useActionState(updateCaseDetailsAction, initialState);
  const [editing, setEditing] = useState(false);

  // Close the edit form only once a save actually succeeds — closing on
  // click would hide a validation error (e.g. "Amounts must be numbers")
  // behind the read-only view, which doesn't render it. Adjusting state
  // during render (React's documented pattern for this, comparing
  // against the last-seen action state) rather than in a useEffect,
  // which would cause an extra render pass for the same result.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && "success" in state) setEditing(false);
  }

  if (editing) {
    return (
      <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-white/10 p-6">
        <input type="hidden" name="caseId" value={caseId} />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Edit case details</h2>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={FIELD}>
            Issuer
            <input name="issuerName" defaultValue={details.issuer_name ?? ""} className={INPUT} />
          </label>
          <label className={FIELD}>
            Issuer type
            <select name="issuerType" defaultValue={details.issuer_type ?? ""} className={INPUT}>
              <option value="">Not sure</option>
              {Object.entries(ISSUER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD}>
            Reference number
            <input name="referenceNumber" defaultValue={details.reference_number ?? ""} className={INPUT} />
          </label>
          <label className={FIELD}>
            Contravention code
            <input name="contraventionCode" defaultValue={details.contravention_code ?? ""} className={INPUT} />
          </label>
          <label className={`${FIELD} sm:col-span-2`}>
            Contravention — what it says on the notice
            <input
              name="contraventionDescription"
              defaultValue={details.contravention_description ?? ""}
              className={INPUT}
            />
          </label>
          <label className={`${FIELD} sm:col-span-2`}>
            Location
            <input name="locationText" defaultValue={details.location_text ?? ""} className={INPUT} />
          </label>
          <label className={FIELD}>
            Full amount (£)
            <input
              name="amountFull"
              type="number"
              step="0.01"
              min="0"
              defaultValue={details.amount_full ?? ""}
              className={INPUT}
            />
          </label>
          <label className={FIELD}>
            Discounted amount (£)
            <input
              name="amountDiscounted"
              type="number"
              step="0.01"
              min="0"
              defaultValue={details.amount_discounted ?? ""}
              className={INPUT}
            />
          </label>
          <label className={FIELD}>
            Discount deadline
            <input
              name="discountDeadline"
              type="date"
              defaultValue={details.discount_deadline ?? ""}
              className={INPUT}
            />
          </label>
          <label className={FIELD}>
            Final deadline
            <input
              name="finalDeadline"
              type="date"
              defaultValue={details.final_deadline ?? ""}
              className={INPUT}
            />
          </label>
        </div>

        {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save details"}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 p-6">
      <div className="flex items-center justify-between">
        <h2 className="sr-only">Case details</h2>
        <div />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-zinc-400 hover:text-white"
        >
          Edit details
        </button>
      </div>
      {state && "success" in state && <p className="mb-3 text-sm text-emerald-400">{state.success}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-zinc-400">Issuer</p>
          <p className="mt-1">{details.issuer_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Reference</p>
          <p className="mt-1">{details.reference_number ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Contravention</p>
          <p className="mt-1">
            {details.contravention_description ?? "—"}
            {details.contravention_code && (
              <span className="text-zinc-500"> (code {details.contravention_code})</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Location</p>
          <p className="mt-1">{details.location_text ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Full amount</p>
          <p className="mt-1">{details.amount_full != null ? `£${details.amount_full}` : "—"}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Discounted amount</p>
          <p className="mt-1">{details.amount_discounted != null ? `£${details.amount_discounted}` : "—"}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Discount deadline</p>
          <p className="mt-1">{details.discount_deadline ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Final deadline</p>
          <p className="mt-1">{details.final_deadline ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Status</p>
          <p className="mt-1 capitalize">{details.status}</p>
          {!["paid", "closed"].includes(details.status) && <MarkPaidButton caseId={caseId} />}
        </div>
      </div>
    </div>
  );
}
