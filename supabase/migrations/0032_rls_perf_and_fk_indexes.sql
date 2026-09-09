-- QA/security pass: fixes every finding from Supabase's own performance
-- advisor (`get_advisors`, run against the live project) that's safe to
-- fix mechanically, ahead of a real fleet pilot putting real row counts
-- through these tables. Nothing here changes who can see or write what —
-- every USING/WITH CHECK expression below is byte-for-byte the same
-- logic as before, just with each bare auth.uid() wrapped as
-- (select auth.uid()).
--
-- Why that wrapping matters: Postgres treats a bare auth.uid() call in an
-- RLS policy as needing re-evaluation for every row a query touches,
-- since it can't prove the function is the same across rows without help.
-- Wrapping it in a scalar subquery lets the planner evaluate it once per
-- query and reuse the result — Supabase's own documented fix
-- (advisor lint 0003, auth_rls_initplan) for exactly this pattern. At
-- today's near-zero row counts this is invisible; it stops being
-- invisible the moment a real fleet's vehicles/cases tables have
-- thousands of rows and every dashboard load runs one of these policies
-- per row.
--
-- Verified before writing this: create_organisation() and
-- invite_org_member() (the two SECURITY DEFINER RPCs an authenticated
-- user could call directly, not just through app UI) both gate correctly
-- — invite_org_member() raises unless is_org_admin(org_id) is true first,
-- create_organisation() only ever makes the caller admin of a brand-new
-- org, never an existing one. The advisor's security WARN category
-- (SECURITY DEFINER functions being directly callable) is the same
-- generic, expected flag every RPC in this project already triggers, per
-- migration 0031's own testing notes — not a new finding.

alter policy "owners and org admins can add vehicles"
  on vehicles
  with check (
    (created_by = (select auth.uid()))
    and (
      (owner_type = 'individual' and owner_user_id = (select auth.uid()))
      or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
    )
  );

alter policy "owners and org admins can update their vehicles"
  on vehicles
  using (
    (owner_type = 'individual' and owner_user_id = (select auth.uid()))
    or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  )
  with check (
    (owner_type = 'individual' and owner_user_id = (select auth.uid()))
    or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

alter policy "owners and org members can view their vehicles"
  on vehicles
  using (
    (owner_type = 'individual' and owner_user_id = (select auth.uid()))
    or (
      owner_type = 'organisation'
      and (is_org_admin(owner_organisation_id) or assigned_driver_user_id = (select auth.uid()))
    )
  );

alter policy "members can view their own membership row"
  on memberships
  using (user_id = (select auth.uid()) or is_org_admin(organisation_id));

alter policy "users can update their own profile"
  on users
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "users can view their own profile"
  on users
  using (id = (select auth.uid()));

alter policy "vehicle owners and org admins can update cases"
  on cases
  using (
    exists (
      select 1 from vehicles v
      where v.id = cases.vehicle_id
      and (
        (v.owner_type = 'individual' and v.owner_user_id = (select auth.uid()))
        or (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  )
  with check (
    exists (
      select 1 from vehicles v
      where v.id = cases.vehicle_id
      and (
        (v.owner_type = 'individual' and v.owner_user_id = (select auth.uid()))
        or (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  );

alter policy "vehicle owners, admins, and assigned drivers can add cases"
  on cases
  with check (created_by = (select auth.uid()) and can_view_vehicle(vehicle_id));

alter policy "users who can view the case can add evidence"
  on evidence
  with check (
    uploaded_by = (select auth.uid())
    and exists (select 1 from cases c where c.id = evidence.case_id and can_view_vehicle(c.vehicle_id))
  );

alter policy "owner or org admin can create their billing account"
  on billing_accounts
  with check (
    (owner_type = 'individual' and owner_user_id = (select auth.uid()))
    or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

alter policy "owner or org admin can view their billing account"
  on billing_accounts
  using (
    (owner_type = 'individual' and owner_user_id = (select auth.uid()))
    or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

alter policy "owner or org admin can add email connections"
  on email_connections
  with check (
    created_by = (select auth.uid())
    and (
      (owner_type = 'individual' and owner_user_id = (select auth.uid()))
      or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
    )
  );

alter policy "owner or org admin can update email connections"
  on email_connections
  using (
    (owner_type = 'individual' and owner_user_id = (select auth.uid()))
    or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  )
  with check (
    (owner_type = 'individual' and owner_user_id = (select auth.uid()))
    or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

alter policy "owner or org admin can view email connections"
  on email_connections
  using (
    (owner_type = 'individual' and owner_user_id = (select auth.uid()))
    or (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

alter policy "vehicle owners and org admins can create an appeal"
  on appeals
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from cases c join vehicles v on v.id = c.vehicle_id
      where c.id = appeals.case_id
      and (
        (v.owner_type = 'individual' and v.owner_user_id = (select auth.uid()))
        or (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  );

alter policy "vehicle owners and org admins can update the appeal"
  on appeals
  using (
    exists (
      select 1 from cases c join vehicles v on v.id = c.vehicle_id
      where c.id = appeals.case_id
      and (
        (v.owner_type = 'individual' and v.owner_user_id = (select auth.uid()))
        or (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  )
  with check (
    exists (
      select 1 from cases c join vehicles v on v.id = c.vehicle_id
      where c.id = appeals.case_id
      and (
        (v.owner_type = 'individual' and v.owner_user_id = (select auth.uid()))
        or (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  );

-- Unindexed foreign keys (advisor lint 0001) — all nine flagged.
create index if not exists appeals_created_by_idx on appeals (created_by);
create index if not exists cases_created_by_idx on cases (created_by);
create index if not exists email_connections_created_by_idx on email_connections (created_by);
create index if not exists email_connections_owner_user_id_idx on email_connections (owner_user_id) where owner_user_id is not null;
create index if not exists evidence_uploaded_by_idx on evidence (uploaded_by);
create index if not exists organisations_created_by_idx on organisations (created_by);
create index if not exists pending_invites_invited_by_idx on pending_invites (invited_by);
create index if not exists vehicles_assigned_driver_user_id_idx on vehicles (assigned_driver_user_id) where assigned_driver_user_id is not null;
create index if not exists vehicles_created_by_idx on vehicles (created_by);
