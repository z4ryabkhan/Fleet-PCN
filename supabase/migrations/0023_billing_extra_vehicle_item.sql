-- Part 3 monetisation gap found while reviewing Phase 8: the fleet price
-- table promises "£25/month platform minimum (covers up to 10 vehicles) +
-- £2/vehicle/month beyond 10", and STRIPE_PRICE_FLEET_EXTRA_VEHICLE
-- (.env.example, src/lib/stripe.ts) existed to charge for it — but nothing
-- ever actually billed it. A fleet with 50 vehicles was only ever charged
-- the flat platform fee. src/lib/billing.ts's syncFleetVehicleCountBilling
-- fixes this; this column is what lets it find the existing Stripe
-- subscription item to update on a re-sync, rather than creating a new
-- line item (and a duplicate charge) every time a fleet imports more
-- vehicles.

alter table billing_accounts
  add column if not exists stripe_extra_vehicle_item_id text;
