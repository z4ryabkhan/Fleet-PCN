-- Supports createGmailDraftAction (src/app/dashboard/cases/[caseId]/actions.ts)
-- — pushing the AI-drafted appeal into the user's own Gmail as a real
-- draft, per Zaryab's explicit request (2026-09-08). No new table: this
-- doesn't create or change any of Planal's own case/appeal data, it only
-- calls Google's API, so there's nothing for a table trigger to hook
-- into the way every other audit_log write in this schema is wired
-- (0007, 0010, 0015–0020, 0024). log_gmail_draft_created() is a small,
-- narrow security-definer function serving the same purpose an
-- audit-trigger normally would, kept in the same "audit writes are
-- always security-definer, never a general insert policy" shape as
-- everything else — not a precedent to open a broad authenticated insert
-- policy on audit_log.

create or replace function log_gmail_draft_created(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id uuid;
begin
  if not exists (select 1 from cases c where c.id = p_case_id and can_view_vehicle(c.vehicle_id)) then
    raise exception 'Not authorized for this case.';
  end if;

  select vehicle_id into v_vehicle_id from cases where id = p_case_id;

  insert into audit_log (actor_user_id, vehicle_id, action, metadata)
  values (auth.uid(), v_vehicle_id, 'gmail_appeal_draft_created', jsonb_build_object('case_id', p_case_id));
end;
$$;

revoke execute on function log_gmail_draft_created(uuid) from public, anon;
grant execute on function log_gmail_draft_created(uuid) to authenticated;
