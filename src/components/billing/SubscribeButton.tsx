"use client";

import { useActionState } from "react";
import { startFleetSubscriptionAction, type BillingActionState } from "@/app/dashboard/billing/actions";

const initialState: BillingActionState = undefined;

export function SubscribeButton() {
  const [state, formAction, pending] = useActionState(startFleetSubscriptionAction, initialState);

  return (
    <form action={formAction}>
      {state && "error" in state && (
        <p className="mb-3 text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Redirecting..." : "Set up billing"}
      </button>
    </form>
  );
}
