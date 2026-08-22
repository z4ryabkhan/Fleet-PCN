import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Source of truth for payment/subscription confirmation, per Stripe's own
// guidance — never trust the Checkout success redirect alone. Signature
// verification is mandatory: without STRIPE_WEBHOOK_SECRET this endpoint
// refuses everything rather than trusting an unsigned payload.
//
// Untested live — needs STRIPE_WEBHOOK_SECRET, which needs a registered
// webhook endpoint against a real deployed URL (Stripe can't call back to
// localhost). Verified everything upstream of this by completing a real
// test-mode Checkout session in-browser and confirming its state via the
// Stripe API directly.
export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription") {
        await supabase
          .from("billing_accounts")
          .update({
            stripe_subscription_id: session.subscription as string,
            subscription_status: "active",
          })
          .eq("stripe_customer_id", session.customer as string);
      } else if (session.mode === "payment" && session.metadata?.plana_charge_type === "individual_per_case") {
        await supabase
          .from("case_charges")
          .update({ status: "paid" })
          .eq("stripe_checkout_session_id", session.id);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const status = ["active", "past_due", "canceled", "incomplete"].includes(subscription.status)
        ? subscription.status
        : "incomplete";
      await supabase
        .from("billing_accounts")
        .update({ subscription_status: status })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("billing_accounts")
        .update({ subscription_status: "canceled" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
