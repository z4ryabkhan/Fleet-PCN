import Stripe from "stripe";

// Billing — Part 3 monetisation, Part 8 Phase 8. Prices are configured in
// Stripe itself (test-mode Products/Prices created directly via the API,
// not hardcoded here) and referenced by ID via env vars, since Part 3
// explicitly calls these "starting hypotheses" to confirm with real fleet
// conversations, not locked numbers — changing a price is a Stripe
// dashboard + env var edit, never a code change.

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export const PRICE_FLEET_PLATFORM = process.env.STRIPE_PRICE_FLEET_PLATFORM;
export const PRICE_FLEET_EXTRA_VEHICLE = process.env.STRIPE_PRICE_FLEET_EXTRA_VEHICLE;
export const PRICE_FLEET_PER_CASE = process.env.STRIPE_PRICE_FLEET_PER_CASE;
export const PRICE_INDIVIDUAL_PER_CASE = process.env.STRIPE_PRICE_INDIVIDUAL_PER_CASE;
