"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAccountProvisioned } from "@/lib/account";
import { getOrCreateBillingAccount, createFleetSubscriptionCheckoutSession } from "@/lib/billing";

export type BillingActionState = { error: string } | undefined;

export async function startFleetSubscriptionAction(
  _prevState: BillingActionState,
  _formData: FormData
): Promise<BillingActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { profile, organisation } = await ensureAccountProvisioned(supabase, user);
  if (!organisation || organisation.role !== "admin") {
    return { error: "Only fleet admins can set up billing." };
  }

  const admin = getSupabaseAdminClient();
  const account = await getOrCreateBillingAccount(admin, {
    ownerType: "organisation",
    ownerId: organisation.id,
    email: profile?.email ?? user.email ?? "",
    name: organisation.name,
  });

  if (!account) {
    return { error: "Billing isn't set up yet — the Stripe API key hasn't been configured." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = await createFleetSubscriptionCheckoutSession(
    account.stripeCustomerId,
    `${appUrl}/api/billing/confirm-subscription?session_id={CHECKOUT_SESSION_ID}`,
    `${appUrl}/dashboard/billing?cancelled=1`
  );

  if (!url) {
    return { error: "Could not start checkout. Please try again." };
  }

  redirect(url);
}
