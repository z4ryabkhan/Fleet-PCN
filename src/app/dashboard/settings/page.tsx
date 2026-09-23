import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { signOutAction } from "@/app/dashboard/actions";
import { BottomNav } from "@/components/ui/BottomNav";

export const metadata = { title: "Account — Planal" };

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, phone, sms_reminders_enabled")
    .eq("id", user.id)
    .single();

  const links = [
    { href: "/dashboard/vehicles", label: "Vehicles", hint: organisation ? "Verify your fleet and add vehicles." : "Add a vehicle and verify ownership." },
    { href: "/dashboard/email", label: "Connected email", hint: "Send appeals from your own Gmail or Outlook." },
    ...(organisation && organisation.role === "admin"
      ? [
          { href: "/dashboard/team", label: "Team", hint: "Invite admins and drivers to your fleet." },
          { href: "/dashboard/reporting", label: "Reporting", hint: "Monthly summary of tickets and outcomes." },
          { href: "/dashboard/billing", label: "Billing", hint: "Manage your fleet subscription." },
        ]
      : []),
  ];

  return (
    <main className="min-h-full bg-planal-bg pb-28 text-planal-ink">
      <div className="mx-auto max-w-md px-5 pt-10">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Account</h1>
        {organisation && <p className="mt-1 text-sm text-planal-ink-muted">{organisation.name}</p>}

        <ul className="mt-6 space-y-3">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="block rounded-2xl border border-planal-border bg-planal-surface p-4 hover:border-planal-brand"
              >
                <p className="font-semibold">{l.label}</p>
                <p className="mt-0.5 text-sm text-planal-ink-muted">{l.hint}</p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <SettingsForm
            fullName={profile?.full_name ?? null}
            phone={profile?.phone ?? null}
            smsRemindersEnabled={profile?.sms_reminders_enabled ?? false}
          />
        </div>

        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-2xl border border-planal-border px-4 py-3 text-sm font-medium text-planal-ink-muted hover:bg-planal-surface"
          >
            Sign out
          </button>
        </form>
      </div>

      <BottomNav active="account" />
    </main>
  );
}
