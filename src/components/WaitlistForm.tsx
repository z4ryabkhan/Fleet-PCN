"use client";

import { useState, type FormEvent } from "react";

type AccountType = "fleet" | "individual";
type Status = "idle" | "submitting" | "success" | "error";

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
      <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/40 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-300">You&apos;re on the list.</p>
        <p className="mt-2 text-sm text-emerald-200/80">
          We&apos;ll be in touch directly — no spam, just a short conversation about how you
          currently handle parking and traffic penalty notices.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex rounded-lg border border-white/10 bg-white/5 p-1 text-sm">
        <button
          type="button"
          onClick={() => setAccountType("fleet")}
          className={`flex-1 rounded-md py-2 font-medium transition-colors ${
            accountType === "fleet"
              ? "bg-white text-zinc-900"
              : "text-zinc-300 hover:text-white"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={200}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            placeholder="Jane Smith"
          />
        </div>
        <div className="sm:col-span-1">
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
            placeholder="jane@company.co.uk"
          />
        </div>

        {accountType === "fleet" && (
          <>
            <div className="sm:col-span-1">
              <label htmlFor="company" className="block text-sm font-medium text-zinc-300">
                Company name
              </label>
              <input
                id="company"
                name="company"
                maxLength={200}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                placeholder="Acme Deliveries Ltd"
              />
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="fleetSize" className="block text-sm font-medium text-zinc-300">
                Roughly how many vehicles?
              </label>
              <input
                id="fleetSize"
                name="fleetSize"
                maxLength={50}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. 15"
              />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="phone" className="block text-sm font-medium text-zinc-300">
            Phone <span className="text-zinc-500">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            maxLength={50}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            placeholder="07..."
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="block text-sm font-medium text-zinc-300">
            What&apos;s frustrating about handling PCNs today?{" "}
            <span className="text-zinc-500">(optional)</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            placeholder="Tell us how you currently catch and manage tickets"
          />
        </div>
      </div>

      {status === "error" && (
        <p className="text-sm text-red-400">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-md bg-emerald-500 px-4 py-3 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting..." : "Join the waitlist"}
      </button>

      <p className="text-xs text-zinc-500">
        We&apos;ll only use these details to contact you about Planal. See our{" "}
        <a href="/privacy" className="underline hover:text-zinc-300">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
