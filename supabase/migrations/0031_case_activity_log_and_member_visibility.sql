-- Two gaps found while hunting for issues after Phase 9:
--
-- 1. Part 4 rule 7 ("Audit log every access to a vehicle's case data —
--    actor, action, timestamp") is non-negotiable compliance, and writes
--    have been logged since migration 0007 — but nothing has ever logged a
--    READ, and nothing in src/ has ever displayed the audit trail at all.
--    0007's own comment flagged the read-logging gap as "revisit once
--    Phase 3 builds that surface" — Phase 3 shipped the case detail page
--    long ago and this was never revisited. Adding log_case_view() here
--    (called from the case detail page) plus fixing two existing triggers
--    (log_appeal_change, log_case_charge_change) that log case-related
--    writes but never included case_id in their metadata — without it, a
--    per-case activity view can't filter to just that case's own events.
--
-- 2. The `users` table has had exactly one SELECT policy since migration
--    0002: `id = auth.uid()`. Three pages (team, cases, vehicles) join
--    memberships -> users(email, full_name) to show teammate names —
--    every one of them falls back to the raw user_id (Team) or a bare UUID
--    (Cases, Vehicles) for every member except the viewer themselves,
--    because that join's embedded `users` row comes back null once RLS
--    blocks it. This is the entire fleet team-visibility feature (Part
--    2.3: "team member invites, driver attribution") silently not working
--    for anyone except a solo admin looking at their own name.

-- ---- Fix 1a: read-access logging for case views ----

create or replace function log_case_view(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id uuid;
begin
  select vehicle_id into v_vehicle_id from cases where id = p_case_id;
  if v_vehicle_id is null then
    raise exception 'Case not found';
  end if;
  if not can_view_vehicle(v_vehicle_id) then
    raise exception 'Not authorised to view this case';
  end if;

  insert into audit_log (actor_user_id, vehicle_id, action, metadata)
  values (auth.uid(), v_vehicle_id, 'case_viewed', jsonb_build_object('case_id', p_case_id));
end;
$$;

revoke execute on function log_case_view(uuid) from public, anon;
grant execute on function log_case_view(uuid) to authenticated;

-- ---- Fix 1b: backfill case_id into the two case-scoped write triggers that were missing it ----

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
      'case_id', coalesce(new.case_id, old.case_id),
      'ai_strength_rating', coalesce(new.ai_strength_rating, old.ai_strength_rating),
      'user_confirmed_at', coalesce(new.user_confirmed_at, old.user_confirmed_at)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_appeal_change() from public, anon, authenticated;

create or replace function log_case_charge_change()
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
      when 'INSERT' then 'case_charge_created'
      when 'UPDATE' then 'case_charge_updated'
    end,
    jsonb_build_object(
      'case_charge_id', coalesce(new.id, old.id),
      'case_id', coalesce(new.case_id, old.case_id),
      'status', coalesce(new.status, old.status),
      'amount_pence', coalesce(new.amount_pence, old.amount_pence)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_case_charge_change() from public, anon, authenticated;

-- ---- Fix 2: let an org admin resolve fellow members' names/emails ----
--
-- Additive permissive policy — Postgres OR's it with the existing
-- "users can view their own profile" policy, so that one is untouched.
-- Reuses is_org_admin() (0002) rather than re-deriving the same check, and
-- is only as wide as the memberships SELECT policy already is: a driver's
-- own memberships visibility is already limited to their own row (0002's
-- "user_id = auth.uid() or is_org_admin(organisation_id)"), so this can't
-- let a driver see teammates they couldn't already see the membership row
-- for — it only fixes admins actually being able to resolve the names of
-- members they can already see.
create policy "org admins can view fellow members' profiles"
  on users for select
  to authenticated
  using (
    exists (
      select 1 from memberships m
      where m.user_id = users.id
      and is_org_admin(m.organisation_id)
    )
  );
