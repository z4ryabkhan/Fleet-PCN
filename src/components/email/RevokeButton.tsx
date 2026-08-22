"use client";

import { useActionState } from "react";
import { revokeConnectionAction, type EmailActionState } from "@/app/dashboard/email/actions";

const initialState: EmailActionState = undefined;

export function RevokeButton({ connectionId }: { connectionId: string }) {
  const [state, formAction, pending] = useActionState(revokeConnectionAction, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="connectionId" value={connectionId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Revoking..." : "Revoke"}
      </button>
      {state && "error" in state && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  );
}
