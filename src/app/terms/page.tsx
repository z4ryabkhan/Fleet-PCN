export const metadata = {
  title: "Terms of Service — Planal",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <h1 className="text-2xl font-semibold text-white">Terms of Service (draft)</h1>
      <p className="mt-4 text-sm text-zinc-500">
        This is an AI-assisted draft, written to accurately describe what Planal actually does.
        It has not yet been reviewed by a solicitor and is not final. See also our{" "}
        <a href="/privacy" className="underline hover:text-white">
          privacy policy
        </a>
        . Questions:{" "}
        <a href="mailto:info.zaryab@gmail.com" className="underline hover:text-white">
          info.zaryab@gmail.com
        </a>
        .
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">What Planal is</h2>
      <p className="mt-2">
        Planal helps you track parking and traffic penalty notices (PCNs) for your vehicle(s),
        understand payment/appeal deadlines, and — if you choose to pay for it — get an AI
        assessment of whether an appeal is worth attempting, plus a draft you can edit and submit
        yourself. Planal is not a law firm, does not provide legal advice, and does not
        guarantee any outcome for any case.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">What Planal is not, and never does</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          Planal never submits an appeal, payment, or any other action into a council, TfL, or
          private operator&apos;s system on your behalf. You always submit yourself, using the
          text Planal helps you draft, after explicitly confirming you&apos;ve reviewed it.
        </li>
        <li>
          Planal never claims to be able to find a ticket you haven&apos;t already received
          correspondence about — we only process notices you&apos;ve uploaded or that arrived in
          an inbox you&apos;ve chosen to connect.
        </li>
        <li>
          The AI appeal-strength assessment is an informed estimate based on the information you
          and the notice provide, not a guarantee. The relevant tribunal, adjudicator, or issuer
          always makes the final decision.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-medium text-white">Your account</h2>
      <p className="mt-2">
        You must be legally entitled to manage the vehicle(s) you add — either as the registered
        keeper/owner (individual accounts) or as an authorised representative of the business
        that owns or operates the vehicle (fleet accounts). We verify this before any case data
        is processed for a vehicle. You&apos;re responsible for keeping your login credentials
        secure and for the accuracy of information you provide.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Fees and billing</h2>
      <p className="mt-2">
        Free features (case tracking, deadline reminders, manual/email PCN capture) stay free.
        The AI appeal assessment and draft is a paid feature: a one-off per-case fee for
        individuals, or included per-case pricing on top of a recurring platform subscription for
        fleet accounts, billed via Stripe. Prices are shown before you pay. Fees for the AI
        assessment are for generating the assessment/draft itself — we don&apos;t refund based on
        the outcome of an appeal you go on to submit yourself, since Planal doesn&apos;t control
        or guarantee that outcome.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Acceptable use</h2>
      <p className="mt-2">
        Don&apos;t use Planal to add a vehicle you&apos;re not authorised to manage, to attempt to
        access another person&apos;s or organisation&apos;s vehicle or case data, or to misuse
        the connected-email feature beyond its intended read-only, PCN-detection purpose.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Liability</h2>
      <p className="mt-2">
        Planal is provided on a reasonable-efforts basis. To the extent permitted by law, we
        aren&apos;t liable for penalty amounts, fees, or losses arising from decisions you make
        based on Planal&apos;s deadline tracking or AI assessment — you remain responsible for
        reviewing every deadline and every piece of AI-generated content yourself before acting
        on it. Nothing in these terms excludes liability that can&apos;t legally be excluded,
        such as for fraud or death/personal injury caused by negligence.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Ending your account</h2>
      <p className="mt-2">
        You can stop using Planal and ask us to delete your account and data at any time — email
        us and we&apos;ll action it. We may suspend or terminate an account that misuses the
        service or breaches these terms.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Governing law</h2>
      <p className="mt-2">
        These terms are governed by the law of England and Wales, and the courts of England and
        Wales have exclusive jurisdiction over any dispute.
      </p>
    </main>
  );
}
