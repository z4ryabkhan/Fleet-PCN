-- Waitlist signups captured from the Phase 0 validation landing page.
-- First table in the project: RLS is enabled from creation per Part 9 rule 6
-- of PLANAL_MASTER_PLAN.md, not bolted on later.

create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_type text not null check (account_type in ('fleet', 'individual')),
  name text not null,
  email text not null,
  company text,
  fleet_size text,
  phone text,
  message text,
  source text not null default 'landing_page'
);

alter table waitlist_signups enable row level security;

-- Public form submissions may insert their own row. No select/update/delete
-- policy is granted to anon/authenticated, so submitters can never read back
-- anyone else's entry (or their own) — only the service role (used from the
-- API route, and dashboards Zaryab accesses directly) can read the list.
create policy "anyone can submit a waitlist signup"
  on waitlist_signups
  for insert
  to anon, authenticated
  with check (true);
