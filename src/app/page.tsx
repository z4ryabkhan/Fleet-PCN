import { WaitlistForm } from "@/components/WaitlistForm";

export default function Home() {
  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-semibold tracking-tight">Planal</span>
          <a
            href="#waitlist"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
          >
            Join the waitlist
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          By the time you open the post, the discount window is already smaller.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          Parking and traffic penalty notices arrive by post or email, and most people don&apos;t
          see them for days. Planal watches for PCN correspondence the moment it lands, tells you
          in plain English what it means and when it&apos;s due, and — when it&apos;s worth
          fighting — helps you draft an appeal, with you always in control of what actually gets
          sent.
        </p>
        <div className="mt-10 flex justify-center gap-3 text-sm text-zinc-500">
          <span>Built for UK vehicle keepers.</span>
          <span aria-hidden>·</span>
          <span>Fleets first, individual drivers welcome.</span>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold">The problem, honestly</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-3xl font-bold text-emerald-400">~20-26m</p>
              <p className="mt-2 text-sm text-zinc-400">
                PCNs issued across the UK every year, worth roughly £1.76-2.15bn.
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-400">~3.2%</p>
              <p className="mt-2 text-sm text-zinc-400">
                are ever formally appealed — despite appeal success rates of 38-64% depending on
                the tribunal.
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-400">14 / 28</p>
              <p className="mt-2 text-sm text-zinc-400">
                days is all you typically get for the discount window and the escalation
                deadline. Miss it in a pile of post and it&apos;s gone.
              </p>
            </div>
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-zinc-500">
            To be clear about what this is: Planal watches the correspondence that&apos;s already
            been sent to you, by email or post. No UK system — not DVLA, not TfL, not any
            council or private operator — lets you search a registration on demand for tickets
            you haven&apos;t been notified about yet, and Planal doesn&apos;t claim to either.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">Built for fleets, open to individuals</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
              Fleets &amp; small businesses
            </p>
            <p className="mt-3 text-2xl font-bold">
              £25<span className="text-base font-normal text-zinc-400">/month</span>
            </p>
            <p className="mt-1 text-sm text-zinc-400">covers up to 10 vehicles</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li>+ £2 per vehicle/month beyond 10</li>
              <li>+ £5 per case processed</li>
              <li>One dashboard across your whole fleet, sorted by deadline</li>
              <li>Driver attribution and recharge</li>
            </ul>
            <p className="mt-4 text-xs text-zinc-500">
              This is a starting hypothesis, not a locked price — tell us what you&apos;d
              actually sign at.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
              Individual drivers
            </p>
            <p className="mt-3 text-2xl font-bold">Free<span className="text-base font-normal text-zinc-400"> monitoring</span></p>
            <p className="mt-1 text-sm text-zinc-400">pay only if you want appeal support</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li>Free ticket detection, dashboard, deadline reminders</li>
              <li>£9.99–£14.99 per case to unlock AI appeal assessment and a drafted appeal</li>
              <li>You always review and confirm before anything is submitted</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="waitlist" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold">Join the waitlist</h2>
          <p className="mt-3 text-center text-sm text-zinc-400">
            We&apos;re talking to real fleets and drivers before we build the rest. Tell us a
            little about how you handle PCNs today and we&apos;ll be in touch.
          </p>
          <div className="mt-8">
            <WaitlistForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center text-xs text-zinc-500">
          <p>
            Planal never submits an appeal on your behalf without your explicit confirmation, and
            never claims to find a ticket you haven&apos;t already been notified about.
          </p>
          <p className="mt-2 space-x-4">
            <a href="/privacy" className="underline hover:text-zinc-300">
              Privacy policy
            </a>
            <a href="/terms" className="underline hover:text-zinc-300">
              Terms of Service
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
