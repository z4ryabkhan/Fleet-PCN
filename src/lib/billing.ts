import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStripeClient,
  PRICE_FLEET_PLATFORM,
  PRICE_FLEET_PER_CASE,
  PRICE_INDIVIDUAL_PER_CASE,
} from "./stripe";

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

/** Creates the Checkout Session and the matching 'pending' case_charges
 * row together, so the two can never drift out of sync (e.g. a session
 * created with no charge record to reconcile against later). */
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
    mode: "payment",
    line_items: [{ price: PRICE_INDIVIDUAL_PER_CASE, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { plana_case_id: caseId, plana_charge_type: "individual_per_case" },
  });

  await adminSupabase.from("case_charges").insert({
    case_id: caseId,
    charge_type: "individual_per_case",
    stripe_checkout_session_id: session.id,
    amount_pence: price.unit_amount ?? 0,
    status: "pending",
  });

  return session.url;
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
