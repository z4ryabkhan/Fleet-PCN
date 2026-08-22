-- SMS reminders (Phase 4) need a phone number, and nothing before now
-- captures one — signup only asks for email/password. Adding the column
-- so the reminder pipeline is correct: it reads phone if present and
-- skips SMS cleanly (not an error) when absent. A settings UI to let
-- users actually set this is a separate feature (Part 2.3's "notification
-- preferences"), not part of this migration.

alter table users add column if not exists phone text;
