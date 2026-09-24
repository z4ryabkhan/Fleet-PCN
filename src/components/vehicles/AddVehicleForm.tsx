"use client";

import { useActionState } from "react";
import { addIndividualVehicleAction, type VehicleActionState } from "@/app/dashboard/vehicles/actions";

const initialState: VehicleActionState = undefined;

const LABEL = "block text-sm font-medium text-planal-ink";
const INPUT =
  "mt-1.5 w-full min-h-11 rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-base text-planal-ink placeholder:text-planal-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1";

export function AddVehicleForm() {
  const [state, formAction, pending] = useActionState(addIndividualVehicleAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-planal-border bg-planal-surface p-5">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Add a vehicle</h2>

      <div>
        <label htmlFor="vrm" className={LABEL}>
          Registration number
        </label>
        <input id="vrm" name="vrm" required maxLength={20} placeholder="AB12 CDE" className={INPUT} />
      </div>

      <div>
        <label htmlFor="documentType" className={LABEL}>
          Proof of ownership <span className="text-planal-ink-muted">(optional)</span>
        </label>
        <select id="documentType" name="documentType" defaultValue="" className={INPUT}>
          <option value="">No document to hand right now</option>
          <option value="v5c">V5C logbook</option>
          <option value="insurance">Insurance certificate</option>
          <option value="lease">Lease / finance agreement</option>
        </select>
        <p className="mt-1.5 text-sm text-planal-ink-muted">
          Not required to get started — you can add this later if you want it on file.
        </p>
      </div>

      <div>
        <label htmlFor="document" className={LABEL}>
          Upload document <span className="text-planal-ink-muted">(optional)</span>
        </label>
        <input
          id="document"
          name="document"
          type="file"
          accept="application/pdf,image/*"
          className="mt-1.5 w-full text-sm text-planal-ink-muted file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-planal-brand-tint file:px-3 file:py-2 file:text-sm file:font-medium file:text-planal-brand-dark hover:file:bg-planal-brand-tint-2"
        />
      </div>

      {state && "error" in state && (
        <p className="text-sm text-planal-danger-text" role="alert">
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p className="text-sm text-planal-brand-dark" role="status">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-2xl bg-planal-brand px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        aria-live="polite"
      >
        {pending ? "Saving…" : "Save vehicle"}
      </button>
    </form>
  );
}
