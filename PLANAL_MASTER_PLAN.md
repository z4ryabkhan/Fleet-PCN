# Planal — Master Build Plan & Claude Code Brief (FINAL)

**Owner:** Zaryab Khan
**Status:** This is the single source of truth. Do not create a competing spec — if something needs to change, edit this file, don't fork it.
**How to use this document:** Give this entire file to Claude Code as the first thing it reads. The final section, "THE KICKOFF PROMPT," is the literal text to paste in to start the build. Everything above it is context Claude Code (and you) needs to make good decisions along the way.

---

## PART 1 — THE THINKING (read this before touching code)

### 1.1 What this business actually is, honestly

Planal helps UK vehicle keepers — individuals and, more importantly, small fleets — catch a parking/traffic penalty notice (PCN) the moment it lands in their inbox or post, understand it in plain English, and act before the 14-day discount window and 28-day escalation deadline pass. Where the case looks worth fighting, AI assesses the appeal and drafts it for the user to review and send themselves.

**What it deliberately is not:** a system that can search any UK vehicle registration on demand and pull back tickets from councils, TfL, or private operators nationwide. That capability does not exist anywhere in the UK today. Every government API (DVLA VES, DVSA MOT History, KADOE), every checked council portal, every checked TfL system, and every checked private operator system requires a reference number that only exists after a ticket has already been issued and sent — none support VRM-only lookup. This was independently verified, not assumed. Don't let marketing copy, onboarding text, or a well-meaning feature idea drift back toward implying this exists. It doesn't, and building toward it (e.g. scraping) would be fragile, likely against portal terms of service, and wouldn't work regardless since no portal exposes what's needed.

The real, buildable, honest version of "we find it before you do" is: correspondence about a PCN is always sent by post or email to the registered keeper. Nobody has built a genuinely good consumer/fleet tool that watches for it and reacts within minutes instead of the weeks it typically takes a person to open their post. That gap is real and worth building for.

### 1.2 Is this actually worth building? (the honest weigh-up)

**Demand is real.** ~20–26 million PCNs are issued in the UK annually, worth roughly £1.76–2.15bn, and only about 3.2% are ever formally appealed despite appeal success rates of 38–64% depending on the tribunal. That gap — people who'd likely have won and never tried — is the core opportunity.

**But consumer subscription is the wrong shape for it.** Every existing UK competitor (Parking Ticket Pal, Kerbie, Resolvo, PCN Beater, Parc) is small — sub-2-years-old, low review counts, no breakout scale or major funding found. That's not proof the market is empty; it's evidence that a subscription model doesn't fit a problem most individuals only hit once or twice a year. Low-frequency utility + monthly subscription = high churn, weak LTV, and a crowded, expensive keyword-acquisition fight with everyone else chasing "parking ticket appeal" search traffic.

**B2B fleet is the better shaped opportunity**, and it's not close: fleet fine-management is still explicitly described by industry commentary (OASIS Group, Chevin Fleet, 2025–26) as spreadsheet/email-based and under-served by good software, existing bureau players (Taranto Fleet Bureau, Snapmyfine, Fleetworks) already charge successfully for adjacent versions of this, the SMB segment (10–200 vehicles) is too small for those enterprise-first bureau products to bother with properly, churn is naturally lower once embedded in someone's ops, and — critically — **Zaryab already operates vehicle-heavy businesses (Waves Hand Car Wash, Paratha Stop) and has direct, free access to trade/delivery/van-operator contacts** that most founders in this space would have to pay to reach. That's a real, usable edge.

**Verdict: build it, fleet-first, B2C as a secondary channel — not the other way round, and not both at once from day one.** This will not single-handedly deliver £30k/month in year one. Realistic rough math: reaching £30k MRR from B2C subscription alone would need ~6,000 paying subscribers, a hard ask for a low-frequency utility app; reaching it from fleet alone needs on the order of 10,000 vehicles under management (50–100+ fleet accounts), which is achievable over 12–24 months of real sales effort but isn't fast. What this business realistically is: cheap to build and validate, low financial risk, genuine underlying demand, high automation potential, a compounding software asset, and a real acquisition target in a sector that's already consolidating (StarTraq/August Equity have been actively rolling up UK parking-enforcement software companies). It's worth building as one of several income streams, not as the sole £30k/month bet — and it becomes materially more valuable if a future council/vendor data-partnership conversation (Chipside, Taranto — see Part 5) ever lands, at which point it stops being "one of several AI appeal apps" and becomes something nobody else has.

