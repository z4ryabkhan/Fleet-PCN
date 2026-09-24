-- Build brief section 5/8 Phase 4: "Rental and fleet companies... The
-- system matches each vehicle and date to a hire record, then either
-- transfers liability to the hirer or drafts an appeal." Nothing in the
-- schema records hire periods yet, so a fleet/rental org has no way to
-- route a PCN to the person who actually had the vehicle at the time.
--
-- hire_records is scoped to organisation_id (not just vehicle_id) so RLS
-- can check is_org_admin() directly, matching every other org-owned table.
-- Only org admins can see/add hire records — hirer name/email/address is
-- personal data about someone who has never signed up to Planal, so it
-- gets tighter visibility than vehicles (no assigned-driver read access).
--
-- Matching is a database trigger, not application code, so it runs no
-- matter which path creates the case — the existing email_auto insert in
-- scan-mailboxes, or the new manual "report a ticket" action below — the
-- same reasoning as vehicle_is_verified/enforce_assigned_driver_is_org_member.
-- It only fires on individual vehicles never (they have no hire concept)
-- and re-fires only if vehicle_id or event_datetime change, so a manual
-- needs_review resolution (which only touches route/matched_hire_id) is
-- never clobbered by it. It does NOT retroactively re-route existing cases
-- when a hire record is added later — acceptable for v1, since the
-- realistic order is "log the hire, then the ticket arrives".

create table if not exists hire_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  hirer_name text not null,
  hirer_email text,
  hirer_address text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  agreement_file_path text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  constraint hire_records_end_after_start check (end_at > start_at)
);

create index if not exists hire_records_vehicle_id_idx on hire_records (vehicle_id);
create index if not exists hire_records_organisation_id_idx on hire_records (organisation_id);
create index if not exists hire_records_vehicle_window_idx on hire_records (vehicle_id, start_at, end_at);

alter table hire_records enable row level security;

create policy "org admins can view their organisation's hire records"
  on hire_records for select
  to authenticated
  using (is_org_admin(organisation_id));

create policy "org admins can add hire records"
  on hire_records for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and is_org_admin(organisation_id)
    and exists (
      select 1 from vehicles v
      where v.id = vehicle_id and v.owner_organisation_id = organisation_id
    )
  );

create policy "org admins can update hire records"
  on hire_records for update
  to authenticated
  using (is_org_admin(organisation_id))
  with check (is_org_admin(organisation_id));

create policy "org admins can delete hire records"
  on hire_records for delete
  to authenticated
  using (is_org_admin(organisation_id));

create or replace function log_hire_record_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_user_id, vehicle_id, organisation_id, action, metadata)
  values (
    auth.uid(),
    coalesce(new.vehicle_id, old.vehicle_id),
    coalesce(new.organisation_id, old.organisation_id),
    case tg_op
      when 'INSERT' then 'hire_record_created'
      when 'UPDATE' then 'hire_record_updated'
      when 'DELETE' then 'hire_record_deleted'
    end,
    jsonb_build_object('hire_record_id', coalesce(new.id, old.id), 'hirer_name', coalesce(new.hirer_name, old.hirer_name))
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_hire_record_change() from public, anon, authenticated;

drop trigger if exists on_hire_record_change on hire_records;
create trigger on_hire_record_change
  after insert or update or delete on hire_records
  for each row execute function log_hire_record_change();

alter table cases
  add column if not exists route text check (route in ('appeal', 'transfer_liability', 'pay', 'needs_review')),
  add column if not exists matched_hire_id uuid references hire_records(id) on delete set null;

create or replace function compute_case_route()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_type text;
  v_match_count int;
  v_match_id uuid;
begin
  select owner_type into v_owner_type from vehicles where id = new.vehicle_id;

  -- Transfer-of-liability only exists for fleet/rental vehicles, and only
  -- once there's an event date to match a hire window against.
  if v_owner_type is distinct from 'organisation' or new.event_datetime is null then
    return new;
  end if;

  select count(*), min(id) into v_match_count, v_match_id
  from hire_records
  where vehicle_id = new.vehicle_id
    and new.event_datetime >= start_at
    and new.event_datetime <= end_at;

  if v_match_count = 0 then
    new.route := 'appeal';
    new.matched_hire_id := null;
  elsif v_match_count = 1 then
    new.route := 'transfer_liability';
    new.matched_hire_id := v_match_id;
  else
    new.route := 'needs_review';
    new.matched_hire_id := null;
  end if;

  return new;
end;
$$;

revoke execute on function compute_case_route() from public, anon, authenticated;

drop trigger if exists on_case_route_compute on cases;
create trigger on_case_route_compute
  before insert or update of vehicle_id, event_datetime on cases
  for each row execute function compute_case_route();

-- Private bucket for hire agreement documents, scoped by
-- "{organisation_id}/..." — same shape as verification-documents (0005).
insert into storage.buckets (id, name, public)
values ('hire-agreements', 'hire-agreements', false)
on conflict (id) do nothing;

create policy "org admins can upload their organisation's hire agreements"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'hire-agreements'
    and is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "org admins can view their organisation's hire agreements"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'hire-agreements'
    and is_org_admin(((storage.foldername(name))[1])::uuid)
  );
