-- Individual per-case pricing moves from "pay upfront to send" to true
-- no-win-no-fee (Zaryab, 2026-09-24): a card is saved (Stripe SetupIntent)
-- at send time but never charged then. The card is only actually charged
-- once an appeal is marked Won; a Lost outcome releases it with nothing
-- charged. This needed two new case_charges states —
-- 'authorized' (card on file, not yet charged) replaces what used to be
-- an immediate 'paid' at send time, and 'waived' (lost — card released,
-- will never be charged) — plus columns to hold the saved payment method
-- and the customer it belongs to, since chargeCaseOnWin() needs both to
-- charge off-session later without the user present.
alter table case_charges
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists stripe_setup_intent_id text,
  add column if not exists stripe_payment_intent_id text;

alter table case_charges drop constraint if exists case_charges_status_check;
alter table case_charges add constraint case_charges_status_check
  check (status in ('pending', 'authorized', 'paid', 'failed', 'waived'));
