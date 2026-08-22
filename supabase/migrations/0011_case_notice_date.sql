-- Deadlines (discount/final) are legally counted from the date the PCN
-- notice was issued/served, not from event_datetime (when the
-- contravention itself happened) — these are often different dates,
-- especially for postal/CCTV-detected bus lane and moving traffic PCNs.
-- cases had no field for this. Adding it before building the deadline
-- engine, which needs it as the calculation anchor.

alter table cases add column if not exists notice_date date;
