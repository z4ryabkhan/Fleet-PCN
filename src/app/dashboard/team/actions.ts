"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAccountProvisioned } from "@/lib/account";

export type TeamActionState = { error: string } | { success: string } | undefined;

// Authorization happens inside invite_org_member() (is_org_admin(), same
// gate create_organisation() uses) via the authenticated client, not here
// — this action's job is just to also send the actual invite email
// (which needs the admin client; sending mail isn't an authorization
// decision). See migration 0024's header comment for why membership
// grants are never derived from client-suppliable signup metadata.
export async function inviteMemberAction(
  _prevState: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { organisation } = await ensureAccountProvisioned(supabase, user);
  if (!organisation || organisation.role !== "admin") {
    return { error: "Only fleet admins can invite team members." };
  }

  const email = String(formData.get("email") || "").trim();
  const role = String(formData.get("role") || "");

  if (!email) return { error: "Please enter an email address." };
  if (!["admin", "driver"].includes(role)) return { error: "Please choose a role." };

  const { data: result, error } = await supabase.rpc("invite_org_member", {
    org_id: organisation.id,
    invitee_email: email,
    invitee_role: role,
  });

  if (error) {
    return { error: error.message.includes("Invalid email") ? "Please enter a valid email address." : "Could not send the invite. Please try again." };
  }

  if (result === "invited") {
    const admin = getSupabaseAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/confirm`,
    });
    // Not fatal: the membership grant itself doesn't depend on this email
    // actually arriving — the invited person can also just visit the site
    // and sign up normally with this exact email address, which the
    // pending_invites row (already created by the RPC above) will still
    // catch. Surfaced as a softer message rather than a hard error.
    if (inviteError) {
      console.error("Failed to send invite email", inviteError);
      revalidatePath("/dashboard/team");
      return { success: `Invite saved for ${email}, but the invite email couldn't be sent. They can also just sign up at the site with this email address.` };
    }
  }

  revalidatePath("/dashboard/team");
  return {
    success:
      result === "added"
        ? `${email} added to your team.`
        : `Invite sent to ${email}.`,
  };
}
