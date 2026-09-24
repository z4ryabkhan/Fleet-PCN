-- UI review item 1: let a visitor photograph a ticket and see extracted
-- details + an appeal preview BEFORE signing up. Everything before "Send"
-- happens against this staging table, not `cases` — a real case only ever
-- gets created once a real account exists to own it (cases.vehicle_id is
-- NOT NULL and gated by cases_vehicle_must_be_verified, and neither of
-- those should change just to allow a pre-signup preview).
--
-- No RLS policy is defined here on purpose: nobody is authenticated yet
-- when this table is written to, so every read/write against it goes
-- through the service-role client from a server action (src/lib/
-- anonymous-draft.ts), gated purely by knowledge of the random `token` —
-- the same trust model as a magic link. Deny-by-default (RLS enabled, no
-- policy) means the anon/authenticated key can never touch this table
-- directly even if a client somehow got the anon key and a token.
create table if not exists anonymous_drafts (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid(),
  image_storage_path text not null,
  extraction_json jsonb,
  edited_fields_json jsonb,
  ai_strength_rating text check (ai_strength_rating in ('weak', 'moderate', 'strong')),
  ai_grounds_json jsonb,
  ai_reasoning_text text,
  draft_text text,
  claimed_at timestamptz,
  claimed_by uuid references users(id),
  created_at timestamptz not null default now(),
  -- 24h is generous for "photographed a ticket, came back later to sign
  -- up" while keeping the storage bucket from accumulating indefinitely;
  -- actual deletion of expired rows/files is a follow-up (no cron job
  -- for it yet), this column just marks what's safe to sweep.
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create unique index if not exists anonymous_drafts_token_unique on anonymous_drafts (token);

alter table anonymous_drafts enable row level security;

-- Coarse per-IP throttle on the one thing an anonymous page can do that
-- costs real money and could otherwise be hit in a loop with no
-- authentication gate at all: triggering a Claude vision extraction.
-- Storing a salted hash rather than the raw IP — this is a rate-limit
-- counter, not something that needs to identify anyone afterwards.
create table if not exists anonymous_extraction_usage (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists anonymous_extraction_usage_ip_hash_idx on anonymous_extraction_usage (ip_hash, created_at);

alter table anonymous_extraction_usage enable row level security;
