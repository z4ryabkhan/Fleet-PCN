import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AccountSnapshot = {
  profile: { id: string; email: string; full_name: string | null; account_type: string } | null;
  organisation: { id: string; name: string; role: string } | null;
};

/**
 * Reads the signed-in user's profile and organisation membership, creating
 * the organisation on first sight for a "fleet" signup that hasn't been
 * provisioned yet (email confirmation happens out-of-band from signup, so
 * this can't run at signup time — it runs the first time we see the user
 * with a session, idempotently).
 */
export async function ensureAccountProvisioned(
  supabase: SupabaseClient,
  user: User
): Promise<AccountSnapshot> {
  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // The handle_new_user trigger runs synchronously on signup, so this
    // should be rare — a moment of replication lag at worst.
    return { profile: null, organisation: null };
  }

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organisation_id, role, organisations(id, name)")
    .eq("user_id", user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    const m = memberships[0] as unknown as {
      role: string;
      organisations: { id: string; name: string } | null;
    };
    return {
      profile,
      organisation: m.organisations
        ? { id: m.organisations.id, name: m.organisations.name, role: m.role }
        : null,
    };
  }

  if (profile.account_type === "fleet") {
    const orgName =
      (user.user_metadata?.company_name as string | undefined)?.trim() ||
      `${profile.full_name ?? "New"}'s Fleet`;

    const { data: newOrgId, error } = await supabase.rpc("create_organisation", {
      org_name: orgName,
    });

    if (!error && newOrgId) {
      return { profile, organisation: { id: newOrgId, name: orgName, role: "admin" } };
    }
  }

  return { profile, organisation: null };
}
