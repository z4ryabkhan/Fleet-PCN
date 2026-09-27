"use client";

import { useActionState } from "react";
import { reportFleetTicketAction, type VehicleActionState } from "@/app/dashboard/vehicles/actions";

const initialState: VehicleActionState = undefined;

const ISSUER_TYPES = [
  { value: "council_pcn", label: "Council PCN" },
  { value: "tfl_pcn", label: "TfL PCN" },
  { value: "congestion_charge", label: "Congestion Charge" },
  { value: "ulez", label: "ULEZ" },
  { value: "dart_charge", label: "Dart Charge" },
  { value: "private_pcn", label: "Private parking operator" },
  { value: "bus_lane", label: "Bus lane" },
  { value: "moving_traffic", label: "Moving traffic" },
];

/** The only way to log a ticket against a fleet vehicle from the dashboard
 * today besides the automatic inbound-email scan — typed in, no OCR. Once
 * saved, compute_case_route() (0043) decides appeal vs transfer_liability
 * vs needs_review exactly as it does for an email-scanned case. */
export function ReportFleetTicketForm({ vehicles }: { vehicles: { id: string; vrm: string }[] }) {
  const [state, formAction, pending] = useActionState(reportFleetTicketAction, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-white/10 p-6">
      <h3 className="text-base font-medium">Report a ticket</h3>
      <p className="text-sm text-zinc-400">
        Received a PCN by post rather than to a connected inbox? Add it here.
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

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm text-zinc-300">
          Issuer name
          <input
            name="issuerName"
            required
            placeholder="e.g. ParkingEye Ltd"
            className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Issuer type
          <select
            name="issuerType"
            defaultValue=""
            className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <option value="">Not sure</option>
            {ISSUER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm text-zinc-300">
        Reference number <span className="text-zinc-500">(optional)</span>
        <input
          name="referenceNumber"
          className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>

      <label className="block text-sm text-zinc-300">
        Date and time of the contravention
        <input
          name="eventDatetime"
          type="datetime-local"
          required
          className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>

      <label className="block text-sm text-zinc-300">
        Location <span className="text-zinc-500">(optional)</span>
        <input
          name="locationText"
          className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>

      <label className="block text-sm text-zinc-300">
        Amount (£) <span className="text-zinc-500">(optional)</span>
        <input
          name="amountFull"
          inputMode="decimal"
          placeholder="70"
          className="mt-1 w-full min-h-11 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-400">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-11 rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Report ticket"}
      </button>
    </form>
  );
}
