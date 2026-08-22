import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Log in — Planal" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-full items-center justify-center bg-zinc-950 px-6 py-16 text-white">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-semibold">Log in</h1>
        <div className="mt-8">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
