-- Completes Part 2.3's "notification preferences" — migration 0013's own
-- header comment already flagged this as deferred: "SMS reminders need a
-- phone number, and nothing before now captures one... a settings UI to
-- let users actually set this is a separate feature, not part of this
-- migration." Users has had a `phone` column since 0013 with no way to
-- ever set it, meaning SMS reminders have been unreachable dead code in
-- practice for every account.
--
-- sms_reminders_enabled defaults false rather than firing SMS the moment
-- a phone number appears — SMS costs money per message (Twilio) and
-- deserves an explicit opt-in separate from just having entered a number,
-- not an implied one.

alter table users
  add column if not exists sms_reminders_enabled boolean not null default false;

-- No RLS change needed: "users can update their own profile" (0002) is
-- already unrestricted per-column, self-update only.
