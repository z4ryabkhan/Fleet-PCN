-- Phase 2: vehicles + ownership/authorisation verification.
--
-- Verification model (confirmed with Zaryab, differs from Part 5's literal
-- per-vehicle schema): individuals are verified per vehicle (V5C/insurance/
-- lease document per VRM); fleets are verified once at the organisation
-- level (Companies House + one document, e.g. a fleet insurance schedule,
-- covers every vehicle added under that org) — matching how Part 2.5
-- describes the fleet journey and how real fleet insurance schedules work.
--
-- vehicle_is_verified() is the single source of truth for Part 9 rule 3
-- ("never create case data for a vehicle that hasn't passed verification")
-- and Part 4 rule 1 — Phase 3's case-creation code must gate on this.

alter table organisations
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  add column if not exists verification_method text,
  add column if not exists companies_house_number text,
  add column if not exists verification_doc_ref text,
  add column if not exists verified_at timestamptz;

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  vrm text not null,
  make text,
  colour text,
  tax_status text,
  mot_status text,
  year_of_manufacture int,
  ves_looked_up_at timestamptz,
  owner_type text not null check (owner_type in ('individual', 'organisation')),
  owner_user_id uuid references users(id),
  owner_organisation_id uuid references organisations(id),
  assigned_driver_user_id uuid references users(id),
  ownership_verification_status text not null default 'pending'
    check (ownership_verification_status in ('pending', 'verified', 'rejected')),
  ownership_verification_method text,
  ownership_doc_ref text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  constraint vehicles_owner_matches_type check (
    (owner_type = 'individual' and owner_user_id is not null and owner_organisation_id is null)
    or
    (owner_type = 'organisation' and owner_organisation_id is not null and owner_user_id is null)
  )
);

create unique index if not exists vehicles_individual_vrm_unique
  on vehicles (owner_user_id, vrm) where owner_type = 'individual';

create unique index if not exists vehicles_org_vrm_unique
  on vehicles (owner_organisation_id, vrm) where owner_type = 'organisation';

create index if not exists vehicles_owner_organisation_id_idx
  on vehicles (owner_organisation_id) where owner_organisation_id is not null;

alter table vehicles enable row level security;

create policy "owners and org members can view their vehicles"
  on vehicles for select
  to authenticated
  using (
    (owner_type = 'individual' and owner_user_id = auth.uid())
    or
    (owner_type = 'organisation' and (
      is_org_admin(owner_organisation_id) or assigned_driver_user_id = auth.uid()
    ))
  );

create policy "owners and org admins can add vehicles"
  on vehicles for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      (owner_type = 'individual' and owner_user_id = auth.uid())
      or
      (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
    )
  );

create policy "owners and org admins can update their vehicles"
  on vehicles for update
  to authenticated
  using (
    (owner_type = 'individual' and owner_user_id = auth.uid())
    or
    (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  )
  with check (
    (owner_type = 'individual' and owner_user_id = auth.uid())
    or
    (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

-- Org admins can submit/update their organisation's verification fields.
create policy "org admins can update their organisation"
  on organisations for update
  to authenticated
  using (is_org_admin(id))
  with check (is_org_admin(id));

create or replace function vehicle_is_verified(v_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case v.owner_type
    when 'individual' then v.ownership_verification_status = 'verified'
    when 'organisation' then (
      select o.verification_status = 'verified'
      from organisations o
      where o.id = v.owner_organisation_id
    )
  end
  from vehicles v
  where v.id = v_id;
$$;

revoke execute on function vehicle_is_verified(uuid) from public, anon;
grant execute on function vehicle_is_verified(uuid) to authenticated;

-- Private bucket for ownership/authorisation verification documents
-- (V5C, insurance certificate, fleet insurance schedule, etc.).
insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

create policy "individuals can upload their own verification documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = 'individual'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "individuals can view their own verification documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = 'individual'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "org admins can upload their organisation's verification document"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = 'organisation'
    and is_org_admin(((storage.foldername(name))[2])::uuid)
  );

create policy "org admins can view their organisation's verification document"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = 'organisation'
    and is_org_admin(((storage.foldername(name))[2])::uuid)
  );
