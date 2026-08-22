import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getEmailFromIdToken } from "@/lib/google-oauth";
import { encryptToken } from "@/lib/crypto";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/dashboard/email?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !state || !stateCookie) {
    return NextResponse.redirect(`${origin}/dashboard/email?error=missing_state`);
  }

  let parsed: { csrf: string; ownerType: "individual" | "organisation"; ownerId: string };
  try {
    parsed = JSON.parse(stateCookie);
  } catch {
    return NextResponse.redirect(`${origin}/dashboard/email?error=invalid_state`);
  }

  if (parsed.csrf !== state) {
    return NextResponse.redirect(`${origin}/dashboard/email?error=state_mismatch`);
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // Google only returns a refresh_token on first consent (or when
      // prompt=consent forces re-consent, which connect/route.ts always
      // sets) — if it's still missing here something's wrong upstream,
      // and a connection without one can't be kept alive past the first
      // access token's ~1hr expiry.
      return NextResponse.redirect(`${origin}/dashboard/email?error=no_refresh_token`);
    }

    const emailAddress = tokens.id_token ? getEmailFromIdToken(tokens.id_token) : null;

    const { error: insertError } = await supabase.from("email_connections").insert({
      owner_type: parsed.ownerType,
      owner_user_id: parsed.ownerType === "individual" ? parsed.ownerId : null,
      owner_organisation_id: parsed.ownerType === "organisation" ? parsed.ownerId : null,
      provider: "gmail",
      email_address: emailAddress ?? "unknown",
      encrypted_access_token: encryptToken(tokens.access_token),
      encrypted_refresh_token: encryptToken(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope.split(" "),
      status: "connected",
      created_by: user.id,
    });

    if (insertError) {
      console.error("Failed to store email connection", insertError);
      return NextResponse.redirect(`${origin}/dashboard/email?error=save_failed`);
    }
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    return NextResponse.redirect(`${origin}/dashboard/email?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}/dashboard/email?connected=1`);
}
