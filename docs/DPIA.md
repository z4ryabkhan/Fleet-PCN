# Data Protection Impact Assessment (DPIA) — Planal

**Status: AI-drafted first pass, NOT yet solicitor-reviewed.** Per Part 4 rule 3 of
`PLANAL_MASTER_PLAN.md`, this draft exists to give a solicitor a concrete starting
point, not to be relied on as a completed DPIA. Do not treat this document as
legal advice, and do not launch to real (non-test) users on the strength of this
draft alone — get it reviewed first.

Last updated: 2026-08-22, reflecting the schema and features shipped through
migration `0019_data_retention.sql` (Phases 0–9 foundation work; email-inbox
scanning itself is OAuth-connect-only so far, not yet parsing message content).

## 1. Why a DPIA is needed

UK GDPR requires a DPIA where processing is "likely to result in a high risk"
to individuals. The ICO's guidance lists several trigger criteria; Planal
plausibly meets at least four of them simultaneously, which on its own is a
strong signal a DPIA is required, not optional:

- **Systematic monitoring** — email inbox scanning (Gmail/Outlook OAuth,
  read-only) is a systematic, ongoing review of a person's or organisation's
  correspondence, even though it is scoped to detecting PCN-related mail only.
- **Evaluation or scoring** — the AI appeal-strength assessment
  (`src/lib/appeal.ts`) evaluates a person's legal position on a
  Strong/Moderate/Weak scale.
- **Data matching from multiple sources** — a single case record combines
  DVLA VES lookups, uploaded ownership/verification documents, manually or
  email-sourced PCN data, and (for fleets) driver attribution, all keyed to
  one vehicle/individual.
