"use client";

import { useActionState } from "react";
import { addIndividualVehicleAction, type VehicleActionState } from "@/app/dashboard/vehicles/actions";

const initialState: VehicleActionState = undefined;

export function AddVehicleForm() {
  const [state, formAction, pending] = useActionState(addIndividualVehicleAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-medium">Add a vehicle</h2>

      <div>
        <label htmlFor="vrm" className="block text-sm font-medium text-zinc-300">
          Registration number
        </label>
        <input
          id="vrm"
          name="vrm"
          required
          maxLength={20}
          placeholder="AB12 CDE"
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="documentType" className="block text-sm font-medium text-zinc-300">
          Proof of ownership
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
          <option value="v5c">V5C logbook</option>
          <option value="insurance">Insurance certificate</option>
          <option value="lease">Lease / finance agreement</option>
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
        className="w-full rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add vehicle"}
      </button>
    </form>
  );
}
