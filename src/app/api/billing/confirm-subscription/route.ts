import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Same success-redirect confirmation pattern as
// /api/billing/confirm-case-payment — a real gap caught while wiring this
// up: without it, a successful fleet subscription checkout would never
// actually flip billing_accounts.subscription_status, since there's no
// live webhook endpoint yet either. Idempotent alongside the webhook.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.redirect(`${origin}/dashboard/billing`);
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.redirect(`${origin}/dashboard/billing?subscribed=0`);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.mode === "subscription" && session.subscription) {
      const admin = getSupabaseAdminClient();
      await admin
        .from("billing_accounts")
        .update({
          stripe_subscription_id: session.subscription as string,
          subscription_status: "active",
        })
        .eq("stripe_customer_id", session.customer as string);

      return NextResponse.redirect(`${origin}/dashboard/billing?subscribed=1`);
    }
  } catch (err) {
    console.error("Failed to confirm subscription", err);
  }

  return NextResponse.redirect(`${origin}/dashboard/billing?subscribed=0`);
}
