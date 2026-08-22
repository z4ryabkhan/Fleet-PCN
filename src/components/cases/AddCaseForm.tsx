"use client";

import { useActionState } from "react";
import { addManualCaseAction, type CaseActionState } from "@/app/dashboard/cases/actions";

const initialState: CaseActionState = undefined;

export function AddCaseForm({ vehicles }: { vehicles: { id: string; vrm: string }[] }) {
  const [state, formAction, pending] = useActionState(addManualCaseAction, initialState);

  if (vehicles.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 p-6 text-sm text-zinc-400">
        Add a verified vehicle first before uploading a ticket.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-medium">Upload a ticket</h2>

      <div>
        <label htmlFor="vehicleId" className="block text-sm font-medium text-zinc-300">
          Vehicle
        </label>
        <select
          id="vehicleId"
          name="vehicleId"
          required
          defaultValue=""
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="" disabled>
            Choose a vehicle
          </option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vrm}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ticket" className="block text-sm font-medium text-zinc-300">
          Photo or PDF of the ticket
        </label>
        <input
          id="ticket"
          name="ticket"
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
        className="w-full rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload ticket"}
      </button>
    </form>
  );
}
