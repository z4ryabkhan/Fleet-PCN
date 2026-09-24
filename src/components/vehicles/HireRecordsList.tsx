"use client";

import { useActionState } from "react";
import { deleteHireRecordAction, type VehicleActionState } from "@/app/dashboard/vehicles/actions";

const initialState: VehicleActionState = undefined;

type HireRecordRow = {
  id: string;
  vrm: string;
  hirer_name: string;
  start_at: string;
  end_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function DeleteButton({ hireRecordId }: { hireRecordId: string }) {
  const [state, formAction, pending] = useActionState(deleteHireRecordAction, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="hireRecordId" value={hireRecordId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded text-sm text-zinc-400 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state && "error" in state && <p className="mt-1 text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function HireRecordsList({ records }: { records: HireRecordRow[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-zinc-500">No hires logged yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">VRM</th>
            <th className="px-4 py-3 font-medium">Hirer</th>
            <th className="px-4 py-3 font-medium">Window</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3 font-medium">{r.vrm}</td>
              <td className="px-4 py-3 text-zinc-300">{r.hirer_name}</td>
              <td className="px-4 py-3 text-zinc-300">
                {formatDate(r.start_at)} – {formatDate(r.end_at)}
              </td>
              <td className="px-4 py-3">
                <DeleteButton hireRecordId={r.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
