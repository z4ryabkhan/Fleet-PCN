import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings — Planal" };

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, phone, sms_reminders_enabled")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <a href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            &larr; Dashboard
          </a>
        </div>

        <div className="mt-8">
          <SettingsForm
            fullName={profile?.full_name ?? null}
            phone={profile?.phone ?? null}
            smsRemindersEnabled={profile?.sms_reminders_enabled ?? false}
          />
        </div>
      </div>
    </main>
  );
}
