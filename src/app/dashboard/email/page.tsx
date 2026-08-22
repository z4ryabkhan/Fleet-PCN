import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { RevokeButton } from "@/components/email/RevokeButton";

export const metadata = { title: "Connected email — Planal" };

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Gmail connection isn't set up yet — the Google OAuth credentials haven't been configured.",
  admin_only: "Only fleet admins can connect the shared mailbox.",
  missing_state: "Something went wrong starting the connection. Please try again.",
  invalid_state: "Something went wrong starting the connection. Please try again.",
  state_mismatch: "Something went wrong starting the connection. Please try again.",
  no_refresh_token: "Google didn't return the access we need. Please try connecting again.",
  save_failed: "Connected to Google, but couldn't save the connection. Please try again.",
  exchange_failed: "Could not complete the connection with Google. Please try again.",
  access_denied: "Connection cancelled.",
};

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { error, connected } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);
  const isAdmin = !organisation || organisation.role === "admin";

  const connectionQuery = organisation
    ? supabase.from("email_connections").select("id, email_address, status, connected_at, last_scanned_at").eq("owner_organisation_id", organisation.id)
    : supabase.from("email_connections").select("id, email_address, status, connected_at, last_scanned_at").eq("owner_user_id", user.id);

  const { data: connections } = await connectionQuery.order("connected_at", { ascending: false });

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Connected email</h1>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            &larr; Dashboard
          </Link>
        </div>

        <p className="mt-3 text-sm text-zinc-400">
          Connect the {organisation ? "shared mailbox(es) your fleet's PCN correspondence lands in" : "inbox you want watched for parking/traffic penalty notices"}.
          Read-only access — Planal never sends, deletes, or modifies anything in your mailbox, and you can revoke access at any time.
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
            {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
          </p>
        )}
        {connected && (
          <p className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">
            Mailbox connected.
          </p>
        )}

        {isAdmin && (
          <a
            href="/api/email/google/connect"
            className="mt-6 inline-block rounded-md bg-emerald-500 px-4 py-2.5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            Connect Gmail
          </a>
        )}

        {!isGoogleOAuthConfigured() && (
          <p className="mt-3 text-xs text-zinc-500">
            Gmail connection isn&apos;t live yet — it&apos;s waiting on Google OAuth credentials.
          </p>
        )}

        <div className="mt-8">
          <h2 className="text-lg font-medium">Connections</h2>
          {!connections || connections.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No mailboxes connected yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {connections.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-white/10 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{c.email_address}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 capitalize">
                      {c.status} · connected {new Date(c.connected_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  {c.status === "connected" && isAdmin && <RevokeButton connectionId={c.id} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
