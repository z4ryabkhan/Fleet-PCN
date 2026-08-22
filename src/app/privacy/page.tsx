export const metadata = {
  title: "Privacy Notice — Planal",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <h1 className="text-2xl font-semibold text-white">Privacy notice (pre-launch)</h1>
      <p className="mt-4 text-sm text-zinc-500">
        This is an interim notice covering the waitlist form only, published while Planal is
        still in early validation. It is not yet the solicitor-reviewed privacy policy that
        will govern the full product once it processes vehicle and penalty-notice data — that
        policy will be published, alongside a completed DPIA and ICO registration, before any
        such data is collected.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">What we collect</h2>
      <p className="mt-2">
        If you submit the waitlist form, we collect the name, email address, and any company
        name, fleet size, phone number, or message you choose to provide.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Why we collect it</h2>
      <p className="mt-2">
        Solely to contact you about Planal — to follow up on your interest, ask about your
        current process for handling parking and traffic penalty notices, and let you know
        when the product is ready for you.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Who controls it</h2>
      <p className="mt-2">
        Zaryab Khan is the data controller for this waitlist. Data is stored with Supabase
        (Postgres) and is not shared with any third party or used for any purpose other than
        contacting you about Planal.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">How long we keep it</h2>
      <p className="mt-2">
        Waitlist entries are kept until Planal launches or the validation phase concludes,
        whichever comes first, after which they are deleted unless you&apos;ve become a
        customer or asked to stay in touch.
      </p>

      <h2 className="mt-8 text-lg font-medium text-white">Your rights</h2>
      <p className="mt-2">
        You can ask to see, correct, or delete your waitlist entry at any time by emailing{" "}
        <a href="mailto:info.zaryab@gmail.com" className="underline hover:text-white">
          info.zaryab@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
