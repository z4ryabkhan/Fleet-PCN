"use client";

import { useActionState, useState } from "react";
import { signInWithPasswordAction, sendMagicLinkAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = undefined;

const LABEL = "block text-sm font-medium text-planal-ink";
const INPUT =
  "mt-1 w-full rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-[15px] text-planal-ink placeholder:text-planal-ink-muted focus:border-planal-brand focus:outline-none focus:ring-2 focus:ring-planal-brand-tint";
const PRIMARY_BTN =
  "w-full rounded-2xl bg-planal-brand px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

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
          <label htmlFor="email-magic" className={LABEL}>
            Email
          </label>
          <input id="email-magic" name="email" type="email" required maxLength={320} className={INPUT} />
        </div>

        {magicState?.error && <p className="text-sm text-planal-danger-text">{magicState.error}</p>}

        <button type="submit" disabled={magicPending} className={PRIMARY_BTN}>
          {magicPending ? "Sending..." : "Send magic link"}
        </button>

        <button
          type="button"
          onClick={() => setMode("password")}
          className="w-full text-center text-xs text-planal-ink-muted underline hover:text-planal-ink"
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
        <label htmlFor="email" className={LABEL}>
          Email
        </label>
        <input id="email" name="email" type="email" required maxLength={320} className={INPUT} />
      </div>
      <div>
        <label htmlFor="password" className={LABEL}>
          Password
        </label>
        <input id="password" name="password" type="password" required className={INPUT} />
      </div>

      {passwordState?.error && <p className="text-sm text-planal-danger-text">{passwordState.error}</p>}

      <button type="submit" disabled={passwordPending} className={PRIMARY_BTN}>
        {passwordPending ? "Logging in..." : "Log in"}
      </button>

      <button
        type="button"
        onClick={() => setMode("magic")}
        className="w-full text-center text-xs text-planal-ink-muted underline hover:text-planal-ink"
      >
        Email me a magic link instead
      </button>

      <p className="text-center text-xs text-planal-ink-muted">
        No account yet?{" "}
        <a href="/signup" className="font-medium text-planal-brand-dark underline">
          Sign up
        </a>
        .
      </p>
    </form>
  );
}
