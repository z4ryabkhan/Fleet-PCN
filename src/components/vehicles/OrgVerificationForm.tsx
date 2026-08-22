"use client";

import { useActionState } from "react";
import { submitOrgVerificationAction, type VehicleActionState } from "@/app/dashboard/vehicles/actions";

const initialState: VehicleActionState = undefined;

export function OrgVerificationForm() {
  const [state, formAction, pending] = useActionState(submitOrgVerificationAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
      <h2 className="text-lg font-medium">Verify your fleet</h2>
      <p className="text-sm text-zinc-400">
        One check covers your whole fleet — every vehicle you add afterwards is covered by this
        verification, so you won&apos;t need to re-upload anything per vehicle.
      </p>

      <div>
        <label htmlFor="companiesHouseNumber" className="block text-sm font-medium text-zinc-300">
          Companies House number
        </label>
        <input
          id="companiesHouseNumber"
          name="companiesHouseNumber"
          required
          maxLength={20}
          placeholder="e.g. 12345678"
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="documentType" className="block text-sm font-medium text-zinc-300">
          Proof the vehicles are the business&apos;s
        </label>
        <select
          id="documentType"
          name="documentType"
          required
          defaultValue=""
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="" disabled>
            Choose a document type
          </option>
          <option value="fleet_insurance_schedule">Fleet insurance schedule</option>
          <option value="lease_agreements">Lease agreements</option>
          <option value="director_attestation">Signed director attestation (owned vehicles)</option>
        </select>
      </div>

      <div>
        <label htmlFor="document" className="block text-sm font-medium text-zinc-300">
          Upload document
        </label>
        <input
          id="document"
          name="document"
          type="file"
          required
          accept="application/pdf,image/*"
          className="mt-1 w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/20"
        />
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-400">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-amber-500 px-4 py-2.5 font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Verify fleet"}
      </button>
    </form>
  );
}
