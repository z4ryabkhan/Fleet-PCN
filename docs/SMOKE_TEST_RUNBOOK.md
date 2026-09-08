# Smoke test runbook: email → case, end to end

What this proves: a real email lands in a connected mailbox and, without
you touching anything else, becomes a case in the dashboard attributed to
the right vehicle — the core "we react in minutes, not weeks" claim the
whole product is built around (Part 1.1). Do this before onboarding any
real fleet pilot.

**Current state, verified directly against the live Supabase project as
of this writing:** the `scan-mailboxes` Edge Function is deployed, its
15-minute cron job is active, and a manual invocation returns a clean
`200` (`{"connectionsScanned":0,"messagesScanned":0,"casesCreated":0,"failed":0}`
— zero because no mailbox is connected yet, not because anything's
broken). So the plumbing works; nobody has actually tested it against a
real inbox yet. That's what this runbook is for.

One function handles both Gmail and Outlook (branching internally on
each connection's `provider` column) — you don't deploy or trigger
anything per-provider, just connect both mailbox types and the same
scheduled job covers both.

## Prerequisites

- [ ] A test vehicle already added **and verified** in your Planal account (individual or fleet — either works). Note its exact VRM; you'll need it below.
- [ ] Vercel deployment live and pointed at the `znjbothwzjiaabqlnlhn` Supabase project.

If verification is still pending on your test vehicle, do that first —
nothing below will produce a case without it (Part 9 rule 3 is a hard
gate, not a suggestion): `scan-mailboxes` looks up only vehicles the
mailbox's own owner controls, and a case insert for an unverified one is
rejected by the database regardless.

## Step 1 — Credentials (Part 7 checklist)

Two separate secret stores need each value: **Vercel** (the Next.js app —
OAuth connect/callback routes) and **Supabase Edge Function secrets**
(`scan-mailboxes` — token refresh + Claude calls). The README's "Edge
Function secrets are separate from the app's env vars" section has the
exact `supabase secrets set` command for all of them at once; this
section is about where each value actually comes from.

### 1a. Anthropic API key

console.anthropic.com → API keys → create one. Without this,
`scan-mailboxes` runs but every candidate email is silently skipped
(`extractPcnFromEmailText` returns null and the loop just continues) —
no error, just zero cases, which looks identical to "nothing to find"
unless you know to check for it.

### 1b. OAuth token encryption key

```
openssl rand -base64 32
```

Set the output as `ENCRYPTION_KEY_FOR_OAUTH_TOKENS` in **both** places
(Vercel and `supabase secrets set`) *before* Step 3 — connecting a
mailbox encrypts its tokens with whatever key is live at that moment,
and changing the key afterwards makes existing connections
undecryptable (they'd show as connected but every scan/refresh would
fail with a decrypt error in the function logs; fixable by reconnecting,
not data loss, but skip the annoyance).

### 1c. Google Cloud — Gmail

1. console.cloud.google.com → a project → APIs & Services → Library → enable **Gmail API**.
2. APIs & Services → OAuth consent screen → External → add your own Google account under **Test users** (test mode is fine for this smoke test — Part 4 rule 9's OAuth verification process is only needed before real users connect, not before you test).
3. Credentials → Create Credentials → OAuth client ID → Web application.
   - Authorized redirect URI: `https://<your-vercel-domain>/api/email/google/callback`
4. Copy the client ID and secret into `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET` (Vercel needs the redirect URI too; the Edge Function only needs the ID/secret pair).

### 1d. Azure AD — Outlook

1. portal.azure.com → Microsoft Entra ID → App registrations → New registration.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (matches the app's default `MS_OAUTH_TENANT_ID=common`).
   - Redirect URI: Web, `https://<your-vercel-domain>/api/email/microsoft/callback`
2. Certificates & secrets → New client secret → copy the **value** immediately (it's not shown again).
3. API permissions → Add a permission → Microsoft Graph → Delegated → `Mail.Read`, `offline_access` → grant admin consent if prompted.

Microsoft rotates refresh tokens on use — `scan-mailboxes` already
handles storing the new one each time it refreshes, so nothing extra to
do here, just worth knowing if you're ever reading the function logs and
see the stored refresh token change between runs.

### 1e. Optional but worth setting alongside the above: RESEND_API_KEY

If set, `scan-mailboxes` emails the mailbox owner ("we found a new PCN
for `<VRM>`...") the moment a case is created — the actual "minutes, not
weeks" notification, separate from the T-7/T-2/T-1 deadline reminders
`send-reminders` already sends. Same Resend sandbox-address restriction
as `send-reminders` until a Planal domain is verified there — the
notification email will only actually deliver to the account's own
Resend-verified address until then.

## Step 2 — Connect a mailbox

1. Sign into Planal as the account whose verified test vehicle you noted above.
2. `/dashboard/email` → Connect Gmail.
3. Complete the consent screen with the Google account whose inbox you want scanned (your own personal Gmail is fine for this).
4. Confirm the page shows it as `connected`.

## Step 3 — Send a test PCN

Use `docs/fixtures/sample-council-pcn-email.txt` (see `docs/fixtures/README.md`
for the placeholders). Fill in `{VRM}` with your verified test vehicle's
exact registration and `{NOTICE_DATE}` with today's date, then send it as
a normal email **to** the mailbox you just connected. It doesn't need to
come from anything that looks like a council — extraction classifies on
content, not sender domain. Both fixtures are plain text with no
attachment, which matches what `scan-mailboxes` actually reads today —
it extracts from the email body text only, not from PDF/photo
attachments (unlike the manual-upload path, which does OCR on an
attached file). A real PCN forwarded as a PDF attachment with little or
no body text won't extract well yet; that's a real gap worth knowing
about before relying on this for real mail, not something to route
around in this test.

## Step 4 — Trigger the scan

Don't wait for the 15-minute cron. From the Supabase SQL Editor (this
reuses the same Vault-stored service role key the cron job itself uses,
so it doesn't need you to paste any key in):

```sql
select net.http_post(
  url := 'https://znjbothwzjiaabqlnlhn.supabase.co/functions/v1/scan-mailboxes',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
) as request_id;
```

Then check the response (swap in the `request_id` you got back):

```sql
select status_code, content, error_msg from net._http_response where id = <request_id>;
```

`content` is a JSON summary: `{connectionsScanned, messagesScanned, casesCreated, failed}`.

Alternatively, `supabase functions invoke scan-mailboxes` via the CLI, or
just wait up to 15 minutes for the cron job (`scan-mailboxes-every-15-min`)
to pick it up on its own.

## Step 5 — Verify

- `/dashboard/cases` — a new case, status `reviewing`, source `email_auto`. Open it and check the extracted fields (issuer, reference, amounts, both deadlines) match the fixture.
- The connected mailbox's inbox — a "Planal — new PCN found for `<VRM>`" email, if `RESEND_API_KEY` is set (Step 1e).
- `/dashboard/email` — the connection's status should still read `connected` (not `error`).

## Step 6 — Repeat for Outlook

Same steps 2–5, connecting Outlook instead. No separate function or
cron job to trigger — `scan-mailboxes` already covers it; you're just
testing the second provider path through the same function.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `messagesScanned: 0` | The email hasn't arrived in the connected mailbox's **Inbox** yet (both providers query the Inbox, not other folders/labels), or it arrived outside the lookback window — a mailbox's first scan looks back 72 hours, later scans look back to just before the last scan. Also check the fixture's subject/body actually contains one of the keywords `scan-mailboxes` pre-filters on (see the `KEYWORDS` list in the function source) — the fixtures were written to match, but a heavily edited subject line might not. |
| `messagesScanned > 0` but `casesCreated: 0` | Almost always a VRM mismatch: the `{VRM}` you put in the fixture doesn't exactly match (case/whitespace-insensitive, but digits/letters must match) a vehicle already added under the account that owns the connected mailbox. Check `/dashboard/vehicles` for a typo, and confirm that vehicle shows as verified. |
| `failed > 0` in the response | Check the function logs (Supabase dashboard → Edge Functions → `scan-mailboxes` → Logs, or `supabase functions logs scan-mailboxes --project-ref znjbothwzjiaabqlnlhn`) — this counts connections that threw partway through (token refresh failure, Gmail/Graph API error), and the log line names which. |
| Everything runs but nothing happens, no errors anywhere | Check `ANTHROPIC_API_KEY` is actually set as an **Edge Function** secret specifically — it's the one failure mode that produces no error at all, just silent no-op extraction (see Step 1a). |
| Connection shows status `error` on `/dashboard/email` | The refresh token was rejected — reconnect the mailbox. |

## After it works

- This is also the point Part 4 rule 9 says to start the Google OAuth
  verification/security-assessment application — you now have a working
  demo and a live privacy policy, the two things it's gated on.
- Decide whether the two known gaps matter enough to fix before a real
  fleet pilot sees this: no PDF/photo attachment extraction (Step 3
  above), and Outlook's Inbox-only scope missing mail an inbox rule
  files elsewhere. Neither is silent data loss for a typical case — a
  real PCN email almost always has enough in the body text alone to
  extract — but worth a conscious call, not an accidental one.
