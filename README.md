# Planal

Fleet-first (secondary individual-consumer path) UK web app that catches parking/traffic
penalty notices via email monitoring and manual upload, tracks deadlines, and uses AI to assess
and draft appeals — with a human always confirming before anything is submitted.

The full spec — vision, product definition, monetisation, compliance, data model, tech stack,
phased roadmap, and working rules — lives in [`PLANAL_MASTER_PLAN.md`](./PLANAL_MASTER_PLAN.md).
That file is the source of truth; this README just orients you inside the repo.

## Status: Phases 0–8 done, Phase 9 in progress

Built: the Phase 0 validation landing page; Phase 1 auth (org/individual split); Phase 2
vehicle add + ownership/authorisation verification + DVLA VES lookup; Phase 3 manual ticket
upload + OCR + case dashboard; Phase 4 deadline engine + email/SMS reminders; Phase 5 AI appeal
assessment/drafting + evidence upload + human-confirm step; Phase 6/7 Gmail and Outlook OAuth
connect/revoke **and** the actual inbox-scanning pipeline that turns a connected mailbox into
cases (`supabase/functions/scan-mailboxes`, scheduled via pg_cron — see the Edge Function
secrets section below, and that function's own header comment: it's unverified against live
Gmail/Outlook/Anthropic traffic, test it against a real connected mailbox before relying on it);
Phase 8 Stripe billing (fleet subscription + per-vehicle + per-case, individual per-case).
Phase 9 (compliance pass) is partial: audit-log gaps fixed, a 90-day retention job for raw OCR
JSON, a DPIA first draft, and a special-category (medical/breakdown evidence) consent flow are
done; a retention window for case/evidence data more generally is still an open policy decision
(see `docs/DPIA.md` §2.6), and the DPIA/privacy policy/ToS still need a solicitor review before
any real (non-test) user data flows. See Part 8 of the master plan for the full roadmap — Phase
10 (beta polish, QA, deploy, first real pilot) is next.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + Storage + Row-Level Security)

Next.js 16 renamed `middleware.ts` to `proxy.ts` (exporting a `proxy` function) — that's what
handles session refresh and route protection here, not a `middleware.ts` file.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from your Supabase project (Settings → API). Everything else in
`.env.example` is for later phases; leave it blank until the relevant phase needs it (see Part 7
of the master plan).

Run the migrations in `supabase/migrations/` against your Supabase project, in order (SQL
editor, or the Supabase CLI) — they create `waitlist_signups`, `users`, `organisations`, and
`memberships`, all with Row-Level Security enabled from creation.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase Auth email templates (one-time dashboard step)

Signup confirmation and magic-link emails need to link to `/auth/confirm?token_hash=...&type=...`
(handled by `src/app/auth/confirm/route.ts`), not Supabase's default `{{ .ConfirmationURL }}`
link. In the Supabase dashboard, under Authentication → Email Templates, update the
**Confirm signup** and **Magic Link** templates' link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

(use `type=magiclink` for the Magic Link template). Until this is set, confirmation/magic-link
emails will use Supabase's own hosted verify page instead of this route.

### Supabase's shared SMTP has a low rate limit

The current Supabase project sends Auth emails (confirmation, magic link) through Supabase's
built-in shared SMTP, which only allows a handful of emails per hour — fine for occasional
manual testing, not for real signups. Before onboarding real users, configure custom SMTP
(Authentication → Settings → SMTP Settings) using Resend, which is already on the Part 7
checklist for transactional email.

Note this project's "Confirm email" setting is currently **off** — `signUp()` returns an active
session immediately, no email click required. The signup action already handles both cases (it
checks whether a session came back), so this is safe to turn on later without a code change.

### Edge Function secrets are separate from the app's env vars

`supabase/functions/send-reminders` and `supabase/functions/scan-mailboxes` run on Supabase's
own infrastructure, not Vercel — setting `ANTHROPIC_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID` etc. in
Vercel (or `.env.local`) does **not** make them available to these functions. Set them
separately with the Supabase CLI:

```bash
supabase secrets set \
  ANTHROPIC_API_KEY=... \
  GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
  MS_OAUTH_CLIENT_ID=... MS_OAUTH_CLIENT_SECRET=... \
  ENCRYPTION_KEY_FOR_OAUTH_TOKENS=... \
  RESEND_API_KEY=... TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=... \
  --project-ref znjbothwzjiaabqlnlhn
```

Until a given key is set, the function it belongs to runs as a no-op for whatever depends on it
(logged, not failed) rather than erroring — same "inert without the key" pattern the app itself
uses. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically and don't need
setting.

## Working rules

Every table gets Row-Level Security from creation, not bolted on later. No scraping of
third-party portals. No auto-submission of appeals. No case data before ownership/authorisation
verification passes. Full list: Part 9 of `PLANAL_MASTER_PLAN.md`.
