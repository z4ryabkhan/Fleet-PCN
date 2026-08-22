import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { signOutAction } from "./actions";

export const metadata = { title: "Dashboard — Planal" };

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { profile, organisation } = await ensureAccountProvisioned(supabase, user);

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 p-6">
          <p className="text-sm text-zinc-400">Account type</p>
          <p className="mt-1 text-lg font-medium capitalize">
            {profile?.account_type ?? "unknown"}
          </p>

          {organisation && (
            <>
              <p className="mt-4 text-sm text-zinc-400">Organisation</p>
              <p className="mt-1 text-lg font-medium">{organisation.name}</p>
              <p className="mt-1 text-sm text-zinc-500 capitalize">Role: {organisation.role}</p>
            </>
          )}
        </div>

        <Link
          href="/dashboard/vehicles"
          className="mt-8 block rounded-xl border border-white/10 p-6 hover:bg-white/5"
        >
          <p className="text-lg font-medium">Vehicles &rarr;</p>
          <p className="mt-1 text-sm text-zinc-400">
            {organisation ? "Verify your fleet and add vehicles." : "Add a vehicle and verify ownership."}
          </p>
        </Link>

        <Link
          href="/dashboard/cases"
          className="mt-4 block rounded-xl border border-white/10 p-6 hover:bg-white/5"
        >
          <p className="text-lg font-medium">Cases &rarr;</p>
          <p className="mt-1 text-sm text-zinc-400">
            Upload a ticket, get an AI appeal assessment, and track deadlines.
          </p>
        </Link>

        <Link
          href="/dashboard/email"
          className="mt-4 block rounded-xl border border-white/10 p-6 hover:bg-white/5"
        >
          <p className="text-lg font-medium">Connected email &rarr;</p>
          <p className="mt-1 text-sm text-zinc-400">
            Connect your inbox so Planal can catch PCN emails automatically.
          </p>
        </Link>
      </div>
    </main>
  );
}