### 1.3 The decisions this changes vs. earlier drafts

- **Fleet-first, not consumer-first.** The build sequence, the validation phase, and the first real customers should all be SMB fleets, not individual motorists.
- **No consumer subscription.** Individuals get free ticket detection, dashboard, and deadline reminders; they pay only when they actually want the AI appeal engine to assess and draft a specific case (pay-per-case, not pay-per-month). Fleets pay recurring, because for them the value is constant, not occasional.
- **A validation phase comes before the main build**, not after. A landing page plus direct conversations with 10–15 real fleet contacts (through Zaryab's existing network) happens in the first 1–2 weeks, in parallel with only the earliest scaffolding work — not after seven weeks of building blind.

---

## PART 2 — PRODUCT SPEC

### 2.1 Two account types, one engine

- **Individual accounts** — one person, their own vehicle(s), free monitoring + pay-per-case appeal support.
- **Fleet/organisation accounts** — a business, multiple vehicles, multiple team members (admin + driver roles), recurring subscription billing, driver attribution and recharge, reporting.

Both run on the same underlying pipeline (ownership/authorisation verification → email/manual ticket intake → OCR extraction → deadline engine → AI appeal assessment). Build the engine once; the two account types are different UI/billing layers on top of it.

### 2.2 Core user journeys

**Fleet admin journey (primary — build and validate this first):**
1. Sign up as an organisation, add vehicles (bulk CSV import of VRMs supported).
2. Confirm fleet authorisation (company registration check + a document confirming the vehicles are the business's, e.g. fleet insurance schedule or lease agreements — see §2.5).
3. Connect the organisation's shared mailbox(es) that PCN correspondence actually lands in (this is usually a small number of shared inboxes for a fleet, not one per vehicle).
4. System auto-detects PCN-related mail, extracts fields, creates a case, attributes it to a vehicle (and a driver, if driver logs are provided).
5. Dashboard shows all open cases across the fleet, sorted by deadline urgency, with a simple table: Vehicle | Driver | New PCNs | Value | Deadline | Status.
6. Admin can bulk-approve payment, assign a case for driver recharge, or request an AI appeal draft per case.
7. Recurring monthly invoice via Stripe: platform fee + per-vehicle fee + per-case fee (see §3).

**Individual motorist journey (secondary):**
1. Sign up, add a vehicle, verify ownership (V5C or insurance document).
2. Connect personal email (optional — manual photo/PDF upload always available too).
3. Case auto-created on detection or manual upload; plain-English summary: *"You have a £70 PCN from Manchester City Council for [contravention]. Pay £35 before 25 August, or review your appeal options."*
4. Free: see the case, get reminders, deep-link to the issuer's own payment page (Planal is never merchant of record for the fine itself).
5. Paid (£9.99–£14.99 per case, price to be confirmed by real testing, not assumed): unlock AI appeal-strength assessment and drafted appeal text.
6. Human-in-the-loop: user reviews, edits if needed, and explicitly confirms before a case is marked "appeal submitted." Planal never auto-submits into a third-party portal.

### 2.3 Feature list — v1

- Auth (email/password + magic link), with an organisation/individual account-type split at signup
- Fleet: bulk vehicle CSV import, company authorisation check, team member invites (admin/driver roles), driver attribution
- Individual: single vehicle add + ownership verification (V5C or insurance document upload)
- DVLA VES lookup for cosmetic vehicle display (make/model/colour/tax/MOT status) — display only, never treated as keeper-identity or penalty data
- Manual ticket capture: photo/PDF upload → OCR → structured case, available to both account types at all times
- Email monitoring: Gmail OAuth first, Microsoft/Outlook OAuth second, scoped read-only, clearly explained, one-click revoke
- Case dashboard: fleet gets the multi-vehicle table view; individuals get a simple case list, both sorted by urgency
- Deadline engine: configurable per issuer-type (council/TfL/ULEZ/Congestion Charge/Dart Charge/private operator), since discount/escalation windows aren't identical across issuers
- Reminder engine: email + SMS at T-7, T-2, T-1 days ahead of each deadline
- AI appeal assessment: Strong/Moderate/Weak rating with plain-English reasoning, grounds identified, evidence required — never a bare score with no explanation, never a guaranteed-outcome claim
- Evidence upload per case (photos, receipts, permit/Blue Badge, breakdown documents)
- AI appeal drafting: editable letter/tribunal-form text
- Human-in-the-loop confirmation step before any case is marked "appeal submitted" — user submits themselves, off-platform, using the generated text
- Case outcome tracking (paid / appealed / won / lost)
- Billing: Stripe subscription + per-vehicle + per-case for fleets; Stripe per-case only for individuals
- Fleet reporting: monthly summary (tickets caught, value managed, deadlines hit, discount value saved)
- Account settings: connected-email management (view/revoke), vehicles, notification preferences, team members (fleet)
- Audit log: every read/write of a vehicle's case data, with who/when

### 2.4 Appeal-assessment grounds (v1 ruleset)

The AI should reason over these grounds, state which apply, cite the evidence needed for each, and give an overall rating with visible reasoning: payment already made · wrong registration recorded · unclear or missing signage · incorrect location recorded · vehicle not present / mistaken identity · grace period breach · loading/unloading exemption · valid Blue Badge displayed · valid permit displayed · procedural error (e.g. Notice to Owner not properly served, invalid contravention code) · ANPR timing error · duplicate notice for the same event · mitigating circumstances (medical/breakdown) · keeper-liability disputes specific to private PCNs (landowner authority, contract formation under POFA 2012).

Standard, mandatory copy alongside every assessment: *"Appeal strength: [X]. This is our assessment based on the evidence provided, not a guarantee. [Tribunal/POPLA/IAS] makes the final decision."*

### 2.5 Verification models (hard gate, not optional UX friction)

- **Individual:** V5C logbook photo, or insurance certificate, or lease/finance agreement.
- **Fleet:** Companies House lookup for the business, plus a document confirming vehicle-to-business linkage (fleet insurance schedule, lease agreements, or a signed director attestation for owned vehicles). No case-processing starts for a vehicle until this passes.

This gate exists because PCN data is inherently a location-and-time trail tied to a specific vehicle — treat it the way ICO's ANPR guidance treats identifying, high-risk data, not the way an anonymous car-history checker (HPI, carVertical) treats mechanical vehicle facts. A stranger must never be able to enter someone else's registration and see where their vehicle has been ticketed.

### 2.6 Explicit non-goals for v1 — do not build without stopping to confirm first

- No VRM-only cross-network discovery/search feature, and no scraping of council/TfL/private-operator portals to fake one.
- No auto-submission of appeals into any third-party portal without an explicit human confirmation click per submission.
- No postal mail scanning/redirect service (needs a mailroom/logistics partner — a business decision, not a v1 engineering task).
- No native iOS/Android app in v1 — ship a responsive, installable web app (PWA) first.
- No consumer subscription tier.
- No claim, anywhere in the product or marketing copy, that Planal can find a ticket the user hasn't received any correspondence about yet.

---

## PART 3 — MONETISATION (starting hypothesis — confirm with real fleet conversations in Phase 0, don't lock this blind)

| Segment | Model | Starting price to test |
|---|---|---|
| Fleet | Platform fee + per-vehicle + per-case | £25/month platform minimum (covers up to 10 vehicles) + £2/vehicle/month beyond 10 + £5 per case processed |
| Individual | Free monitoring, pay only to unlock AI appeal support | £9.99–£14.99 per case |

Ask fleet contacts directly in Phase 0 whether they'd pay this, and what number they'd actually sign at — don't treat this table as fixed until real conversations confirm or correct it.

---

## PART 4 — COMPLIANCE (non-negotiable, build in from day one)

1. **Ownership/authorisation verification is a hard gate** (§2.5) — no case data exists for a vehicle until it passes.
2. **Register as a data controller with the ICO** before any real (non-test) user data flows — check current small-organisation fee at ico.org.uk.
3. **Draft a DPIA before launch.** This product plausibly trips several ICO mandatory-DPIA triggers (systematic monitoring, geolocation/time tracking, AI evaluation/scoring, data-matching across sources). Have a solicitor review the final draft — don't ship on an AI-only draft.
4. **Human-in-the-loop on every AI appeal-strength output** — never let it become a fully automated submission with no review step. This is both a safety requirement and an Article 22A (UK GDPR automated decision-making) defensibility requirement.
5. **Data retention policy**: don't keep full raw email content indefinitely — parse, extract structured fields plus user-uploaded evidence, then delete/minimise the raw source after a short defined window (e.g. 30–90 days), configurable.
6. **Encrypt OAuth tokens at rest**, short-lived access tokens, refresh rotation, one-click revoke in account settings.
7. **Audit log** every access to a vehicle's case data — actor, action, timestamp.
8. **Privacy policy + Terms of Service** live before any real user data is processed, solicitor-reviewed before launch.
9. **Google/Microsoft OAuth app verification has its own multi-week timeline**, independent of the dev schedule. Start the Google security-assessment application as soon as there's a working demo and a live privacy-policy URL — don't wait until the email-monitoring feature is otherwise finished.

---

## PART 5 — DATA MODEL

- **users** — auth identity, contact prefs
- **organisations** — fleet/business accounts; billing entity for Stripe subscriptions
- **memberships** — user_id, organisation_id, role (admin/driver)
- **vehicles** — vrm, make/model/colour (from DVLA VES), owner_type (individual/organisation), owner_id, ownership_verification_status, ownership_verification_method, ownership_doc_ref, assigned_driver_user_id (fleet only)
- **email_connections** — owner_type, owner_id, provider (gmail/outlook), encrypted oauth tokens, scopes granted, status, connected_at, last_scanned_at
- **cases** — vehicle_id, issuer_name, issuer_type (council_pcn / tfl_pcn / congestion_charge / ulez / dart_charge / private_pcn / bus_lane / moving_traffic), reference_number, contravention_code, location_text, event_datetime, amount_full, amount_discounted, discount_deadline, final_deadline, status (new/reviewing/appealing/paying/paid/appealed/closed), source (manual_upload/email_auto), raw_ocr_json
- **evidence** — case_id, file_ref, evidence_type, uploaded_at
- **appeals** — case_id, ai_strength_rating, ai_grounds_json, ai_reasoning_text, draft_text, user_edited_text, user_confirmed_at, outcome
- **reminders** — case_id, channel, scheduled_for, sent_at
- **audit_log** — actor_user_id, vehicle_id/case_id, action, timestamp
- **billing** — organisation_id or individual user_id, Stripe customer/subscription/invoice references, per-case charge records

Row-Level Security must enforce: an individual only ever sees their own vehicles/cases; an organisation member only ever sees vehicles/cases belonging to their organisation, scoped further by role where relevant (e.g. a driver sees only their assigned vehicle's cases, an admin sees the fleet).

---

## PART 6 — TECH STACK (fixed — don't re-litigate mid-build without a clear reason)

- **Frontend:** Next.js (React), responsive/installable PWA, web-first.
- **Backend/DB/Auth/Storage:** Supabase (Postgres + Auth + Storage + Row-Level Security + Edge Functions).
- **Background jobs** (email polling, reminder scheduling): Supabase Edge Functions + pg_cron, escalate to Trigger.dev/Inngest only if job complexity outgrows that.
- **OCR + document extraction + appeal reasoning:** Claude API (vision-capable) for ticket photo/PDF extraction, classification, and appeal-strength assessment.
- **Email integration:** Gmail API (`gmail.readonly`) first, Microsoft Graph API second.
- **Vehicle lookup (cosmetic only):** DVLA Vehicle Enquiry Service (VES) API.
- **Notifications:** Resend or Postmark (email), Twilio (SMS).
- **Payments:** Stripe (organisation subscriptions + individual per-case charges).
- **Hosting:** Vercel (frontend) + Supabase Cloud (backend).

---

## PART 7 — ACCOUNTS & SETUP CHECKLIST (Zaryab does this — Claude Code cannot sign up for paid services)

Work through this roughly in build order, not all on day one.

- [ ] Domain name (check `.co.uk` and `.com`), private GitHub repo, Vercel account linked to it
- [ ] Supabase account + new project (note project URL, anon key, service key)
- [ ] DVLA developer portal — free VES API key (developer-portal.driver-vehicle-licensing.api.gov.uk)
- [ ] Anthropic Console account + API key
- [ ] Google Cloud Console project → enable Gmail API → configure OAuth consent screen → start the OAuth verification/security-assessment process as soon as a working demo exists (needs a live privacy-policy URL first)
- [ ] Microsoft Azure account → register an app in Azure AD → configure Microsoft Graph permissions (Mail.Read, offline_access)
- [ ] Stripe account (UK), test + live keys
- [ ] Resend or Postmark account
- [ ] Twilio account
- [ ] ICO data-controller registration (ico.org.uk)
- [ ] Solicitor review of DPIA draft and Terms of Service/Privacy Policy before real user data flows
- [ ] UK trademark register (ipo.gov.uk) and Companies House name check before fully committing to the brand
- [ ] Keep a running log of every third-party account created and who has admin access — needed for the DPIA and Article 30 records regardless

### Environment variables needed

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# DVLA Vehicle Enquiry Service (cosmetic vehicle lookup only — never penalty data)
DVLA_VES_API_KEY=

# Claude API (OCR / extraction / appeal-strength reasoning)
ANTHROPIC_API_KEY=

# Gmail OAuth
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=

# Microsoft Graph / Outlook OAuth
MS_OAUTH_CLIENT_ID=
MS_OAUTH_CLIENT_SECRET=
MS_OAUTH_TENANT_ID=
MS_OAUTH_REDIRECT_URI=

# Notifications
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=
ENCRYPTION_KEY_FOR_OAUTH_TOKENS=
```

---

## PART 8 — PHASED ROADMAP (fleet-first, validation before heavy build)

| Phase | Scope | Notes |
|---|---|---|
| 0 | **Validation.** Build a simple landing page (problem statement, fleet-focused pricing hypothesis from Part 3, waitlist/contact form). Zaryab runs 10–15 real conversations with fleet contacts in his network in parallel, testing the actual price points. Do not proceed to Phase 2+ until this shows real signal. | Days 1–10 |
| 1 | Repo scaffold: Next.js + Supabase wiring, auth with organisation/individual account split, CI, env config | Days 5–10 (overlaps with Phase 0) |
| 2 | Vehicle add + ownership/authorisation verification (both account types), DVLA VES cosmetic lookup | Days 11–15 |
| 3 | Manual ticket upload + OCR extraction + case dashboard (fleet table view + individual list view) | Days 16–22 |
| 4 | Deadline engine + reminder scheduling (email/SMS) | Days 23–26 |
| 5 | AI appeal assessment + draft generation + evidence upload + human-confirm step | Days 27–33 |
| 6 | Gmail email-monitoring integration (start Google OAuth verification process in parallel, as soon as a demo + privacy policy exist) | Days 34–41 |
| 7 | Outlook/Microsoft Graph integration | Days 42–46 |
| 8 | Billing: Stripe fleet subscription + per-vehicle + per-case, individual per-case | Days 47–50 |
| 9 | Compliance pass: DPIA draft, privacy policy/ToS pages live, audit logging verified, retention job live, ICO registration done | Days 51–55 |
| 10 | Beta polish, QA, deploy, onboard the first real fleet pilot(s) from Phase 0 conversations | Days 56–60 |

Stop and check in with Zaryab at the end of every phase before starting the next. Real accounts/keys need to be created between phases (Part 7), and priorities may shift once Phase 0 signal comes in.

### Definition of done for v1 beta launch

- A real fleet admin can: sign up, verify the business, bulk-add vehicles, connect a shared inbox, have a real test PCN email auto-detected and turned into a case attributed to the right vehicle, see accurate deadlines, get a reminder, generate an appeal draft worth sending, and be billed correctly via Stripe.
- A real individual can do the equivalent single-vehicle journey, free until they choose to pay for an appeal.
- Privacy policy, ToS, and ICO registration are live/complete.
- DPIA draft exists and has been solicitor-reviewed.
- No feature or marketing copy implies universal VRM-based ticket discovery.
- At least one real fleet pilot from Phase 0 is live on the platform.

---

## PART 9 — WORKING RULES FOR CLAUDE CODE

1. **Never build or suggest scraping** of any council, TfL, or private-operator system. None expose VRM-only lookup — it wouldn't work, and it risks legal/ToS issues. Flag instead of implementing a workaround.
2. **Never auto-submit an appeal** into a third-party portal without an explicit per-submission human confirmation click immediately beforehand.
3. **Never create case data for a vehicle that hasn't passed verification** (§2.5).
4. **Never treat DVLA VES data as keeper-identity or penalty data** — cosmetic display only.
5. **Never write copy implying Planal can find a ticket with no correspondence yet.**
6. **Row-Level Security from the first table created, not bolted on later.** Wire audit-log writes into every personal/vehicle-data table as it's created, not afterward.
7. **Build realistic UK PCN test fixtures early** (sample council PCN email/PDF, sample private-operator charge notice) based on the field patterns in Part 5 — needed to test OCR before real accounts are connected.
8. **Keep secrets out of the repo** — `.env.local` locally (gitignored), hosting provider's secret manager in deployed environments.
9. **If a feature isn't in Part 2's v1 list, or touches Part 2.6's non-goals, stop and confirm with Zaryab before building it.**
10. **Stop at the end of each Part 8 phase and check in** rather than running the whole roadmap unattended.

---

## PART 10 — THE KICKOFF PROMPT

Paste everything below this line into Claude Code, in the root of the empty Planal repo, with this whole file saved alongside it (e.g. as `PLANAL_MASTER_PLAN.md`):

---

Read `PLANAL_MASTER_PLAN.md` in this repo, in full, before doing anything else. It's the complete spec — vision, product definition, monetisation, compliance requirements, data model, tech stack, phased roadmap, and your working rules (Part 9). Don't start coding until you've read all of it.

We're building Planal: a fleet-first (with a secondary individual-consumer path) UK web app that catches parking/traffic penalty notices via email monitoring and manual upload, tracks deadlines, and uses AI to assess and draft appeals — with a human always confirming before anything is submitted. Full context and reasoning is in Part 1 of the spec; don't skip it, it explains why the product is scoped the way it is and what NOT to build.

Start with Phase 0 and Phase 1 together, since they run in parallel: build the simple validation landing page described in Part 8 Phase 0 (problem statement, fleet-focused pricing hypothesis from Part 3, a waitlist/contact form) first — that's small and I need it fast to start real conversations with fleet contacts. Then move into Phase 1 repo scaffolding (Next.js + Supabase, auth with an organisation/individual account split, CI, env config).

I'll be creating real accounts/API keys from the checklist in Part 7 as we go — tell me exactly which one you need before each phase that requires it, rather than assuming I've already got everything.

Follow every rule in Part 9 without exception — especially: no scraping of third-party portals, no auto-submission of appeals, no case data before verification passes, and Row-Level Security enforced from the very first table you create.

Stop and check in with me at the end of every phase before starting the next one. If you hit a decision that isn't already settled in the spec, stop and ask rather than guessing.
