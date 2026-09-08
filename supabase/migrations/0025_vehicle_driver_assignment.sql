-- Completes team invites (0024): vehicles.assigned_driver_user_id has
-- existed since Phase 2 (0005) — it's exactly what the vehicles select
-- policy already uses to give a driver visibility into their own
-- vehicle's cases ("Drivers can report a ticket on their own assigned
-- vehicle", 0010's cases insert policy comment) — but nothing in the app
-- ever set it, so it's been permanently null for every vehicle. Now that
-- 0024 lets an admin actually invite a driver, this is what lets them
-- assign one to a vehicle.
--
-- The vehicles update policy (0005) already lets an org admin update any
-- column on their org's vehicles, including this one — so no RLS change
-- is needed for the assignment itself. What IS needed: nothing currently
-- stops an admin (accidentally, via a wrong ID, or in bad faith) from
-- setting assigned_driver_user_id to a user who isn't even a member of
-- the organisation, and the select policy grants case-visibility purely
-- on assigned_driver_user_id = auth.uid() — so an unvalidated value would
-- hand an unrelated Planal user read access to that vehicle's PCN
-- history. This trigger closes that hole at the schema level, the same
-- pattern as cases_vehicle_must_be_verified (0010) and
-- evidence_special_category_consent_required (0020): a CHECK-shaped
-- invariant enforced in the database, not just trusted from application
-- code.

create or replace function enforce_assigned_driver_is_org_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_driver_user_id is not null then
    if new.owner_type <> 'organisation' then
      raise exception 'assigned_driver_user_id can only be set on an organisation-owned vehicle.';
    end if;
    if not exists (
      select 1 from memberships
      where user_id = new.assigned_driver_user_id
      and organisation_id = new.owner_organisation_id
    ) then
      raise exception 'assigned_driver_user_id must be a member of the vehicle''s organisation.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function enforce_assigned_driver_is_org_member() from public, anon, authenticated;

drop trigger if exists on_vehicle_driver_assignment on vehicles;
create trigger on_vehicle_driver_assignment
  before insert or update on vehicles
  for each row execute function enforce_assigned_driver_is_org_member();
