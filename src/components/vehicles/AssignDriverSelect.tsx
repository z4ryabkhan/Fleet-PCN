"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { assignVehicleDriverAction, type VehicleActionState } from "@/app/dashboard/vehicles/actions";

const initialState: VehicleActionState = undefined;

export function AssignDriverSelect({
  vehicleId,
  currentDriverUserId,
  members,
}: {
  vehicleId: string;
  currentDriverUserId: string | null;
  members: { userId: string; label: string }[];
}) {
  const [state, formAction] = useActionState(assignVehicleDriverAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <select
        name="driverUserId"
        defaultValue={currentDriverUserId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.label}
          </option>
        ))}
      </select>
      {state && "error" in state && <p className="mt-1 text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
