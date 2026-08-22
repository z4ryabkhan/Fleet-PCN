# Planal

Fleet-first (secondary individual-consumer path) UK web app that catches parking/traffic
penalty notices via email monitoring and manual upload, tracks deadlines, and uses AI to assess
and draft appeals — with a human always confirming before anything is submitted.

The full spec — vision, product definition, monetisation, compliance, data model, tech stack,
phased roadmap, and working rules — lives in [`PLANAL_MASTER_PLAN.md`](./PLANAL_MASTER_PLAN.md).
That file is the source of truth; this README just orients you inside the repo.

## Status: Phase 0 + Phase 1 (in progress)

Currently live: the Phase 0 validation landing page (problem statement, fleet pricing
hypothesis, waitlist form) plus the start of Phase 1 repo scaffolding. See Part 8 of the master
plan for the full roadmap.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + Storage + Row-Level Security)

## Local setup

```bash
npm install
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from your Supabase project (Settings → API) — required for the
waitlist form to persist submissions. Everything else in `.env.example` is for later phases;
leave it blank until the relevant phase needs it (see Part 7 of the master plan).

Run the migration in `supabase/migrations/` against your Supabase project (SQL editor, or the
Supabase CLI) before testing the waitlist form — it creates the `waitlist_signups` table with
Row-Level Security enabled.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Working rules

Every table gets Row-Level Security from creation, not bolted on later. No scraping of
third-party portals. No auto-submission of appeals. No case data before ownership/authorisation
verification passes. Full list: Part 9 of `PLANAL_MASTER_PLAN.md`.
