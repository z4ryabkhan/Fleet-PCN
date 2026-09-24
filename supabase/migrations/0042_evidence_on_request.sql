-- Evidence-on-request pipeline (Zaryab's spec, 2026-09-24): evidence is
-- never required up front — only once an issuer's reply actually asks for
-- it. This needed three things that didn't exist before:
--
-- 1. Thread/message tracking on send (appeals.sent_message_id/
--    sent_thread_id) — neither sendGmailAppeal nor sendOutlookAppeal
--    persisted what they got back, so there was nothing to check replies
--    against. last_reply_message_id/last_reply_kind/last_reply_summary
--    record what scan-mailboxes' reply-checking pass (added alongside
--    this migration) last found, so the same reply is never reclassified
--    on every 15-minute run.
-- 2. evidence_requests: one row per "the issuer asked for proof" event,
--    created by scan-mailboxes when Claude classifies a reply as
--    evidence_requested. Same RLS shape as case_charges (0017) — read-only
--    for authenticated users via can_view_vehicle(), writes are
--    service-role/admin-client only (the edge function that creates rows,
--    and the server action that marks one fulfilled after the user
--    approves sending evidence).
-- 3. 'evidence_requested' added to cases.status so the case page can show
--    the "the issuer asked for proof" banner and hints for that case's
--    own chosen reason.
alter table appeals
  add column if not exists sent_message_id text,
  add column if not exists sent_thread_id text,
  add column if not exists last_reply_message_id text,
  add column if not exists last_reply_kind text check (last_reply_kind in (
    'evidence_requested', 'accepted', 'rejected', 'info_only'
  )),
  add column if not exists last_reply_summary text;

alter table cases drop constraint if exists cases_status_check;
alter table cases add constraint cases_status_check check (status in (
  'new', 'reviewing', 'appealing', 'paying', 'paid', 'appealed', 'evidence_requested', 'closed'
));

create table if not exists evidence_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  requested_at timestamptz not null default now(),
  due_at date,
  message text,
  source_message_id text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists evidence_requests_case_id_idx on evidence_requests (case_id);

alter table evidence_requests enable row level security;

create policy "users who can view the case can view its evidence requests"
  on evidence_requests for select
  to authenticated
  using (exists (select 1 from cases c where c.id = case_id and can_view_vehicle(c.vehicle_id)));

-- No insert/update policy for authenticated — rows are created by
-- scan-mailboxes (service role) and marked fulfilled by
-- sendEvidenceReplyAction via the admin client, same "service-role-only
-- writes" pattern case_charges (0017) already uses.

create or replace function log_evidence_request_change()
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
      when 'INSERT' then 'evidence_request_created'
      when 'UPDATE' then 'evidence_request_updated'
    end,
    jsonb_build_object(
      'evidence_request_id', coalesce(new.id, old.id),
      'fulfilled_at', coalesce(new.fulfilled_at, old.fulfilled_at)
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function log_evidence_request_change() from public, anon, authenticated;

drop trigger if exists on_evidence_request_change on evidence_requests;
create trigger on_evidence_request_change
  after insert or update on evidence_requests
  for each row execute function log_evidence_request_change();
