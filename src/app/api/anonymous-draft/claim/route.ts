import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { claimAnonymousDraft } from "@/lib/anonymous-draft";

// Only reached via /auth/confirm's `next` redirect (see signup/actions.ts)
// on projects where email confirmation is required — by the time this
// runs, verifyOtp has already established a real session, so there's a
// real user id to claim the draft into.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !token) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const caseId = await claimAnonymousDraft(supabase, token, user.id);
  return NextResponse.redirect(`${origin}${caseId ? `/dashboard/cases/${caseId}` : "/dashboard"}`);
}
