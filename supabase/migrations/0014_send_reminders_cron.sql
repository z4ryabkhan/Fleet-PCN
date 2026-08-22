-- Schedules the send-reminders Edge Function every 15 minutes via
-- pg_cron + pg_net, per Part 6 ("Supabase Edge Functions + pg_cron").
--
-- The service role key is stored in Supabase Vault rather than embedded
-- directly in the cron job's command text — cron.job (and
-- cron.job_run_details) are readable by anyone with sufficient DB
-- privileges, so a hardcoded key there is effectively plaintext-at-rest;
-- Vault keeps it encrypted and referenced by name instead. This is
-- Supabase's own recommended pattern for calling Edge Functions from
-- pg_cron.
--
-- Verified against the deployed function directly before scheduling:
-- Bearer <this key> returns 200, any other value returns 401.

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
  'send-reminders-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://znjbothwzjiaabqlnlhn.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
