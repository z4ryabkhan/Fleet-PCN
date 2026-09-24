"use client";

import { useActionState } from "react";
import { addHireRecordAction, type VehicleActionState } from "@/app/dashboard/vehicles/actions";

const initialState: VehicleActionState = undefined;

/** Build brief Phase 4: logs who had a fleet/rental vehicle and when, so a
 * PCN landing on that vehicle for a date inside this window gets routed to
 * transfer_liability instead of an appeal (compute_case_route(), 0043). */
export function HireRecordForm({ vehicles }: { vehicles: { id: string; vrm: string }[] }) {
  const [state, formAction, pending] = useActionState(addHireRecordAction, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-white/10 p-6">
      <h3 className="text-base font-medium">Log a hire</h3>
      <p className="text-sm text-zinc-400">
        A PCN dated inside this window gets routed to a transfer-of-liability letter naming the hirer, instead of
        an appeal.
      </p>

      <label className="block text-sm text-zinc-300">
        Vehicle
        <select
          name="vehicleId"
          required
          defaultValue=""
          className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
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
      </label>

      <label className="block text-sm text-zinc-300">
        Hirer name
        <input
          name="hirerName"
          required
          className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>

      <label className="block text-sm text-zinc-300">
        Hirer address <span className="text-zinc-500">(goes on the transfer letter)</span>
        <textarea
          name="hirerAddress"
          required
          rows={2}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>

      <label className="block text-sm text-zinc-300">
        Hirer email <span className="text-zinc-500">(optional)</span>
        <input
          name="hirerEmail"
          type="email"
          className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-zinc-300">
          Hire starts
          <input
            name="startAt"
            type="datetime-local"
            required
            className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Hire ends
          <input
            name="endAt"
            type="datetime-local"
            required
            className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
        </label>
      </div>

      <label className="block text-sm text-zinc-300">
        Hire agreement <span className="text-zinc-500">(optional — attached to the transfer letter)</span>
        <input
          name="agreement"
          type="file"
          accept="application/pdf,image/*"
          className="mt-1 w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/20"
        />
      </label>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-400">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-11 rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Log hire"}
      </button>
    </form>
  );
}
