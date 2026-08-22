-- Phase 5: AI appeal assessment + drafting, human-in-the-loop confirmation.
--
-- Part 9 rule 2: never auto-submit into a third-party portal — this table
-- and everything built on it only ever gets the user to a reviewed,
-- editable draft and an explicit confirmation click. There is no
-- "submit" action anywhere in this schema or the app that reaches a
-- third-party system; user_confirmed_at means "I will submit this myself,
-- off-platform", nothing more.
--
-- Audit logging wired in from this same migration (unlike vehicles, fixed
-- retroactively in 0007) — every appeal insert/update logs to audit_log.

create table if not exists appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  ai_strength_rating text check (ai_strength_rating in ('weak', 'moderate', 'strong')),
  ai_grounds_json jsonb,
  ai_reasoning_text text,
  draft_text text,
  user_edited_text text,
  user_confirmed_at timestamptz,
  outcome text check (outcome in ('pending', 'won', 'lost')),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists appeals_case_id_unique on appeals (case_id);

alter table appeals enable row level security;

create policy "users who can view the case can view its appeal"
  on appeals for select
  to authenticated
  using (exists (select 1 from cases c where c.id = case_id and can_view_vehicle(c.vehicle_id)));

create policy "vehicle owners and org admins can create an appeal"
  on appeals for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from cases c join vehicles v on v.id = c.vehicle_id
      where c.id = case_id and (
        (v.owner_type = 'individual' and v.owner_user_id = auth.uid())
        or
        (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  );

create policy "vehicle owners and org admins can update the appeal"
  on appeals for update
  to authenticated
  using (
    exists (
      select 1 from cases c join vehicles v on v.id = c.vehicle_id
      where c.id = case_id and (
        (v.owner_type = 'individual' and v.owner_user_id = auth.uid())
        or
        (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  )
  with check (
    exists (
      select 1 from cases c join vehicles v on v.id = c.vehicle_id
      where c.id = case_id and (
        (v.owner_type = 'individual' and v.owner_user_id = auth.uid())
        or
        (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  );

create or replace function log_appeal_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id uuid;
begin
  select vehicle_id into v_vehicle_id from cases where id = coalesce(new.case_id, old.case_id);

  insert into audit_log (actor_user_id, vehicle_id, action, metadata)
  values (
    auth.uid(),
    v_vehicle_id,
    case tg_op
      when 'INSERT' then 'appeal_created'
      when 'UPDATE' then 'appeal_updated'
      when 'DELETE' then 'appeal_deleted'
    end,
    jsonb_build_object(
      'appeal_id', coalesce(new.id, old.id),
      'ai_strength_rating', coalesce(new.ai_strength_rating, old.ai_strength_rating),
      'user_confirmed_at', coalesce(new.user_confirmed_at, old.user_confirmed_at)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_appeal_change() from public, anon, authenticated;

drop trigger if exists on_appeal_change on appeals;
create trigger on_appeal_change
  after insert or update or delete on appeals
  for each row execute function log_appeal_change();
