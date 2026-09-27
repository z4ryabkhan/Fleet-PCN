-- 0043 gave cases a 'transfer_liability' route, but sending that notice had
-- nowhere honest to land: 'appealed' means "we argued we're not liable",
-- which isn't true of a transfer letter that names the actual driver/hirer
-- instead. Adds a status that says what actually happened.

alter table cases drop constraint if exists cases_status_check;
alter table cases add constraint cases_status_check check (status in (
  'new', 'reviewing', 'appealing', 'paying', 'paid', 'appealed', 'closed',
  'evidence_requested', 'transferred'
));
