-- Phase 9 compliance pass (continued): special-category evidence flag.
--
-- docs/DPIA.md section 2.2 flagged an open item: the "mitigating
-- circumstances (medical/breakdown)" appeal ground (master plan §2.4)
-- means a user may voluntarily upload evidence containing health
-- information (Article 9 special-category data), but the evidence table
-- had no way to record that this happened or on what legal basis.
--
-- This does not attempt to auto-detect health data in an uploaded file —
-- that would be unreliable and is out of scope. Instead the uploader
-- self-declares it at upload time, and if they do, explicit consent
-- (Article 9(2)(a)) is required in the same step. The CHECK constraint
-- makes "flagged but no consent recorded" impossible at the schema level,
-- not just in application code — same pattern as cases_vehicle_must_be_verified
-- in 0010.

alter table evidence
  add column if not exists may_contain_special_category_data boolean not null default false,
  add column if not exists special_category_consent_at timestamptz;

alter table evidence
  add constraint evidence_special_category_consent_required
  check (not may_contain_special_category_data or special_category_consent_at is not null);

-- Surface the flag in the existing evidence audit trigger (0018) so any
-- upload of self-declared special-category evidence is independently
-- visible in audit_log, not just on the evidence row itself.
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
      'evidence_type', coalesce(new.evidence_type, old.evidence_type),
      'may_contain_special_category_data', coalesce(new.may_contain_special_category_data, old.may_contain_special_category_data, false)
    )
  );
  return coalesce(new, old);
end;
$$;
