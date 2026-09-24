import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStripeClient,
  PRICE_FLEET_PLATFORM,
  PRICE_FLEET_EXTRA_VEHICLE,
  PRICE_FLEET_PER_CASE,
  PRICE_INDIVIDUAL_PER_CASE,
} from "./stripe";

// A fleet's first 10 vehicles are covered by the platform fee (Part 3);
// beyond that, PRICE_FLEET_EXTRA_VEHICLE bills per vehicle. Duplicated
// here rather than only living in the Part 3 pricing table in the master
// plan — this is the one place in the codebase that actually has to agree
// with that number.
const FLEET_VEHICLES_INCLUDED_IN_PLATFORM_FEE = 10;

type Owner = { ownerType: "individual" | "organisation"; ownerId: string; email: string; name: string };

/** Fetches the existing billing_accounts row, or creates a Stripe Customer
 * and a new row, for the given owner. Uses the service-role client — RLS
 * on billing_accounts has no insert/update path for a service-role-free
 * client by design (see 0017_billing.sql). */
export async function getOrCreateBillingAccount(
  adminSupabase: SupabaseClient,
  owner: Owner
): Promise<{ id: string; stripeCustomerId: string } | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;

  const column = owner.ownerType === "individual" ? "owner_user_id" : "owner_organisation_id";
  const { data: existing } = await adminSupabase
    .from("billing_accounts")
    .select("id, stripe_customer_id")
    .eq(column, owner.ownerId)
    .maybeSingle();

  if (existing) {
    return { id: existing.id, stripeCustomerId: existing.stripe_customer_id };
  }

  const customer = await stripe.customers.create({
    email: owner.email,
    name: owner.name,
    metadata: { plana_owner_type: owner.ownerType, plana_owner_id: owner.ownerId },
  });

  const { data: created, error } = await adminSupabase
    .from("billing_accounts")
    .insert({
      owner_type: owner.ownerType,
      owner_user_id: owner.ownerType === "individual" ? owner.ownerId : null,
      owner_organisation_id: owner.ownerType === "organisation" ? owner.ownerId : null,
      stripe_customer_id: customer.id,
    })
    .select("id, stripe_customer_id")
    .single();

  if (error || !created) {
    console.error("Failed to save billing account", error);
    return null;
  }

  return { id: created.id, stripeCustomerId: created.stripe_customer_id };
}

export async function createFleetSubscriptionCheckoutSession(
  customerId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  const stripe = getStripeClient();
  if (!stripe || !PRICE_FLEET_PLATFORM) return null;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_FLEET_PLATFORM, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session.url;
}

/** No-win-no-fee (Zaryab, 2026-09-24): this used to charge immediately in
 * "payment" mode. It now runs Checkout in "setup" mode — saves a card
 * against the customer without charging it — and records a 'pending'
 * case_charges row that becomes 'authorized' once the SetupIntent
 * completes (see the webhook / confirm-case-payment route). The amount
 * is recorded now purely as the price that WILL be charged if the appeal
 * is later marked Won; nothing is actually taken yet. Creates the
 * Checkout Session and the matching case_charges row together, so the
 * two can never drift out of sync. */
export async function createIndividualCaseCheckoutSession(
  adminSupabase: SupabaseClient,
  customerId: string,
  caseId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  const stripe = getStripeClient();
  if (!stripe || !PRICE_INDIVIDUAL_PER_CASE) return null;

  const price = await stripe.prices.retrieve(PRICE_INDIVIDUAL_PER_CASE);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "setup",
    payment_method_types: ["card"],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { plana_case_id: caseId, plana_charge_type: "individual_per_case" },
  });

  await adminSupabase.from("case_charges").insert({
    case_id: caseId,
    charge_type: "individual_per_case",
    stripe_checkout_session_id: session.id,
    stripe_customer_id: customerId,
    amount_pence: price.unit_amount ?? 0,
    status: "pending",
  });

  return session.url;
}

