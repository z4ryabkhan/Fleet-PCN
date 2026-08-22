"use client";

import { useActionState } from "react";
import { importFleetVehiclesCsvAction, type VehicleActionState } from "@/app/dashboard/vehicles/actions";

const initialState: VehicleActionState = undefined;

export function ImportVehiclesForm() {
  const [state, formAction, pending] = useActionState(importFleetVehiclesCsvAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-medium">Bulk-add vehicles</h2>
      <p className="text-sm text-zinc-400">
        Upload a CSV with one registration number per line (or as the first column).
      </p>

      <input
        name="csv"
        type="file"
        required
        accept=".csv,text/csv"
        className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/20"
      />

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-400">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Importing..." : "Import vehicles"}
      </button>
    </form>
  );
}
