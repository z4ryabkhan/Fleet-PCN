"use client";

import { useActionState, useState } from "react";
import { signUpAction, type SignUpState } from "@/app/signup/actions";

const initialState: SignUpState = undefined;

const LABEL = "block text-sm font-medium text-planal-ink";
const INPUT =
  "mt-1 w-full rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-[15px] text-planal-ink placeholder:text-planal-ink-muted focus:border-planal-brand focus:outline-none focus:ring-2 focus:ring-planal-brand-tint";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const [accountType, setAccountType] = useState<"fleet" | "individual">("fleet");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="accountType" value={accountType} />

      <div className="flex rounded-xl border border-planal-border bg-planal-bg p-1 text-sm">
        <button
          type="button"
          onClick={() => setAccountType("fleet")}
          className={`flex-1 rounded-lg py-2 font-medium transition-colors ${
            accountType === "fleet"
              ? "bg-planal-surface text-planal-ink shadow-sm"
              : "text-planal-ink-muted hover:text-planal-ink"
          }`}
        >
          I run a fleet / business
        </button>
        <button
          type="button"
          onClick={() => setAccountType("individual")}
          className={`flex-1 rounded-lg py-2 font-medium transition-colors ${
            accountType === "individual"
              ? "bg-planal-surface text-planal-ink shadow-sm"
              : "text-planal-ink-muted hover:text-planal-ink"
          }`}
        >
          I&apos;m an individual driver
        </button>
      </div>

      <div>
        <label htmlFor="fullName" className={LABEL}>
          Full name
        </label>
        <input id="fullName" name="fullName" required maxLength={200} className={INPUT} />
      </div>

      {accountType === "fleet" && (
        <div>
          <label htmlFor="companyName" className={LABEL}>
            Company name
          </label>
          <input id="companyName" name="companyName" maxLength={200} className={INPUT} />
        </div>
      )}

      <div>
        <label htmlFor="email" className={LABEL}>
          Email
        </label>
        <input id="email" name="email" type="email" required maxLength={320} className={INPUT} />
      </div>

      <div>
        <label htmlFor="password" className={LABEL}>
          Password
        </label>
        <input id="password" name="password" type="password" required minLength={8} className={INPUT} />
        <p className="mt-1 text-xs text-planal-ink-muted">At least 8 characters.</p>
      </div>

      {state?.error && <p className="text-sm text-planal-danger-text">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-planal-brand px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="text-xs text-planal-ink-muted">
        Already have an account?{" "}
        <a href="/login" className="font-medium text-planal-brand-dark underline">
          Log in
        </a>
        .
      </p>
    </form>
  );
}