- **Data concerning a person's location and movements over time** — a PCN is
  inherently a location-and-time record ("this vehicle was at this place at
  this time"). §2.5 of the master plan explicitly treats this the way the
  ICO's ANPR guidance treats location trail data, not the way a mechanical
  vehicle-history checker treats non-identifying facts.

## 2. Description of processing

### 2.1 Data subjects
- Individual account holders (motorists).
- Fleet/organisation account holders and their staff (admins, drivers).
- Drivers assigned to fleet vehicles who may not themselves hold an account
  (attributed via `assigned_driver_user_id`, still a data subject).

### 2.2 Categories of personal data processed

| Category | Examples | Table(s) |
|---|---|---|
| Account/contact | name, email, phone (for SMS reminders) | `users` |
| Vehicle identity | VRM, DVLA VES cosmetic data (make/colour/tax/MOT — never keeper identity) | `vehicles` |
| Ownership/authorisation evidence | V5C, insurance certificate, lease agreement, Companies House data | `vehicles` (doc ref), Supabase Storage |
| Penalty notice / location-time data | issuer, contravention code, location text, event datetime, amounts, deadlines | `cases` |
| Uploaded evidence | photos of tickets, receipts, permits, Blue Badge, breakdown docs | `evidence`, Supabase Storage |
| AI-generated assessment | strength rating, reasoning, grounds, draft appeal text | `appeals` |
| Email account access | OAuth tokens (encrypted at rest, AES-256-GCM), granted scopes | `email_connections` |
| Billing | Stripe customer/subscription/charge references (no card data touches Planal's own servers) | `billing_accounts`, `case_charges` |
| Access history | actor, action, timestamp, affected vehicle/organisation | `audit_log` |

No special-category data (Article 9) is intentionally collected. The medical/
breakdown "mitigating circumstances" appeal ground (§2.4) is an exception
worth flagging to the solicitor specifically — a user may voluntarily disclose
health information as evidence for an appeal, which would then be special-
category data processed on an explicit-consent basis (the user is the one
uploading it, for their own benefit). This needs an explicit legal-basis note
in the final policy, not just a passing mention.

### 2.3 Purposes and legal basis (working assessment, confirm with solicitor)

- **Core case management, verification, reminders** — contract (providing the
  service the user signed up for).
- **Email monitoring** — consent (OAuth is an explicit, revocable per-user
  grant; scoped to `gmail.readonly` / `Mail.Read`, read-only, one-click
  revoke per Part 4 rule 6).
- **AI appeal assessment** — contract, with Article 22A safeguards (see §3).
- **Billing** — contract / legal obligation (tax records).
- **Audit logging** — legitimate interest (security, accountability, dispute
  resolution) and, for fleets, controller obligations to their own drivers.

### 2.4 Automated decision-making (Article 22A)

The AI appeal-strength assessment is evaluative but never fully automated:
`src/components/appeal/AssessmentPanel.tsx` requires an explicit checkbox
confirmation ("I understand I still need to submit this myself") before a
case can be marked appealed, and the app never submits anything to a
third-party portal itself (`confirmAppealAction` only updates Planal's own
database). Every assessment carries the mandatory disclaimer from
`mandatoryDisclaimer()` in `src/lib/appeal.ts`, stating this is an assessment,
not a guarantee, and that the relevant tribunal/adjudicator makes the final
decision. This should be enough to keep the processing outside Article 22A's
"solely automated" trigger, but the solicitor should confirm that view.

### 2.5 Sub-processors / recipients

- **Supabase** (Postgres, Auth, Storage) — primary data store, UK/EU region
  should be confirmed and pinned.
- **Anthropic (Claude API)** — OCR extraction and appeal-strength assessment;
  case/document content is sent per-request, not used to train models per
  Anthropic's API terms (confirm current DPA terms before launch).
- **Stripe** — billing; Planal never stores card numbers.
- **Resend** — transactional/reminder email delivery.
- **Twilio** — SMS reminder delivery.
- **Google / Microsoft** — OAuth-only; Planal reads mail via their APIs, does
  not receive a data export.

A full sub-processor list with DPA references needs solicitor sign-off before
this becomes the published privacy policy's basis.

### 2.6 Retention

- **Raw OCR extraction JSON** (`cases.raw_ocr_json`) — auto-cleared 90 days
  after case creation by the `purge-stale-raw-ocr` scheduled job
  (`supabase/migrations/0019_data_retention.sql`); the same fields remain on
  the case's own typed columns, so no information is lost, only the
  duplicate raw blob.
- **Waitlist entries** (pre-launch only) — kept until launch or validation
  concludes, per the current interim privacy notice.
- **OAuth tokens** — deleted immediately on user-initiated revoke (§ email
  settings "Revoke" action); not yet time-boxed beyond that — flag for the
  solicitor review whether a stale-connection auto-revoke (e.g. no activity
  for N months) should be added.
- **Audit log** — deliberately outlives the rows/actors it describes (no FK
  to `vehicles`, `organisations`, `cases`, or `users` — see migration `0009`
  and `0018`) so deleting a vehicle, case, or user account can never be
  blocked by, or silently destroy, its own audit trail. This is a deliberate
  design choice to satisfy Part 4 rule 7 without conflicting with erasure
  requests — the solicitor should confirm the resulting indefinite audit
  retention is itself proportionate, or whether it needs its own retention
  cap.
- **Case/vehicle/evidence data generally** — no automatic deletion window is
  implemented yet beyond the above. This is a genuine open gap: the master
  plan gives raw email/OCR content as the concrete example needing a window,
  but doesn't specify one for closed-case data generally. Needs a policy
  decision from Zaryab (with solicitor input) before launch, then an
  implementation to match.

### 2.7 Security measures already in place

- Row-Level Security on every table holding personal or vehicle data, from
  each table's first migration (Part 9 rule 6).
- OAuth tokens encrypted at rest (AES-256-GCM, `src/lib/crypto.ts`).
- Audit logging with real actor attribution (verified live — see the
  `git log` message for the audit-log-gaps migration for how this was
  tested).
- No third-party portal scraping or auto-submission anywhere in the codebase
  (Part 9 rules 1–2).
- Hard verification gate — `cases_vehicle_must_be_verified` — a database
  CHECK constraint, not just application logic, preventing any case existing
  for an unverified vehicle.

## 3. Risks identified (working list — solicitor to expand)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A stranger enters someone else's VRM and sees their PCN history | Low (RLS scopes every query to the vehicle's actual owner/org) | High if it occurred | RLS policies verified per-table; no VRM-only public lookup exists anywhere in the product (Part 9 rule 1/§2.6) |
| OAuth token compromise exposes a user's inbox | Low | High | Encryption at rest, read-only scopes, one-click revoke |
| AI appeal assessment relied on as a guaranteed outcome | Medium (user behaviour risk, not a technical one) | Medium | Mandatory disclaimer on every assessment, human-confirm step before "appealed" status |
| Special-category (health) data uploaded as mitigating-circumstances evidence | Medium | Medium-High | Needs explicit handling in the final privacy policy (see §2.2); currently stored the same as any other evidence file, not specially flagged — **open item for solicitor** |
| Indefinite retention of case/evidence data with no auto-deletion window | Medium (currently true) | Medium | **Open item** — needs a retention policy decision and matching implementation before launch |
| Audit log retained indefinitely (deliberately, to survive erasure of the rows it describes) | Low-Medium | Low | **Open item for solicitor** — confirm this is proportionate or needs its own cap |

## 4. Consultation

Not yet started. Before launch: solicitor review of this document, and (if
still required after that review) formal ICO consultation for any residual
high risk that can't be otherwise mitigated.

## 5. Outcome

**Not yet signed off.** This DPIA cannot be treated as complete until a
solicitor has reviewed it and the open items in §2.6 and §3 have been
resolved — this is required by Part 4 rule 3 before Planal processes any
real (non-test) user data.
