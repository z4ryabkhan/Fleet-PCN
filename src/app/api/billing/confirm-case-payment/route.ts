import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmIndividualCaseAuthorization } from "@/lib/billing";

// Checkout success-redirect confirmation — a legitimate, documented Stripe
// pattern alongside (not instead of) webhook confirmation: verify the
// session's actual state server-side rather than trusting the redirect
// happened at all, then update the same case_charges row the webhook
// would otherwise update. Idempotent (confirmIndividualCaseAuthorization
// only moves a 'pending' row forward) so it's safe if the webhook also
// fires for the same session.
//
// No-win-no-fee (2026-09-24): this session runs in "setup" mode — it
// saves a card, it doesn't charge one — so success here means "card
// authorized," not "paid". The actual charge only happens later, if the
// appeal is marked Won (see chargeCaseOnWin in setOutcomeAction).
//
// This is also what makes the individual flow testable without a live
// webhook endpoint — verified end-to-end with a real Stripe test-mode
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
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });

    const setupIntent = typeof session.setup_intent === "object" ? session.setup_intent : null;
    const paymentMethodId =
      setupIntent && typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : null;

    if (session.status === "complete" && setupIntent && paymentMethodId) {
      const admin = getSupabaseAdminClient();
      await confirmIndividualCaseAuthorization(admin, sessionId, paymentMethodId, setupIntent.id);

      return NextResponse.redirect(`${origin}/dashboard/cases/${caseId}?paid=1`);
    }
  } catch (err) {
    console.error("Failed to confirm case authorization", err);
  }

  return NextResponse.redirect(`${origin}/dashboard/cases/${caseId}?paid=0`);
}
