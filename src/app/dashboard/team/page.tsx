import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { InviteMemberForm } from "@/components/team/InviteMemberForm";

export const metadata = { title: "Team — Planal" };

type MemberRow = { user_id: string; role: string; users: { email: string; full_name: string | null } | null };
type PendingInviteRow = { id: string; email: string; role: string; created_at: string };

export default async function TeamPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);
  if (!organisation) redirect("/dashboard");
  if (organisation.role !== "admin") redirect("/dashboard");

  const [{ data: members }, { data: pendingInvites }] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, users(email, full_name)")
      .eq("organisation_id", organisation.id)
      .returns<MemberRow[]>(),
    supabase
      .from("pending_invites")
      .select("id, email, role, created_at")
      .eq("organisation_id", organisation.id)
      .order("created_at", { ascending: false })
      .returns<PendingInviteRow[]>(),
  ]);

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Team</h1>
          <a href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            &larr; Dashboard
          </a>
        </div>

        <div className="mt-8">
          <InviteMemberForm />
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-medium">Members</h2>
          <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
            {(members ?? []).map((m) => (
              <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{m.users?.full_name ?? m.users?.email ?? "—"}</p>
                  <p className="text-xs text-zinc-500">{m.users?.email}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs capitalize text-zinc-300">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {pendingInvites && pendingInvites.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-medium">Pending invites</h2>
            <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-zinc-300">{invite.email}</p>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs capitalize text-zinc-400">
                    {invite.role} · invited
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
