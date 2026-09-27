import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata = { title: "Create account — Planal" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft } = await searchParams;

  return (
    <main className="flex min-h-full items-center justify-center bg-planal-bg px-6 py-16 text-planal-ink">
      <div className="w-full max-w-md">
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl font-bold">
          Create your account
        </h1>
        <p className="mt-2 text-center text-base text-planal-ink-muted">
          {draft
            ? "Almost there — create your account and your appeal will be waiting for you."
            : "Fleets get a team dashboard from day one. Individuals get free monitoring."}
        </p>
        <div className="mt-8">
          <SignUpForm draftToken={draft} defaultAccountType={draft ? "individual" : "fleet"} />
        </div>
      </div>
    </main>
  );
}
