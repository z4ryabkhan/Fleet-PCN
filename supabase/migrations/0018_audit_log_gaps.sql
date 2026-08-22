-- Phase 9 compliance pass: two audit-logging gaps found while verifying
-- Part 4 rule 7 ("audit log every access to a vehicle's case data") and
-- Part 9 rule 6 (RLS + audit logging from the first table created).
--
-- 1. `evidence` (uploaded PCN photos/documents, linked to a case's
--    vehicle) had no audit trigger at all — added here.
-- 2. `memberships` (who has admin/driver access to an organisation's
--    fleet) had no audit trigger either — access-control changes are
--    exactly what an audit log exists to capture.
--
-- Also drops the FK from audit_log.actor_user_id to users: discovered
-- while testing that a user who has ever performed any audited action
-- (i.e. every real user) could not have their account deleted without
-- first deleting their own audit history, which would defeat the point
-- of an audit trail and blocks GDPR right-to-erasure account deletion.
-- Same reasoning as the vehicle_id/organisation_id FK removal in 0009 —
-- the audit log must outlive the row (or actor) it describes.

alter table audit_log drop constraint if exists audit_log_actor_user_id_fkey;

create or replace function log_evidence_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id uuid;
begin
  select vehicle_id into v_vehicle_id
  from cases
  where id = coalesce(new.case_id, old.case_id);

  insert into audit_log (actor_user_id, vehicle_id, action, metadata)
  values (
    auth.uid(),
    v_vehicle_id,
    case tg_op
      when 'INSERT' then 'evidence_added'
      when 'UPDATE' then 'evidence_updated'
      when 'DELETE' then 'evidence_deleted'
    end,
    jsonb_build_object(
      'evidence_id', coalesce(new.id, old.id),
      'case_id', coalesce(new.case_id, old.case_id),
      'evidence_type', coalesce(new.evidence_type, old.evidence_type)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_evidence_change() from public, anon, authenticated;

create trigger on_evidence_change
after insert or update or delete on evidence
for each row execute function log_evidence_change();

create or replace function log_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_user_id, organisation_id, action, metadata)
  values (
    auth.uid(),
    coalesce(new.organisation_id, old.organisation_id),
    case tg_op
      when 'INSERT' then 'membership_created'
      when 'UPDATE' then 'membership_updated'
      when 'DELETE' then 'membership_deleted'
    end,
    jsonb_build_object(
      'member_user_id', coalesce(new.user_id, old.user_id),
      'role', coalesce(new.role, old.role)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_membership_change() from public, anon, authenticated;

create trigger on_membership_change
after insert or update or delete on memberships
for each row execute function log_membership_change();