/** Completes the no-win-no-fee authorization once Checkout's SetupIntent
 * has succeeded — called from both the webhook and the success-redirect
 * confirmation route, same belt-and-braces pattern as the old immediate-
 * payment flow. Idempotent: only ever moves a 'pending' row to
 * 'authorized', so it's safe if both paths fire for the same session. */
export async function confirmIndividualCaseAuthorization(
  adminSupabase: SupabaseClient,
  checkoutSessionId: string,
  paymentMethodId: string,
  setupIntentId: string
): Promise<void> {
  await adminSupabase
    .from("case_charges")
    .update({
      status: "authorized",
      stripe_payment_method_id: paymentMethodId,
      stripe_setup_intent_id: setupIntentId,
    })
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .eq("status", "pending");
}

/** The other half of no-win-no-fee: actually collects payment, but only
 * once — when setOutcomeAction records a Won outcome. Charges the saved
 * payment method off-session (the user isn't present for this). A
 * declined/failed off-session charge is recorded as 'failed' rather than
 * thrown — a card failure shouldn't block recording the case's actual
 * outcome, and is a billing-recovery problem to chase separately, not a
 * reason to make the win/loss record itself unreliable. */
export async function chargeCaseOnWin(adminSupabase: SupabaseClient, caseId: string): Promise<void> {
  const stripe = getStripeClient();
  if (!stripe) return;

  const { data: charge } = await adminSupabase
    .from("case_charges")
    .select("id, amount_pence, stripe_customer_id, stripe_payment_method_id")
    .eq("case_id", caseId)
    .eq("charge_type", "individual_per_case")
    .eq("status", "authorized")
    .maybeSingle();

  if (!charge || !charge.stripe_customer_id || !charge.stripe_payment_method_id) return;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: charge.amount_pence,
      currency: "gbp",
      customer: charge.stripe_customer_id,
      payment_method: charge.stripe_payment_method_id,
      off_session: true,
      confirm: true,
    });
    await adminSupabase
      .from("case_charges")
      .update({ status: "paid", stripe_payment_intent_id: paymentIntent.id })
      .eq("id", charge.id);
  } catch (err) {
    console.error("No-win-no-fee charge-on-win failed", err);
    await adminSupabase.from("case_charges").update({ status: "failed" }).eq("id", charge.id);
  }
}

/** The Lost half of no-win-no-fee: releases the saved card without ever
 * charging it. Detaches the payment method from Stripe too — there's no
 * reason to keep holding a card we've now committed not to charge. */
export async function waiveCaseCharge(adminSupabase: SupabaseClient, caseId: string): Promise<void> {
  const stripe = getStripeClient();

  const { data: charge } = await adminSupabase
    .from("case_charges")
    .select("id, stripe_payment_method_id")
    .eq("case_id", caseId)
    .eq("charge_type", "individual_per_case")
    .eq("status", "authorized")
    .maybeSingle();

  if (!charge) return;

  await adminSupabase.from("case_charges").update({ status: "waived" }).eq("id", charge.id);

  if (stripe && charge.stripe_payment_method_id) {
    try {
      await stripe.paymentMethods.detach(charge.stripe_payment_method_id);
    } catch (err) {
      console.error("Failed to detach waived payment method", err);
    }
  }
}

/** UI review item 5: "price visible on the button" — reads the live Stripe
 * price rather than hardcoding it, so the button never drifts out of sync
 * with what Checkout actually charges. Returns null if Stripe isn't
 * configured; callers should fall back to a generic label in that case. */
