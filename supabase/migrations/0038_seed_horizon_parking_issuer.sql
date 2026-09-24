-- Adds Horizon Parking to the verified issuer directory (see 0037's
-- comment for the evidence bar this follows). Horizon Parking's own site
-- (horizonparking.co.uk/faq/can-i-appeal-the-parking-charge-notice/)
-- states escalation is to POPLA, so that's what's recorded here — but
-- several independent third-party appeal-guide sites state Horizon
-- Parking is an IPC member escalating to IAS instead, a direct conflict
-- with the operator's own claim. That disagreement is recorded in notes
-- rather than silently resolved, since which one is actually correct
-- couldn't be confirmed from this sandbox. The escalation code and body
-- named in an actual rejection letter is always authoritative over this
-- row if the two ever disagree.
insert into issuers (name, issuer_type, appeal_channel, portal_url, source_url, verified_at, tribunal_name, notes)
values (
  'Horizon Parking',
  'private_pcn',
  'portal',
  'https://horizonparking.co.uk/appeal-a-parking-charge/',
  'https://horizonparking.co.uk/faq/can-i-appeal-the-parking-charge-notice/',
  now(),
  'POPLA',
  'Horizon Parking''s own site states POPLA is the independent escalation route. Some third-party appeal-guide sites instead describe Horizon Parking as an IPC member escalating to IAS — a direct conflict we could not resolve independently. If a rejection letter from Horizon Parking names a different body or gives an IAS code, treat that letter as authoritative over this row.'
)
on conflict ((lower(name))) do update set
  issuer_type = excluded.issuer_type,
  appeal_channel = excluded.appeal_channel,
  portal_url = excluded.portal_url,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  tribunal_name = excluded.tribunal_name,
  notes = excluded.notes;
