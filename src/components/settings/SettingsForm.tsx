"use client";

import { useState } from "react";
import { useActionState } from "react";
import { updateNotificationSettingsAction, type SettingsActionState } from "@/app/dashboard/settings/actions";

const initialState: SettingsActionState = undefined;

export function SettingsForm({
  fullName,
  phone,
  smsRemindersEnabled,
}: {
  fullName: string | null;
  phone: string | null;
  smsRemindersEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateNotificationSettingsAction, initialState);
  const [smsEnabled, setSmsEnabled] = useState(smsRemindersEnabled);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-white/10 p-6">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-zinc-300">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={fullName ?? ""}
          maxLength={200}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-zinc-300">
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          placeholder="+44..."
          maxLength={50}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">Used only for SMS deadline reminders, if you enable them below.</p>
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          name="smsRemindersEnabled"
          value="true"
          checked={smsEnabled}
          onChange={(e) => setSmsEnabled(e.target.checked)}
          className="mt-0.5"
        />
        Send me SMS reminders (in addition to email) at T-7, T-2, and T-1 days before each deadline
      </label>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-400">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
