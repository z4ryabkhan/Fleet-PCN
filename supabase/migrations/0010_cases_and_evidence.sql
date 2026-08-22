-- Phase 3: cases + evidence, manual ticket capture.
--
-- Hard gate (Part 9 rule 3 / Part 4 rule 1) enforced at the schema level,
-- not just in application code or RLS: a case cannot be inserted for a
-- vehicle that hasn't passed verification. vehicle_is_verified() is the
-- same function Phase 2 built for exactly this purpose.
--
-- Audit logging is wired in from this same migration (unlike vehicles,
-- fixed retroactively in 0007) — every case insert/update/delete logs to
-- audit_log via a security-definer trigger, matching Part 9 rule 6.
--
-- Function grants are locked down to authenticated (or revoked entirely
-- for trigger-only functions) in the same migration this time, rather
-- than as a follow-up fix — learned from 0003/0004/0008.

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id),
  issuer_name text,
  issuer_type text check (issuer_type in (
    'council_pcn', 'tfl_pcn', 'congestion_charge', 'ulez', 'dart_charge',
    'private_pcn', 'bus_lane', 'moving_traffic'
  )),
  reference_number text,
  contravention_code text,
  location_text text,
  event_datetime timestamptz,
  amount_full numeric(10, 2),
  amount_discounted numeric(10, 2),
  discount_deadline date,
  final_deadline date,
  status text not null default 'new' check (status in (
    'new', 'reviewing', 'appealing', 'paying', 'paid', 'appealed', 'closed'
  )),
  source text not null check (source in ('manual_upload', 'email_auto')),
  raw_ocr_json jsonb,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  constraint cases_vehicle_must_be_verified check (vehicle_is_verified(vehicle_id))
);

create index if not exists cases_vehicle_id_idx on cases (vehicle_id);
create index if not exists cases_final_deadline_idx on cases (final_deadline);

alter table cases enable row level security;

create policy "vehicle owners and org members can view cases"
  on cases for select
  to authenticated
  using (can_view_vehicle(vehicle_id));

-- Drivers can report a ticket on their own assigned vehicle; individual
-- owners and org admins can add a case for any vehicle they control.
-- can_view_vehicle() already covers exactly this set — it includes
-- assigned_driver_user_id, which is the one addition beyond "can edit the
-- vehicle" that this policy needs.
create policy "vehicle owners, admins, and assigned drivers can add cases"
  on cases for insert
  to authenticated
  with check (created_by = auth.uid() and can_view_vehicle(vehicle_id));

create policy "vehicle owners and org admins can update cases"
  on cases for update
  to authenticated
  using (
    exists (
      select 1 from vehicles v
      where v.id = vehicle_id
      and (
        (v.owner_type = 'individual' and v.owner_user_id = auth.uid())
        or
        (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  )
  with check (
    exists (
      select 1 from vehicles v
      where v.id = vehicle_id
      and (
        (v.owner_type = 'individual' and v.owner_user_id = auth.uid())
        or
        (v.owner_type = 'organisation' and is_org_admin(v.owner_organisation_id))
      )
    )
  );

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  file_ref text not null,
  evidence_type text not null check (evidence_type in (
    'ticket_photo', 'ticket_pdf', 'receipt', 'permit', 'blue_badge', 'breakdown_doc', 'other'
  )),
  uploaded_by uuid not null references users(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists evidence_case_id_idx on evidence (case_id);

alter table evidence enable row level security;

create policy "users who can view the case can view its evidence"
  on evidence for select
  to authenticated
  using (exists (select 1 from cases c where c.id = case_id and can_view_vehicle(c.vehicle_id)));

create policy "users who can view the case can add evidence"
  on evidence for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from cases c where c.id = case_id and can_view_vehicle(c.vehicle_id))
  );

create or replace function log_case_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_user_id, vehicle_id, action, metadata)
  values (
    auth.uid(),
    coalesce(new.vehicle_id, old.vehicle_id),
    case tg_op
      when 'INSERT' then 'case_created'
      when 'UPDATE' then 'case_updated'
      when 'DELETE' then 'case_deleted'
    end,
    jsonb_build_object(
      'case_id', coalesce(new.id, old.id),
      'status', coalesce(new.status, old.status),
      'reference_number', coalesce(new.reference_number, old.reference_number)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_case_change() from public, anon, authenticated;

drop trigger if exists on_case_change on cases;
create trigger on_case_change
  after insert or update or delete on cases
  for each row execute function log_case_change();

-- Private bucket for evidence files (ticket photos/PDFs, receipts, etc.),
-- scoped by path prefix "{vehicle_id}/...", reusing can_view_vehicle() —
-- the same visibility rule as the cases/evidence tables themselves.
insert into storage.buckets (id, name, public)
values ('case-evidence', 'case-evidence', false)
on conflict (id) do nothing;

create policy "users who can view the vehicle can upload its evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'case-evidence'
    and can_view_vehicle(((storage.foldername(name))[1])::uuid)
  );

create policy "users who can view the vehicle can view its evidence files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'case-evidence'
    and can_view_vehicle(((storage.foldername(name))[1])::uuid)
  );
