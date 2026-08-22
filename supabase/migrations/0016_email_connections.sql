-- Phase 6 (foundation): email_connections — Part 5 data model. Individuals
-- connect their own inbox; fleets connect shared mailbox(es) (plural per
-- Part 2.2 step 3 — a fleet may have more than one shared inbox PCN mail
-- lands in), org-admin only, matching the fleet-admin-owns-connections
-- pattern already used for vehicle verification. Drivers get no visibility
-- into mailbox connections — there's no reason for them to see or manage
-- shared inbox credentials.
--
-- Tokens are stored pre-encrypted by the app (src/lib/crypto.ts, AES-256-GCM)
-- before ever reaching this table — Part 4 rule 6. The DB never sees a
-- plaintext token.
--
-- Audit logging wired in from this same migration.

create table if not exists email_connections (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('individual', 'organisation')),
  owner_user_id uuid references users(id),
  owner_organisation_id uuid references organisations(id),
  provider text not null check (provider in ('gmail', 'outlook')),
  email_address text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  created_by uuid not null references users(id),
  constraint email_connections_owner_matches_type check (
    (owner_type = 'individual' and owner_user_id is not null and owner_organisation_id is null)
    or
    (owner_type = 'organisation' and owner_organisation_id is not null and owner_user_id is null)
  )
);

create index if not exists email_connections_owner_organisation_id_idx
  on email_connections (owner_organisation_id) where owner_organisation_id is not null;

alter table email_connections enable row level security;

create policy "owner or org admin can view email connections"
  on email_connections for select
  to authenticated
  using (
    (owner_type = 'individual' and owner_user_id = auth.uid())
    or
    (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

create policy "owner or org admin can add email connections"
  on email_connections for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      (owner_type = 'individual' and owner_user_id = auth.uid())
      or
      (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
    )
  );

create policy "owner or org admin can update email connections"
  on email_connections for update
  to authenticated
  using (
    (owner_type = 'individual' and owner_user_id = auth.uid())
    or
    (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  )
  with check (
    (owner_type = 'individual' and owner_user_id = auth.uid())
    or
    (owner_type = 'organisation' and is_org_admin(owner_organisation_id))
  );

-- No delete policy — revoking sets status = 'revoked' rather than deleting
-- the row, so there's a durable record of what was ever connected (Part 4
-- rule 7 audit requirements).

create or replace function log_email_connection_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_user_id, organisation_id, action, metadata)
  values (
    auth.uid(),
    coalesce(new.owner_organisation_id, old.owner_organisation_id),
    case tg_op
      when 'INSERT' then 'email_connection_added'
      when 'UPDATE' then 'email_connection_updated'
    end,
    jsonb_build_object(
      'connection_id', coalesce(new.id, old.id),
      'provider', coalesce(new.provider, old.provider),
      'status', coalesce(new.status, old.status)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_email_connection_change() from public, anon, authenticated;

drop trigger if exists on_email_connection_change on email_connections;
create trigger on_email_connection_change
  after insert or update on email_connections
  for each row execute function log_email_connection_change();
