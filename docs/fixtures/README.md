# Test PCN fixtures

Realistic UK PCN email bodies, per Part 9 rule 7 of the master plan ("build
realistic UK PCN test fixtures early... needed to test OCR before real
accounts are connected") — never actually built until now, when the email
scanning pipeline made it possible to test end-to-end.

Two variants, matching the two `issuer_type` families with materially
different legal basis and wording (Part 2.4/2.5):

- `sample-council-pcn-email.txt` — a statutory council PCN (Traffic
  Management Act 2004 wording, "Notice to Owner" escalation language).
- `sample-private-pcn-email.txt` — a private operator's Parking Charge
  Notice (POFA 2012 keeper-liability wording, IAS/POPLA appeal route).

## Using them

Both have placeholders to fill in before sending:

- `{VRM}` — must exactly match a vehicle already added **and verified**
  in the Planal account whose mailbox you're testing against (Part 9 rule
  3 — no case is ever created for an unmatched or unverified vehicle, by
  design, so this is the one placeholder that actually has to be right).
- `{NOTICE_DATE}` — use today's date (`YYYY-MM-DD` or `DD Month YYYY`,
  either extracts fine) so the computed deadlines land in the future and
  are easy to sanity-check.
- `{EVENT_DATE}` — anything a few hours/days before the notice date.
- `{PCN_NUMBER}` — anything; only used to check reference-number
  extraction and duplicate-detection (send the same fixture twice with
  the same number to confirm the second one is skipped as
  `duplicate_reference`, not a second case).

See `docs/SMOKE_TEST_RUNBOOK.md` for the full connect → send → scan →
verify procedure these are meant to be used in.

These are synthetic — no real issuer, reference number, or vehicle is
referenced. Safe to send from any test mailbox.
