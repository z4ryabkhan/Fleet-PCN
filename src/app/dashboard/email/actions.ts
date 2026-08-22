"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import { revokeGoogleToken } from "@/lib/google-oauth";

export type EmailActionState = { error: string } | { success: string } | undefined;

// One-click revoke — Part 4 rule 6. For Gmail, revokes the token at
// Google (so it stops working immediately, not just locally) before
// marking the connection row 'revoked' rather than deleting it, so
// there's a durable record of what was ever connected. Microsoft has no
// equivalent single-token revoke endpoint (only an all-sessions nuke that
// needs a much broader admin scope we don't request) — for Outlook,
// revoking locally and no longer using the token is the whole mechanism.
export async function revokeConnectionAction(
  _prevState: EmailActionState,
  formData: FormData
): Promise<EmailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const connectionId = String(formData.get("connectionId") || "");

  const { data: connection } = await supabase
    .from("email_connections")
    .select("provider, encrypted_refresh_token")
    .eq("id", connectionId)
    .single();

  if (!connection) return { error: "Connection not found." };

  if (connection.provider === "gmail") {
    try {
      await revokeGoogleToken(decryptToken(connection.encrypted_refresh_token));
    } catch (err) {
      // Revoking at Google is best-effort — even if it fails (token
      // already invalid, network issue), we still mark the connection
      // revoked locally so it stops being used for scanning.
      console.error("Failed to revoke token at Google", err);
    }
  }

  const { error } = await supabase
    .from("email_connections")
    .update({ status: "revoked" })
    .eq("id", connectionId);

  if (error) return { error: "Could not revoke the connection. Please try again." };

  revalidatePath("/dashboard/email");
  return { success: "Connection revoked." };
}
