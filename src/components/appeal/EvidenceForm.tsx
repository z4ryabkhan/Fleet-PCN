"use client";

import { useActionState } from "react";
import { addEvidenceAction, type CaseDetailActionState } from "@/app/dashboard/cases/[caseId]/actions";

const initialState: CaseDetailActionState = undefined;

export function EvidenceForm({ caseId, vehicleId }: { caseId: string; vehicleId: string }) {
  const [state, formAction, pending] = useActionState(addEvidenceAction, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-medium">Add evidence</h2>
      <p className="text-sm text-zinc-400">Photos, receipts, permits, Blue Badge, breakdown documents.</p>

      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <select
        name="evidenceType"
        required
        defaultValue=""
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
      >
        <option value="" disabled>
          Evidence type
        </option>
        <option value="receipt">Receipt</option>
        <option value="permit">Permit</option>
        <option value="blue_badge">Blue Badge</option>
        <option value="breakdown_doc">Breakdown document</option>
        <option value="other">Other</option>
      </select>

      <input
        name="file"
        type="file"
        required
        accept="application/pdf,image/*"
        className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/20"
      />

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-400">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Add evidence"}
      </button>
    </form>
  );
}
