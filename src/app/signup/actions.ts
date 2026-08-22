"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        account_type: accountType,
        ...(accountType === "fleet" ? { company_name: companyName } : {}),
      },
      emailRedirectTo: `${appUrl}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is off for this project, signUp already returns
  // an active session — no point sending them to "check your email" for a
  // link that isn't the gate. If it's on, there's no session yet and the
  // confirmation email is what continues the flow.
  redirect(data.session ? "/dashboard" : "/signup/check-email");
}
