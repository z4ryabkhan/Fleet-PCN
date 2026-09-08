-- Schedules the scan-mailboxes Edge Function every 15 minutes via
-- pg_cron + pg_net, same pattern as 0014_send_reminders_cron.sql
-- (including reusing the same 'service_role_key' Vault secret it
-- already creates — this migration only creates it if 0014 hasn't run
-- yet, e.g. on a fresh project).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'service_role_key') then
    perform vault.create_secret(
      'REPLACE_WITH_SERVICE_ROLE_KEY',
      'service_role_key',
      'Used by pg_cron to authenticate calls to Edge Functions'
    );
  end if;
end $$;

select cron.schedule(
  'scan-mailboxes-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://znjbothwzjiaabqlnlhn.supabase.co/functions/v1/scan-mailboxes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
