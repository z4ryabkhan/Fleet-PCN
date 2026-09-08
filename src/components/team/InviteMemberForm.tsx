"use client";

import { useActionState } from "react";
import { inviteMemberAction, type TeamActionState } from "@/app/dashboard/team/actions";

const initialState: TeamActionState = undefined;

export function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-medium">Invite a team member</h2>
      <p className="text-sm text-zinc-400">
        Admins can manage the fleet and billing. Drivers see only their assigned vehicle&apos;s cases.
      </p>

      <input
        name="email"
        type="email"
        required
        placeholder="colleague@example.com"
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
      />

      <select
        name="role"
        required
        defaultValue=""
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
      >
        <option value="" disabled>
          Role
        </option>
        <option value="admin">Admin</option>
        <option value="driver">Driver</option>
      </select>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-400">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send invite"}
      </button>
    </form>
  );
}
