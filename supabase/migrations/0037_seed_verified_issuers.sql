-- Seeds the first verified issuer directory entries so tribunal/appeal-body
-- wording (UI review item 6) actually reads from the directory for at
-- least the highest-volume issuers, instead of every case falling back to
-- the generic issuer_type-based default because the table started empty.
--
-- Scope deliberately kept small: each row here was checked against
-- multiple independent, mutually-consistent sources (see source_url) at
-- verified_at. Several other high-volume private operators (Euro Car
-- Parks, UK Parking Control, Excel Parking, Vehicle Control Services,
-- Horizon Parking) were researched and dropped from this seed because
-- sources actively disagreed on which trade body (BPA/POPLA vs IPC/IAS)
-- they currently belong to — getting that wrong would put the wrong
-- adjudicator name in a user-facing legal disclaimer, which is worse than
-- leaving them on the generic fallback until someone can verify a specific
-- ticket's stated scheme directly. Add more rows here as they're verified,
-- following the same evidence bar.
insert into issuers (name, issuer_type, appeal_channel, portal_url, source_url, verified_at, tribunal_name, notes)
values
  (
    'Transport for London',
    'tfl_pcn',
    'portal',
    'https://tfl.gov.uk/modes/driving/red-routes/penalty-charge-notices/making-a-representation/how-to-appeal',
    'https://tfl.gov.uk/modes/driving/red-routes/penalty-charge-notices/making-a-representation/how-to-appeal',
    now(),
    'London Tribunals',
    'Red route / bus lane / moving traffic PCNs use this portal. Congestion Charge and ULEZ penalty challenges use a separate TfL portal (tfl.gov.uk/modes/driving/congestion-charge/penalties-and-enforcement/challenge-a-penalty-charge) but escalate to the same adjudicator, London Tribunals.'
  ),
  (
    'ParkingEye Ltd',
    'private_pcn',
    'portal',
    'https://www.parkingeye.co.uk/motorist/appeal/',
    'https://www.parkingeye.co.uk/motorist/appeal/',
    now(),
    'POPLA',
    'BPA Approved Operator Scheme member — second-stage appeal after ParkingEye rejects the first is to POPLA (popla.co.uk).'
  ),
  (
    'Civil Enforcement Limited',
    'private_pcn',
    'portal',
    'https://appeals.ce-service.co.uk/',
    'https://www.ce-service.co.uk/faqs/how-can-i-appeal-my-ticket/',
    now(),
    'POPLA',
    'BPA Approved Operator Scheme member — second-stage appeal after Civil Enforcement Ltd rejects the first is to POPLA (popla.co.uk).'
  )
on conflict ((lower(name))) do update set
  issuer_type = excluded.issuer_type,
  appeal_channel = excluded.appeal_channel,
  portal_url = excluded.portal_url,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  tribunal_name = excluded.tribunal_name,
  notes = excluded.notes;