export async function getIndividualCasePriceLabel(): Promise<string | null> {
  const stripe = getStripeClient();
  if (!stripe || !PRICE_INDIVIDUAL_PER_CASE) return null;
  const price = await stripe.prices.retrieve(PRICE_INDIVIDUAL_PER_CASE);
  if (price.unit_amount == null) return null;
  return `£${(price.unit_amount / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/** Fleets pay recurring, not gated per-case (Part 2.2 step 6/7) — this
 * queues a £5 line item onto the org's next subscription invoice as a
 * side effect of processing a case, never blocking the assessment itself.
 * Silently no-ops if the org has no active subscription yet — fleet
 * billing setup lagging behind actual usage shouldn't block core product
 * functionality this early. */
export async function addFleetPerCaseCharge(
  adminSupabase: SupabaseClient,
  organisationId: string,
  caseId: string
): Promise<void> {
  const stripe = getStripeClient();
  if (!stripe || !PRICE_FLEET_PER_CASE) return;

  const { data: account } = await adminSupabase
    .from("billing_accounts")
    .select("stripe_customer_id, subscription_status")
    .eq("owner_organisation_id", organisationId)
    .maybeSingle();

  if (!account || account.subscription_status !== "active") return;

  try {
    const price = await stripe.prices.retrieve(PRICE_FLEET_PER_CASE);
    const invoiceItem = await stripe.invoiceItems.create({
      customer: account.stripe_customer_id,
      pricing: { price: PRICE_FLEET_PER_CASE },
    });

    await adminSupabase.from("case_charges").insert({
      case_id: caseId,
      charge_type: "fleet_per_case",
      stripe_invoice_item_id: invoiceItem.id,
      amount_pence: price.unit_amount ?? 0,
      status: "paid", // queued onto the next invoice — see function doc
    });
  } catch (err) {
    console.error("Failed to add fleet per-case charge", err);
  }
}

/** Keeps the "£2/vehicle/month beyond 10" part of Part 3's fleet pricing
 * actually billed — PRICE_FLEET_EXTRA_VEHICLE existed in .env.example and
 * src/lib/stripe.ts since Phase 8 shipped, but nothing ever called it, so
 * a fleet with e.g. 50 vehicles was only ever charged the flat platform
 * fee. Call this after any change to an organisation's vehicle count
 * (currently: only importFleetVehiclesCsvAction — there's no
 * remove-vehicle feature yet to also call it from).
 *
 * Adds a second subscription item at the extra-vehicle price, quantity =
 * vehicles beyond the included 10, and keeps its quantity in sync on
 * later calls rather than creating a duplicate item each time. Silently
 * no-ops if the org has no active subscription yet, same as
 * addFleetPerCaseCharge — importing vehicles ahead of completing billing
 * setup shouldn't block the import itself.
 *
 * UNVERIFIED LIVE: this session had no network access to Stripe's API to
 * exercise this against a real subscription. Quantity 0 on an existing
 * subscription item (the "back under 10 vehicles" case, currently
 * unreachable with no remove-vehicle feature, but worth getting right
 * before one exists) is a standard Stripe pattern for seat-based billing
 * but hasn't been tested here — confirm it behaves as expected in test
 * mode before relying on it. */
export async function syncFleetVehicleCountBilling(
  adminSupabase: SupabaseClient,
  organisationId: string
): Promise<void> {
  const stripe = getStripeClient();
  if (!stripe || !PRICE_FLEET_EXTRA_VEHICLE) return;

  const { data: account } = await adminSupabase
    .from("billing_accounts")
    .select("stripe_subscription_id, subscription_status, stripe_extra_vehicle_item_id")
    .eq("owner_organisation_id", organisationId)
    .maybeSingle();

  if (!account || account.subscription_status !== "active" || !account.stripe_subscription_id) return;

  const { count } = await adminSupabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("owner_organisation_id", organisationId);

  const extraVehicles = Math.max(0, (count ?? 0) - FLEET_VEHICLES_INCLUDED_IN_PLATFORM_FEE);

  try {
    if (account.stripe_extra_vehicle_item_id) {
      await stripe.subscriptionItems.update(account.stripe_extra_vehicle_item_id, {
        quantity: extraVehicles,
        proration_behavior: "create_prorations",
      });
    } else if (extraVehicles > 0) {
      const item = await stripe.subscriptionItems.create({
        subscription: account.stripe_subscription_id,
        price: PRICE_FLEET_EXTRA_VEHICLE,
        quantity: extraVehicles,
        proration_behavior: "create_prorations",
      });
      await adminSupabase
        .from("billing_accounts")
        .update({ stripe_extra_vehicle_item_id: item.id })
        .eq("owner_organisation_id", organisationId);
    }
  } catch (err) {
    console.error("Failed to sync fleet extra-vehicle billing", err);
  }
}
