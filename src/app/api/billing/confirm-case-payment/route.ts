import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Checkout success-redirect confirmation — a legitimate, documented Stripe
// pattern alongside (not instead of) webhook confirmation: verify the
// session's actual payment_status server-side rather than trusting the
// redirect happened at all, then update the same case_charges row the
// webhook would otherwise update. Idempotent (checks status=paid before
// writing) so it's safe if the webhook also fires for the same session.
//
// This is also what makes the individual-payment flow testable without a
// live webhook endpoint — verified end-to-end with a real Stripe test-mode
// Checkout session and the 4242 test card.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const caseId = searchParams.get("case_id");
  const sessionId = searchParams.get("session_id");

  if (!caseId || !sessionId) {
    return NextResponse.redirect(`${origin}/dashboard/cases`);
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.redirect(`${origin}/dashboard/cases/${caseId}?paid=0`);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      const admin = getSupabaseAdminClient();
      await admin
        .from("case_charges")
        .update({ status: "paid" })
        .eq("stripe_checkout_session_id", sessionId)
        .eq("status", "pending");

      return NextResponse.redirect(`${origin}/dashboard/cases/${caseId}?paid=1`);
    }
  } catch (err) {
    console.error("Failed to confirm case payment", err);
  }

  return NextResponse.redirect(`${origin}/dashboard/cases/${caseId}?paid=0`);
}
