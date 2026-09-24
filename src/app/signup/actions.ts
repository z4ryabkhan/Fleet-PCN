"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { claimAnonymousDraft } from "@/lib/anonymous-draft";

export type SignUpState = { error: string } | undefined;

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const accountType = formData.get("accountType") === "fleet" ? "fleet" : "individual";
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const companyName = String(formData.get("companyName") || "").trim();
  // UI review item 1: a visitor who tried a ticket before signing up
  // carries this through so the draft becomes a real case the moment they
  // have an account — see src/lib/anonymous-draft.ts.
  const draftToken = String(formData.get("draftToken") || "").trim() || null;

  if (!fullName || !email || !password) {
    return { error: "Please fill in all required fields." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (accountType === "fleet" && !companyName) {
    return { error: "Please enter your company name." };
  }

  const supabase = await getSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const nextPath = draftToken ? `/api/anonymous-draft/claim?token=${draftToken}` : "/dashboard";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        account_type: accountType,
        ...(accountType === "fleet" ? { company_name: companyName } : {}),
      },
      emailRedirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is off for this project, signUp already returns
  // an active session — no point sending them to "check your email" for a
  // link that isn't the gate, and no point routing through the claim
  // *route* either since we already have everything the route would need.
  if (data.session) {
    if (draftToken) {
      const caseId = await claimAnonymousDraft(supabase, draftToken, data.session.user.id);
      redirect(caseId ? `/dashboard/cases/${caseId}` : "/dashboard");
    }
    redirect("/dashboard");
  }

  redirect("/signup/check-email");
}
