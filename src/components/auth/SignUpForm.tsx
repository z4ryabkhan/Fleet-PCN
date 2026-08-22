"use client";

import { useActionState, useState } from "react";
import { signUpAction, type SignUpState } from "@/app/signup/actions";

const initialState: SignUpState = undefined;

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const [accountType, setAccountType] = useState<"fleet" | "individual">("fleet");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="accountType" value={accountType} />

      <div className="flex rounded-lg border border-white/10 bg-white/5 p-1 text-sm">
        <button
          type="button"
          onClick={() => setAccountType("fleet")}
          className={`flex-1 rounded-md py-2 font-medium transition-colors ${
            accountType === "fleet" ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"
          }`}
        >
          I run a fleet / business
        </button>
        <button
          type="button"
          onClick={() => setAccountType("individual")}
          className={`flex-1 rounded-md py-2 font-medium transition-colors ${
            accountType === "individual"
              ? "bg-white text-zinc-900"
              : "text-zinc-300 hover:text-white"
          }`}
        >
          I&apos;m an individual driver
        </button>
      </div>

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-zinc-300">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          required
          maxLength={200}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {accountType === "fleet" && (
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-zinc-300">
            Company name
          </label>
          <input
            id="companyName"
            name="companyName"
            maxLength={200}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={320}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-emerald-500 px-4 py-3 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="text-xs text-zinc-500">
        Already have an account?{" "}
        <a href="/login" className="underline hover:text-zinc-300">
          Log in
        </a>
        .
      </p>
    </form>
  );
}
