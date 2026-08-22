export const metadata = { title: "Check your email — Planal" };

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-full items-center justify-center bg-zinc-950 px-6 py-16 text-center text-white">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-3 text-sm text-zinc-400">
          We&apos;ve sent a confirmation link to the email address you signed up with. Click it
          to finish setting up your account.
        </p>
      </div>
    </main>
  );
}
