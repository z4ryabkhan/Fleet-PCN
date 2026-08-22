import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(`${origin}/dashboard/email?error=not_configured`);
  }

  const { profile, organisation } = await ensureAccountProvisioned(supabase, user);
  if (organisation && organisation.role !== "admin") {
    return NextResponse.redirect(`${origin}/dashboard/email?error=admin_only`);
  }

  const csrf = randomBytes(24).toString("base64url");
  const ownerType = organisation ? "organisation" : "individual";
  const ownerId = organisation ? organisation.id : (profile?.id ?? user.id);

  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", JSON.stringify({ csrf, ownerType, ownerId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildGoogleAuthUrl(csrf));
}
