"use client";

import { useState, type FormEvent } from "react";

type AccountType = "fleet" | "individual";
type Status = "idle" | "submitting" | "success" | "error";

const LABEL = "block text-sm font-medium text-planal-ink";
const INPUT =
  "mt-1 w-full rounded-xl border border-planal-border bg-planal-surface px-3.5 py-2.5 text-[15px] text-planal-ink placeholder:text-planal-ink-muted focus:border-planal-brand focus:outline-none focus:ring-2 focus:ring-planal-brand-tint";

export function WaitlistForm() {
  const [accountType, setAccountType] = useState<AccountType>("fleet");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      accountType,
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      company: String(data.get("company") || ""),
      fleetSize: String(data.get("fleetSize") || ""),
      phone: String(data.get("phone") || ""),
      message: String(data.get("message") || ""),
    };

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMessage(body.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
      form.reset();
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-planal-brand/20 bg-planal-brand-tint p-6 text-center">
        <p className="text-lg font-semibold text-planal-brand-dark">You&apos;re on the list.</p>
        <p className="mt-2 text-sm text-planal-brand-dark/80">
          We&apos;ll be in touch directly — no spam, just a short conversation about how you
          currently handle parking and traffic penalty notices.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="name" className={LABEL}>
            Name
          </label>
          <input id="name" name="name" required maxLength={200} className={INPUT} placeholder="Jane Smith" />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="email" className={LABEL}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={320}
            className={INPUT}
            placeholder="jane@company.co.uk"
          />
        </div>

        {accountType === "fleet" && (
          <>
            <div className="sm:col-span-1">
              <label htmlFor="company" className={LABEL}>
                Company name
              </label>
              <input id="company" name="company" maxLength={200} className={INPUT} placeholder="Acme Deliveries Ltd" />
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="fleetSize" className={LABEL}>
                Roughly how many vehicles?
              </label>
              <input id="fleetSize" name="fleetSize" maxLength={50} className={INPUT} placeholder="e.g. 15" />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="phone" className={LABEL}>
            Phone <span className="text-planal-ink-muted">(optional)</span>
          </label>
          <input id="phone" name="phone" maxLength={50} className={INPUT} placeholder="07..." />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className={LABEL}>
            What&apos;s frustrating about handling PCNs today?{" "}
            <span className="text-planal-ink-muted">(optional)</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            maxLength={2000}
            className={INPUT}
            placeholder="Tell us how you currently catch and manage tickets"
          />
        </div>
      </div>

      {status === "error" && <p className="text-sm text-planal-danger-text">{errorMessage}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-2xl bg-planal-brand px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting..." : "Join the waitlist"}
      </button>

      <p className="text-sm text-planal-ink-muted">
        We&apos;ll only use these details to contact you about Planal. See our{" "}
        <a href="/privacy" className="underline hover:text-planal-ink">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
