-- Part 2.3's v1 feature list promises "team member invites (admin/driver
-- roles)" — Phase 1 shipped auth and the org/individual split, but no way
-- to actually add a second person to a fleet account ever got built. A
-- fleet account has been permanently single-admin since Phase 1 shipped.
--
-- Design note (read before touching this): the tempting shortcut is to
-- pass {invited_organisation_id, invited_role} as signUp() metadata and
-- have handle_new_user() grant membership from it directly — don't. Auth
-- metadata passed to supabase.auth.signUp()'s `options.data` is entirely
-- client-controlled; a self-signing-up individual could set those fields
-- themselves and grant themselves admin on an arbitrary organisation.
-- pending_invites exists specifically so that what handle_new_user()
-- trusts is the verified new.email column (only ever set by Supabase Auth
-- itself, never by client-supplied metadata), matched against a row an
-- org admin created through invite_org_member() — the only way into this
-- table, gated by is_org_admin() the same way create_organisation() gates
-- org creation in migration 0002.

create table if not exists pending_invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'driver')),
  invited_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists pending_invites_org_email_unique
  on pending_invites (organisation_id, lower(email));

alter table pending_invites enable row level security;

create policy "org admins can view their pending invites"
  on pending_invites for select
  to authenticated
  using (is_org_admin(organisation_id));

-- No insert/update/delete policy for authenticated — invite_org_member()
-- (security definer, below) and handle_new_user() (security definer,
-- redefined below) are the only things that ever touch this table.

-- Creates a membership immediately if invitee_email already belongs to a
-- registered user, otherwise queues a pending_invites row for
-- handle_new_user() to fulfil once they sign up (self-signup or
-- Auth's inviteUserByEmail, both of which insert into auth.users and fire
-- that trigger). Returns 'added' or 'invited' so the caller knows whether
-- it still needs to actually send an invite email.
create or replace function invite_org_member(org_id uuid, invitee_email text, invitee_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_user_id uuid;
  v_normalized_email text := lower(trim(invitee_email));
begin
  if not is_org_admin(org_id) then
    raise exception 'Only an organisation admin can invite members.';
  end if;
  if invitee_role not in ('admin', 'driver') then
    raise exception 'Invalid role.';
  end if;
  if v_normalized_email = '' or v_normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address.';
  end if;

  select id into v_existing_user_id from public.users where lower(email) = v_normalized_email limit 1;

  if v_existing_user_id is not null then
    insert into memberships (user_id, organisation_id, role)
    values (v_existing_user_id, org_id, invitee_role)
    on conflict (user_id, organisation_id) do update set role = excluded.role;
    return 'added';
  else
    insert into pending_invites (organisation_id, email, role, invited_by)
    values (org_id, v_normalized_email, invitee_role, auth.uid())
    on conflict (organisation_id, email) do update
      set role = excluded.role, invited_by = excluded.invited_by, created_at = now();
    return 'invited';
  end if;
end;
$$;

grant execute on function invite_org_member(uuid, text, text) to authenticated;

-- Redefines handle_new_user (originally migration 0002) to also fulfil
-- any pending invite(s) for this email — see the design note above for
-- why this keys off new.email rather than client-suppliable metadata.
-- Deliberately allows more than one org's invite to be consumed at once
-- (unusual but not wrong — the same person genuinely can be a driver at
-- two different fleets).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, account_type)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'account_type', 'individual')
  )
  on conflict (id) do nothing;

  insert into memberships (user_id, organisation_id, role)
  select new.id, pi.organisation_id, pi.role
  from pending_invites pi
  where lower(pi.email) = lower(new.email)
  on conflict (user_id, organisation_id) do nothing;

  delete from pending_invites where lower(email) = lower(new.email);

  return new;
end;
$$;

-- Membership grants and pending-invite creation/consumption are worth
-- seeing in the audit log same as any other access-control change — the
-- existing memberships trigger (0018) already covers inserts done here
-- since it fires on the table regardless of caller, so no new trigger
-- needed for that half. Add one for pending_invites itself.

create or replace function log_pending_invite_change()
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
      when 'INSERT' then 'invite_created'
      when 'DELETE' then 'invite_consumed_or_removed'
    end,
    jsonb_build_object('email', coalesce(new.email, old.email), 'role', coalesce(new.role, old.role))
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_pending_invite_change() from public, anon, authenticated;

drop trigger if exists on_pending_invite_change on pending_invites;
create trigger on_pending_invite_change
  after insert or delete on pending_invites
  for each row execute function log_pending_invite_change();
