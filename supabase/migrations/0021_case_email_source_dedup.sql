-- Phase 6/7 completion: email auto-detection actually creating cases.
--
-- Phases 6/7 (migrations 0016/0018) only shipped OAuth connect/revoke —
-- no scanning job existed yet, so no case was ever attributed to a
-- provider message. This migration adds what the scanner
-- (supabase/functions/scan-mailboxes) needs to dedupe: without a durable
-- record of which provider message a case came from, re-scanning the same
-- inbox (the scanner re-checks a rolling lookback window, not just
-- messages since the last successful run, to tolerate a missed run)
-- would create duplicate cases for the same PCN email every time it runs.

alter table cases
  add column if not exists source_message_id text;

-- Unique only where set — manual_upload cases have no message id and
-- must not collide with each other.
create unique index if not exists cases_source_message_id_unique
  on cases (source_message_id) where source_message_id is not null;
