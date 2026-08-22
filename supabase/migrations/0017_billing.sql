-- Phase 8: billing — Part 5 data model, Part 3 monetisation (fleet platform
-- fee + per-vehicle + per-case; individual free monitoring, pay-per-case).
-- Prices themselves live in Stripe (see .env — Part 3 explicitly calls
-- these "starting hypotheses" to confirm via real fleet conversations, not
-- locked numbers, so nothing here hardcodes an amount).
--
-- billing_accounts: one Stripe Customer per owner (individual or
-- organisation), created lazily on first billing-relevant action.
-- case_charges: one row per per-case charge, fleet or individual, tracking
-- whether it actually got paid — this is the thing case-processing gates
-- on for individuals (Part 2.2: "Paid... unlock AI appeal-strength
-- assessment"), and the audit trail for fleet per-case invoice items.
--
-- Audit logging wired in from this same migration.

create table if not exists billing_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('individual', 'organisation')),
  owner_user_id uuid references users(id),
  owner_organisation_id uuid references organisations(id),
  stripe_customer_id text not null,
  stripe_subscription_id text,
  subscription_status text check (subscription_status in ('active', 'past_due', 'canceled', 'incomplete')),
  created_at timestamptz not null default now(),
  constraint billing_accounts_owner_matches_type check (
    (owner_type = 'individual' and owner_user_id is not null and owner_organisation_id is null)
    or
    (owner_type = 'organisation' and owner_organisation_id is not null and owner_user_id is null)
  )
);

create unique index if not exists billing_accounts_owner_user_id_unique
  on billing_accounts (owner_user_id) where owner_user_id is not null;
create unique index if not exists billing_accounts_owner_organisation_id_unique
  on billing_accounts (owner_organisation_id) where owner_organisation_id is not null;

alter table billing_accounts enable row level security;

create policy "owner or org admin can view their billing account"
  on billing_accounts for select
  to authenticated
  using (
    (owner_type = 'individual' and owner_user_id = auth.uid())
    or
    (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

create policy "owner or org admin can create their billing account"
  on billing_accounts for insert
  to authenticated
  with check (
    (owner_type = 'individual' and owner_user_id = auth.uid())
    or
    (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

-- No update policy for authenticated — subscription_status is only ever
-- changed by the Stripe webhook handler, which uses the service role
-- (webhooks are authenticated by Stripe's signature, not a user session).

create table if not exists case_charges (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  charge_type text not null check (charge_type in ('fleet_per_case', 'individual_per_case')),
  stripe_checkout_session_id text,
  stripe_invoice_item_id text,
  amount_pence int not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists case_charges_case_id_idx on case_charges (case_id);

alter table case_charges enable row level security;

create policy "users who can view the case can view its charges"
  on case_charges for select
  to authenticated
  using (exists (select 1 from cases c where c.id = case_id and can_view_vehicle(c.vehicle_id)));

-- No insert/update policy for authenticated — rows are created by the
-- checkout-initiating server action and updated by the webhook handler,
-- both using the service role, so a client can never fabricate a "paid"
-- charge record for itself.

create or replace function log_billing_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_user_id, organisation_id, action, metadata)
  values (
    auth.uid(),
    coalesce(new.owner_organisation_id, old.owner_organisation_id),
    case tg_op
      when 'INSERT' then 'billing_account_created'
      when 'UPDATE' then 'billing_account_updated'
    end,
    jsonb_build_object(
      'billing_account_id', coalesce(new.id, old.id),
      'subscription_status', coalesce(new.subscription_status, old.subscription_status)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_billing_change() from public, anon, authenticated;

drop trigger if exists on_billing_account_change on billing_accounts;
create trigger on_billing_account_change
  after insert or update on billing_accounts
  for each row execute function log_billing_change();

create or replace function log_case_charge_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id uuid;
begin
  select vehicle_id into v_vehicle_id from cases where id = coalesce(new.case_id, old.case_id);

  insert into audit_log (actor_user_id, vehicle_id, action, metadata)
  values (
    auth.uid(),
    v_vehicle_id,
    case tg_op
      when 'INSERT' then 'case_charge_created'
      when 'UPDATE' then 'case_charge_updated'
    end,
    jsonb_build_object(
      'case_charge_id', coalesce(new.id, old.id),
      'status', coalesce(new.status, old.status),
      'amount_pence', coalesce(new.amount_pence, old.amount_pence)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_case_charge_change() from public, anon, authenticated;

drop trigger if exists on_case_charge_change on case_charges;
create trigger on_case_charge_change
  after insert or update on case_charges
  for each row execute function log_case_charge_change();
