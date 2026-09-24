-- Build brief section 5/8 Phase 2: issuer directory + real email sending.
--
-- issuers is shared reference data (which channel an issuer accepts appeals
-- on, and where) — not scoped to any one user or organisation, so RLS here
-- is read-for-everyone-authenticated rather than the owner-scoped pattern
-- every other table in this schema uses. Deliberately no INSERT/UPDATE
-- policy yet: there's no "Planal admin" role distinct from org-admin
-- anywhere in this schema to gate writes on, so entries are added via a
-- service-role client for now (Zaryab asking Claude to add a
-- source-verified entry) rather than a self-serve admin UI. Revisit once
-- there's more than one person who'd ever add one.
--
-- appeals gets two columns to record what a real send actually did —
-- previously nothing here distinguished "marked appealed, submit it
-- yourself" from "Planal actually sent this", since only the draft-only
-- path existed. sent_to_email is never inferred/guessed at send time; it's
-- always either the user's own typed entry or a value read from a verified
-- issuers row.

create table if not exists issuers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  issuer_type text check (issuer_type in (
    'council_pcn', 'tfl_pcn', 'congestion_charge', 'ulez', 'dart_charge',
    'private_pcn', 'bus_lane', 'moving_traffic'
  )),
  appeal_channel text not null check (appeal_channel in ('email', 'portal', 'post')),
  appeal_email text,
  portal_url text,
  postal_address text,
  source_url text,
  verified_at timestamptz,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists issuers_name_unique on issuers (lower(name));

alter table issuers enable row level security;

create policy "any authenticated user can view the issuer directory"
  on issuers for select
  to authenticated
  using (true);

alter table appeals
  add column if not exists sent_to_email text,
  add column if not exists send_method text check (send_method in ('gmail', 'outlook', 'manual'));
