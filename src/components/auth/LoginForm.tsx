"use client";

import { useActionState, useState } from "react";
import { signInWithPasswordAction, sendMagicLinkAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = undefined;

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPasswordAction,
    initialState
  );
  const [magicState, magicAction, magicPending] = useActionState(
    sendMagicLinkAction,
    initialState
  );

  if (mode === "magic") {
    return (
      <form action={magicAction} className="space-y-5">
        <div>
          <label htmlFor="email-magic" className="block text-sm font-medium text-zinc-300">
            Email
          </label>
          <input
            id="email-magic"
            name="email"
            type="email"
            required
            maxLength={320}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {magicState?.error && <p className="text-sm text-red-400">{magicState.error}</p>}

        <button
          type="submit"
          disabled={magicPending}
          className="w-full rounded-md bg-emerald-500 px-4 py-3 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {magicPending ? "Sending..." : "Send magic link"}
        </button>

        <button
          type="button"
          onClick={() => setMode("password")}
          className="w-full text-center text-xs text-zinc-500 underline hover:text-zinc-300"
        >
          Use a password instead
        </button>
      </form>
    );
  }

  return (
    <form action={passwordAction} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
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
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {passwordState?.error && <p className="text-sm text-red-400">{passwordState.error}</p>}

      <button
        type="submit"
        disabled={passwordPending}
        className="w-full rounded-md bg-emerald-500 px-4 py-3 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {passwordPending ? "Logging in..." : "Log in"}
      </button>

      <button
        type="button"
        onClick={() => setMode("magic")}
        className="w-full text-center text-xs text-zinc-500 underline hover:text-zinc-300"
      >
        Email me a magic link instead
      </button>

      <p className="text-xs text-zinc-500 text-center">
        No account yet?{" "}
        <a href="/signup" className="underline hover:text-zinc-300">
          Sign up
        </a>
        .
      </p>
    </form>
  );
}
