export const metadata = {
  title: "Privacy Policy — Planal",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <h1 className="text-2xl font-semibold text-white">Privacy policy (draft)</h1>
      <p className="mt-4 text-sm text-zinc-500">
        This policy describes how Planal handles personal data across the full product —
        accounts, vehicles, penalty-notice cases, email monitoring, AI appeal assessment, and
        billing. It is an AI-assisted draft, written to be accurate to what the product actually
        does today. It has not yet been reviewed by a solicitor, and per our own working rules we
        will not process real (non-real) user data at scale, and will not treat this as final,
        until that review is complete. If anything here is unclear or you have questions about
        your data, email{" "}
        <a href="mailto:info.zaryab@gmail.com" className="underline hover:text-white">
          info.zaryab@gmail.com
        </a>
        .
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Who we are</h2>
      <p className="mt-2">
        Zaryab Khan is the data controller for Planal. Planal helps individual motorists and
        vehicle fleets in the UK track parking and traffic penalty notices (PCNs), understand
        deadlines, and — if they choose to pay for it — get an AI assessment and draft of a
        possible appeal. Planal never submits an appeal on your behalf and never claims to be
        able to find a ticket you haven&apos;t already received correspondence about.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">What we collect, and why</h2>

      <h3 className="mt-4 font-medium text-zinc-200">Account details</h3>
      <p className="mt-2">
        Name, email address, and (optionally, for SMS reminders) phone number. Used to run your
        account and contact you about your cases and deadlines.
      </p>

      <h3 className="mt-4 font-medium text-zinc-200">Vehicle and ownership data</h3>
      <p className="mt-2">
        Vehicle registration mark (VRM), and cosmetic details (make, colour, tax/MOT status)
        looked up from the DVLA&apos;s Vehicle Enquiry Service — display only, never treated as
        proof of who owns or keeps the vehicle. Separately, we require a document proving you
        (or your organisation) actually own or are authorised to manage the vehicle — a V5C
        logbook, insurance certificate, or lease/finance agreement (fleets: a fleet insurance
        schedule, lease agreements, or a director attestation, plus a Companies House check on
        the business). No penalty-notice case is created for a vehicle until this verification
        passes — this is a hard technical gate, not just a policy.
      </p>

      <h3 className="mt-4 font-medium text-zinc-200">Penalty notice (case) data</h3>
      <p className="mt-2">
        Issuer, contravention code, location, date/time of the alleged contravention, amounts,
        and deadlines — extracted either from a photo/PDF you upload, or (if you connect your
        email) from PCN-related messages in your inbox. This is inherently a record of where and
        when a specific vehicle was, which is why it&apos;s gated behind the ownership
        verification above — we treat it the way regulators treat identifying location-trail
        data, not the way an anonymous vehicle-history checker treats mechanical facts.
      </p>

      <h3 className="mt-4 font-medium text-zinc-200">Email access (if you connect it)</h3>
      <p className="mt-2">
        Connecting Gmail or Outlook is optional — manual photo/PDF upload always works instead.
        If you connect an inbox, we request read-only access (Gmail: <code>gmail.readonly</code>;
        Microsoft: <code>Mail.Read</code>), scoped to detecting PCN-related mail. Access tokens
        are encrypted at rest and never stored in plain text. You can revoke access at any time
        from your account settings — this immediately deletes the stored tokens.
      </p>

      <h3 className="mt-4 font-medium text-zinc-200">Evidence you upload</h3>
      <p className="mt-2">
        Photos or documents you attach to a case as evidence — receipts, permits, a Blue Badge,
        breakdown documentation, or similar. If you upload something evidencing a medical or
        breakdown-related mitigating circumstance, be aware this may include health information;
        we store it the same way as any other evidence file, used only to support your own
        appeal, and only because you chose to provide it.
      </p>

      <h3 className="mt-4 font-medium text-zinc-200">AI appeal assessment</h3>
      <p className="mt-2">
        If you pay to unlock it (individuals) or your organisation has an active subscription
        (fleets), your case details are sent to Anthropic&apos;s Claude API to generate an appeal
        strength rating, reasoning, and a draft you can edit. This is always a human-reviewed
        assessment, never a fully automated decision — you must explicitly confirm before a case
        is marked as appealed, and Planal never submits anything to a tribunal, adjudicator, or
        issuer on your behalf. Every assessment carries this disclaimer: <em>&quot;This is our
        assessment based on the evidence provided, not a guarantee. The relevant tribunal or
        adjudicator makes the final decision.&quot;</em>
      </p>

      <h3 className="mt-4 font-medium text-zinc-200">Billing</h3>
      <p className="mt-2">
        Payment is handled entirely by Stripe — Planal never sees or stores your card details.
        We keep a record of the charge (amount, status, what it was for) linked to your account
        or organisation.
      </p>

      <h3 className="mt-4 font-medium text-zinc-200">Access/audit log</h3>
      <p className="mt-2">
        We log who accessed or changed a vehicle&apos;s data and when, for security and
        accountability. This log is kept separately from the data it describes, so it isn&apos;t
        automatically deleted when you delete a vehicle, case, or your account.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Who we share data with</h2>
      <p className="mt-2">
        We use a small number of service providers to run Planal, each only for the purpose
        described above: Supabase (database, authentication, file storage), Anthropic (AI
        extraction and appeal assessment), Stripe (payments), Resend (email delivery), Twilio
        (SMS reminders), and Google/Microsoft (only if you connect your email — we read via
        their APIs, they don&apos;t receive an export of your data). We do not sell your data,
        and we do not share it with anyone else, including other Planal customers — a fleet
        admin can only ever see their own organisation&apos;s vehicles and cases, and vice versa.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">How long we keep data</h2>
      <p className="mt-2">
        The raw AI extraction result behind a case (the full OCR output, before it&apos;s copied
        into the case&apos;s own fields) is automatically cleared 90 days after the case is
        created — the structured fields you actually see stay on the case, only the duplicate
        raw copy is removed. Revoking email access deletes the stored access tokens immediately.
        We don&apos;t yet have an automatic deletion window for closed case/evidence data more
        generally — if you&apos;d like your data deleted, email us and we&apos;ll action it
        manually in the meantime.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Your rights</h2>
      <p className="mt-2">
        Under UK GDPR you can ask to access, correct, delete, or export your data, object to or
        restrict certain processing, and withdraw consent (e.g. by revoking email access) at any
        time. Email{" "}
        <a href="mailto:info.zaryab@gmail.com" className="underline hover:text-white">
          info.zaryab@gmail.com
        </a>{" "}
        and we&apos;ll respond within a month. You can also complain to the Information
        Commissioner&apos;s Office (ico.org.uk) if you&apos;re unhappy with how we&apos;ve
        handled your data.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Waitlist entries</h2>
      <p className="mt-2">
        If you signed up to our pre-launch waitlist, see the separate notice covering that data
        specifically: we only use it to follow up about Planal, and delete it once we launch or
        conclude this validation phase, unless you become a customer or ask to stay in touch.
      </p>
    </main>
  );
}
