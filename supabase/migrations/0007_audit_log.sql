-- Retroactive fix: Part 9 rule 6 requires audit-log writes wired into
-- every personal/vehicle-data table as it's created, not bolted on later —
-- vehicles (0005) shipped without it. Fixing that now, before any more
-- personal/vehicle-data tables (cases, evidence, appeals in Phase 3) get
-- built on top of the same gap.
--
-- Postgres has no AFTER SELECT trigger, so this covers writes only (every
-- insert/update to vehicles and organisations' verification fields). Full
-- read-access logging needs an application-layer log call at the point
-- case data is actually displayed — revisit once Phase 3 builds that
-- surface, since that's where real PCN/case data (the sensitive thing
-- Part 4 rule 7 is really about) starts flowing.

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  vehicle_id uuid references vehicles(id) on delete set null,
  organisation_id uuid references organisations(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_vehicle_id_idx on audit_log (vehicle_id);
create index if not exists audit_log_actor_user_id_idx on audit_log (actor_user_id);
create index if not exists audit_log_organisation_id_idx on audit_log (organisation_id);

alter table audit_log enable row level security;

-- Reuses the same visibility rule as the vehicles select policy, so a user
-- can see the audit trail for exactly the vehicles they can already see.
create or replace function can_view_vehicle(v_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from vehicles v
    where v.id = v_id
    and (
      (v.owner_type = 'individual' and v.owner_user_id = auth.uid())
      or
      (v.owner_type = 'organisation' and (
        is_org_admin(v.owner_organisation_id) or v.assigned_driver_user_id = auth.uid()
      ))
    )
  );
$$;

revoke execute on function can_view_vehicle(uuid) from public, anon;
grant execute on function can_view_vehicle(uuid) to authenticated;

create policy "users can view audit log entries for vehicles/orgs they can see"
  on audit_log for select
  to authenticated
  using (
    (vehicle_id is not null and can_view_vehicle(vehicle_id))
    or
    (organisation_id is not null and is_org_admin(organisation_id))
  );

-- No insert/update/delete policy for authenticated — every write happens
-- through the security-definer trigger function below.

create or replace function log_vehicle_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_user_id, vehicle_id, action, metadata)
  values (
    auth.uid(),
    coalesce(new.id, old.id),
    case tg_op
      when 'INSERT' then 'vehicle_created'
      when 'UPDATE' then 'vehicle_updated'
      when 'DELETE' then 'vehicle_deleted'
    end,
    jsonb_build_object(
      'vrm', coalesce(new.vrm, old.vrm),
      'ownership_verification_status', coalesce(new.ownership_verification_status, old.ownership_verification_status)
    )
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_vehicle_change on vehicles;
create trigger on_vehicle_change
  after insert or update or delete on vehicles
  for each row execute function log_vehicle_change();

create or replace function log_organisation_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    insert into audit_log (actor_user_id, organisation_id, action, metadata)
    values (
      auth.uid(),
      new.id,
      'organisation_verification_changed',
      jsonb_build_object(
        'from_status', old.verification_status,
        'to_status', new.verification_status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_organisation_verification_change on organisations;
create trigger on_organisation_verification_change
  after update on organisations
  for each row execute function log_organisation_verification_change();
