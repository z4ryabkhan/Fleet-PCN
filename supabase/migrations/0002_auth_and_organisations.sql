-- Auth scaffolding: user profiles, organisations (fleet accounts), and
-- memberships (admin/driver roles). RLS enabled from creation, per Part 9
-- rule 6 of PLANAL_MASTER_PLAN.md.
--
-- account_type on public.users captures the individual/fleet choice made at
-- signup (feature list §2.3). A "fleet" user gets an organisation created
-- for them (as admin) the first time they're seen post-confirmation; an
-- "individual" user never gets one. Membership rows are the source of truth
-- for what an organisation a user actually belongs to.

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  account_type text not null check (account_type in ('individual', 'fleet')),
  created_at timestamptz not null default now()
);

alter table users enable row level security;

create policy "users can view their own profile"
  on users for select
  to authenticated
  using (id = auth.uid());

create policy "users can update their own profile"
  on users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

alter table organisations enable row level security;

create table if not exists memberships (
  user_id uuid not null references users(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  role text not null check (role in ('admin', 'driver')),
  created_at timestamptz not null default now(),
  primary key (user_id, organisation_id)
);

alter table memberships enable row level security;

create index if not exists memberships_organisation_id_idx on memberships (organisation_id);

-- Helper functions (security definer) so membership checks in RLS policies
-- don't need self-referential correlated subqueries on `memberships` — the
-- documented Supabase pattern for avoiding recursive-RLS pitfalls on
-- membership/join tables.

create or replace function is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organisation_id = org_id and user_id = auth.uid()
  );
$$;

create or replace function is_org_admin(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organisation_id = org_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create policy "org members can view their organisation"
  on organisations for select
  to authenticated
  using (is_org_member(id));

create policy "members can view their own membership row"
  on memberships for select
  to authenticated
  using (user_id = auth.uid() or is_org_admin(organisation_id));

-- Creates an organisation and makes the calling user its admin, atomically.
-- This is the only way a client can create an organisation or an admin
-- membership row — there is no direct insert policy on either table.
create or replace function create_organisation(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organisations (name, created_by)
  values (org_name, auth.uid())
  returning id into new_org_id;

  insert into memberships (user_id, organisation_id, role)
  values (auth.uid(), new_org_id, 'admin');

  return new_org_id;
end;
$$;

grant execute on function create_organisation(text) to authenticated;

-- Mirrors a new auth.users row into public.users, reading the account type
-- and display name supplied at signup.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, account_type)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'account_type', 'individual')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
