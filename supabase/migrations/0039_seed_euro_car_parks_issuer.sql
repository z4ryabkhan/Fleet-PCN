-- Adds Euro Car Parks to the verified issuer directory (see 0037's
-- comment for the evidence bar this follows). This one was originally
-- left out of 0037 pending further checking: some third-party
-- appeal-guide sites describe Euro Car Parks as an IPC member (escalating
-- to IAS) following its 2021 acquisition by APCOA. That's superseded here
-- by stronger, primary-source evidence — eurocarparks.com runs two
-- dedicated FAQ pages specifically about appealing to POPLA ("What is
-- POPLA?" and "My appeal has been rejected and I would like to appeal to
-- POPLA, how do I do this?") — which only makes sense if POPLA is their
-- actual current escalation route.
insert into issuers (name, issuer_type, appeal_channel, portal_url, source_url, verified_at, tribunal_name, notes)
values (
  'Euro Car Parks',
  'private_pcn',
  'portal',
  'https://www.eurocarparks.com/appeal-a-parking-charge/',
  'https://www.eurocarparks.com/faq/my-appeal-has-been-rejected-and-i-would-like-to-appeal-to-popla-how-do-i-do-this/',
  now(),
  'POPLA',
  'Some third-party appeal-guide sites describe Euro Car Parks (acquired by APCOA in 2021) as an IPC member escalating to IAS instead. Euro Car Parks'' own site runs dedicated FAQ pages specifically about escalating to POPLA, which is the stronger signal and what''s recorded here — but if a rejection letter names IAS or a different body, treat that letter as authoritative over this row.'
)
on conflict ((lower(name))) do update set
  issuer_type = excluded.issuer_type,
  appeal_channel = excluded.appeal_channel,
  portal_url = excluded.portal_url,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  tribunal_name = excluded.tribunal_name,
  notes = excluded.notes;
