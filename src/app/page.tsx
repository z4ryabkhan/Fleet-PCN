import { WaitlistForm } from "@/components/WaitlistForm";
import { CameraIcon, DocumentCheckIcon, SendIcon } from "@/components/ui/icons";
import { getIndividualCasePriceLabel } from "@/lib/billing";

const STEPS = [
  {
    Icon: CameraIcon,
    title: "Snap",
    body: "Photograph the ticket on your phone. No account needed yet.",
  },
  {
    Icon: DocumentCheckIcon,
    title: "Check",
    body: "Confirm the registration, dates, location and amount we read from the photo.",
  },
  {
    Icon: SendIcon,
    title: "Send",
    body: "We draft the appeal for the right issuer. You review it and send it from your own email.",
  },
];

export default async function Home() {
  const priceLabel = await getIndividualCasePriceLabel();

  return (
    <div className="min-h-full bg-planal-bg text-planal-ink">
      <header className="border-b border-planal-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
            Planal
          </span>
          <div className="flex items-center gap-4">
            <a
              href="/login"
              className="flex min-h-11 items-center text-sm font-medium text-planal-ink-muted hover:text-planal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
            >
              Log in
            </a>
            <a
              href="/signup"
              className="flex min-h-11 items-center rounded-xl bg-planal-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
            >
              Create account
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight sm:text-5xl">
          Photograph your parking ticket. We&apos;ll appeal it for you.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-planal-ink-muted">
          See what we read from the ticket and whether it&apos;s worth appealing before you sign
          up for anything. You only create an account and pay when you&apos;re ready to send.
        </p>
        <div className="mt-10 flex justify-center">
          <a
            href="/try"
            className="flex min-h-11 items-center rounded-xl bg-planal-brand px-6 py-3 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
          >
            Check my chances and write my appeal
          </a>
        </div>
      </section>

      <section className="border-y border-planal-border bg-planal-surface">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <ol className="grid gap-8 sm:grid-cols-3">
            {STEPS.map(({ Icon, title, body }, i) => (
              <li key={title} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-planal-brand-tint text-planal-brand-dark">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold">
                  {i + 1}. {title}
                </p>
                <p className="mt-2 text-sm text-planal-ink-muted">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-planal-ink-muted">
            Planal reads the ticket you photograph and drafts an appeal against the real issuer
            &mdash; it doesn&apos;t search for tickets you haven&apos;t been given yet, and it
            never sends anything without you reviewing it first.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center font-[family-name:var(--font-display)] text-2xl font-bold">
          Built for fleets, open to individuals
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-planal-border bg-planal-surface p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-planal-brand-dark">
              Fleets &amp; small businesses
            </p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold">
              £25<span className="text-base font-normal text-planal-ink-muted">/month</span>
            </p>
            <p className="mt-1 text-sm text-planal-ink-muted">covers up to 10 vehicles</p>
            <ul className="mt-4 space-y-2 text-sm text-planal-ink">
              <li>+ £2 per vehicle/month beyond 10</li>
              <li>+ £5 per case processed</li>
              <li>One dashboard across your whole fleet, sorted by deadline</li>
              <li>Driver attribution and recharge</li>
            </ul>
            <p className="mt-4 text-sm text-planal-ink-muted">
              This is a starting hypothesis, not a locked price — tell us what you&apos;d
              actually sign at.
            </p>
          </div>
          <div className="rounded-2xl border border-planal-border bg-planal-surface p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-planal-brand-dark">
              Individual drivers
            </p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold">
              Free<span className="text-base font-normal text-planal-ink-muted"> to check</span>
            </p>
            <p className="mt-1 text-sm text-planal-ink-muted">pay only when you send an appeal</p>
            <ul className="mt-4 space-y-2 text-sm text-planal-ink">
              <li>Free photo capture, chances check, and drafted appeal</li>
              <li>{priceLabel ?? "A small fee"} per case, charged only when you send it</li>
              <li>You always review and confirm before anything is submitted</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="waitlist" className="border-t border-planal-border bg-planal-surface">
        <div className="mx-auto max-w-xl px-6 py-16">
          <h2 className="text-center font-[family-name:var(--font-display)] text-2xl font-bold">
            Running a fleet? Join the waitlist
          </h2>
          <p className="mt-3 text-center text-sm text-planal-ink-muted">
            We&apos;re talking to real fleets before we build the rest. Tell us a little about how
            you handle PCNs today and we&apos;ll be in touch.
          </p>
          <div className="mt-8">
            <WaitlistForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-planal-border">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center text-sm text-planal-ink-muted">
          <p>
            Planal never submits an appeal on your behalf without your explicit confirmation, and
            never claims to find a ticket you haven&apos;t already been notified about.
          </p>
          <p className="mt-2 space-x-4">
            <a href="/privacy" className="underline hover:text-planal-ink">
              Privacy policy
            </a>
            <a href="/terms" className="underline hover:text-planal-ink">
              Terms of Service
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
