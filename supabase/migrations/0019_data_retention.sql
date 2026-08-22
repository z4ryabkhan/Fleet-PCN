-- Phase 9 compliance pass, Part 4 rule 5: "don't keep full raw email
-- content indefinitely — parse, extract structured fields plus
-- user-uploaded evidence, then delete/minimise the raw source after a
-- short defined window (e.g. 30-90 days), configurable."
--
-- Email inbox scanning/parsing itself isn't built yet (Phase 6/7 shipped
-- only the OAuth connect/revoke foundation) so there is no raw email
-- body being stored anywhere today — when that feature is built, it
-- MUST apply this same minimise-after-a-window discipline to whatever
-- raw message content it persists, before it ships.
--
-- The one raw source that DOES exist today is cases.raw_ocr_json — the
-- full structured extraction Claude returns from an uploaded PCN photo
-- /PDF. Every field in it is already copied onto the case's own typed
-- columns (issuer_name, amount_full, final_deadline, etc.) at write
-- time, so raw_ocr_json is a redundant duplicate, not the only copy —
-- nulling it out after a window reduces the number of places the same
-- personal data lives without losing any information the case record
-- doesn't already hold. Uploaded evidence files themselves (the actual
-- PCN photos) are NOT touched here — they're the primary evidence a
-- user may still need for an active appeal, not "raw source" in the
-- sense this rule targets.
--
-- 90 days chosen as the upper end of the master plan's own suggested
-- 30-90 day range, since raw_ocr_json can still be useful for
-- support/debugging an extraction dispute for a while after upload.

create or replace function purge_stale_raw_ocr()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with purged as (
    update cases
    set raw_ocr_json = null
    where raw_ocr_json is not null
      and created_at < now() - interval '90 days'
    returning id
  )
  select count(*) into v_count from purged;

  if v_count > 0 then
    insert into audit_log (actor_user_id, action, metadata)
    values (null, 'raw_ocr_retention_purge', jsonb_build_object('cases_purged', v_count));
  end if;
end;
$$;

revoke execute on function purge_stale_raw_ocr() from public, anon, authenticated;

select cron.schedule(
  'purge-stale-raw-ocr',
  '17 3 * * *',
  $$select purge_stale_raw_ocr();$$
);
