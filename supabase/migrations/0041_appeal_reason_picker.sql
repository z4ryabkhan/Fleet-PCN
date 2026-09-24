-- New "Why are you appealing?" step (design mockup: Reason.dc.html, added
-- to the real flow 2026-09-24) — captured between Check Details and
-- assessment, so the AI drafts against what the user actually says
-- happened rather than only inferring grounds from the ticket's own
-- facts. Stored as its own column (not folded into appeals) because it's
-- an input to assessment, collected before an appeals row exists.
--
-- anonymous_drafts gets the same two columns so the anonymous /try flow
-- can persist the choice at the point it's made and have claimAnonymousDraft
-- carry it into the real cases row later, the same pattern edited_fields_json
-- already uses for Check Details' own edits.
alter table cases
  add column if not exists user_stated_reason text check (user_stated_reason in (
    'not_owner', 'hire_firm', 'already_paid', 'signs_unclear', 'entitled_to_park',
    'notice_error', 'amount_wrong', 'vehicle_taken',
    'medical_emergency', 'hospital_urgent', 'breakdown', 'bereavement',
    'permit_delay', 'new_resident', 'new_restriction', 'emergency_other',
    'hardship', 'other'
  )),
  add column if not exists user_reason_details text;

alter table anonymous_drafts
  add column if not exists user_stated_reason text check (user_stated_reason in (
    'not_owner', 'hire_firm', 'already_paid', 'signs_unclear', 'entitled_to_park',
    'notice_error', 'amount_wrong', 'vehicle_taken',
    'medical_emergency', 'hospital_urgent', 'breakdown', 'bereavement',
    'permit_delay', 'new_resident', 'new_restriction', 'emergency_other',
    'hardship', 'other'
  )),
  add column if not exists user_reason_details text;
