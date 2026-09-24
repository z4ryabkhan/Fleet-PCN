import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { mandatoryDisclaimer } from "@/lib/appeal";
import { AssessmentPanel } from "@/components/appeal/AssessmentPanel";
import { AutoAssess } from "@/components/appeal/AutoAssess";
import { EvidenceForm } from "@/components/appeal/EvidenceForm";
import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { CaseTimeline } from "@/components/cases/CaseTimeline";
import { PayOrAppealChoice } from "@/components/cases/PayOrAppealChoice";
import { formatCaseSummary } from "@/lib/case-summary";
import { formatAuditAction } from "@/lib/audit-log";
import { getIndividualCasePriceLabel } from "@/lib/billing";

export const metadata = { title: "Case — Planal" };

// Single row via the users.id FK — same cast-with-.returns() pattern
// src/app/dashboard/cases/page.tsx already uses for the equivalent
// memberships -> users embed, since the generated-free client types an
// embedded relation as an array by default.
type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  users: { email: string; full_name: string | null } | null;
};

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { caseId } = await params;
  const { paid } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);

  const { data: caseRow } = await supabase
    .from("cases")
    .select(
      "id, vehicle_id, issuer_type, issuer_name, reference_number, contravention_code, contravention_description, location_text, event_datetime, notice_date, amount_full, amount_discounted, discount_deadline, final_deadline, status, paid_at, created_at, details_confirmed_at, user_stated_reason, vehicles(vrm)"
    )
    .eq("id", caseId)
    .single();

  if (!caseRow) notFound();

  const vehicle = caseRow.vehicles as unknown as { vrm: string } | null;

  // Part 4 rule 7: "Audit log every access to a vehicle's case data —
  // actor, action, timestamp." Writes have been logged since migration
  // 0007; this is the read half, which never existed until now — see
  // 0031's own comment. Runs before the Promise.all below so this view
  // itself shows up at the top of the Activity log fetched there. Errors
  // are logged, not thrown: caseRow already proved this user can see this
  // case, so a failure here means something's actually wrong, but it
  // shouldn't block the user from seeing their own case.
  const { error: logViewError } = await supabase.rpc("log_case_view", { p_case_id: caseId });
  if (logViewError) console.error("log_case_view failed", logViewError);

  const [{ data: evidence }, { data: appeal }, { data: paidCharge }, { data: gmailConnection }, { data: auditLog }, { data: matchedIssuer }] =
    await Promise.all([
      supabase
        .from("evidence")
        .select("id, evidence_type, file_ref, uploaded_at")
        .eq("case_id", caseId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("appeals")
        .select(
          "ai_strength_rating, ai_grounds_json, ai_reasoning_text, draft_text, user_edited_text, user_confirmed_at, outcome, created_at, sent_to_email, send_method"
        )
        .eq("case_id", caseId)
        .maybeSingle(),
      // No-win-no-fee (2026-09-24): 'authorized' means a card is on file
      // and the individual can send — they're only actually 'paid' after
      // the appeal is later marked Won.
      organisation
        ? Promise.resolve({ data: null })
        : supabase
            .from("case_charges")
            .select("id")
            .eq("case_id", caseId)
            .eq("charge_type", "individual_per_case")
            .in("status", ["authorized", "paid"])
            .maybeSingle(),
      // Gmail draft creation (AssessmentPanel's "Create this as a Gmail
      // draft" button) is individual-only for now — see
      // createGmailDraftAction's own comment for why.
      organisation
        ? Promise.resolve({ data: null })
        : supabase
            .from("email_connections")
            .select("scopes")
            .eq("owner_type", "individual")
            .eq("owner_user_id", user.id)
            .eq("provider", "gmail")
            .eq("status", "connected")
            .maybeSingle(),
      supabase
        .from("audit_log")
        .select("id, actor_user_id, action, metadata, created_at, users(email, full_name)")
        .eq("metadata->>case_id", caseId)
        .order("created_at", { ascending: false })
        .returns<AuditLogRow[]>(),
      // Issuer directory (build brief section 5) is brand new and starts
      // empty — a miss here just means no prefill/guidance, never an
      // error. Case-insensitive match on the free-text issuer_name Claude
      // extracted, since there's no issuer_id FK on cases yet.
      caseRow.issuer_name
        ? supabase
            .from("issuers")
            .select("appeal_channel, appeal_email, portal_url, postal_address, verified_at, tribunal_name")
            .ilike("name", caseRow.issuer_name)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const gmailDraftAvailable = Boolean(
    gmailConnection?.scopes?.includes("https://www.googleapis.com/auth/gmail.compose")
  );

  // Only needed once there's an actual send gate to show a price on
  // (individuals; fleets never see this) — skip the Stripe round-trip
  // otherwise.
  const priceLabel = organisation ? null : await getIndividualCasePriceLabel();

  return (
    <main className="min-h-full bg-planal-bg px-5 py-10 pb-28 text-planal-ink">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            {vehicle?.vrm ?? "Case"}
          </h1>
          <Link href="/dashboard/cases" className="text-sm text-planal-ink-muted hover:text-planal-ink">
            &larr; Cases
          </Link>
        </div>

        <p className="mt-4 text-[15px] text-planal-ink">
          {formatCaseSummary({
            status: caseRow.status,
            issuerName: caseRow.issuer_name,
            amountFull: caseRow.amount_full,
            amountDiscounted: caseRow.amount_discounted,
            discountDeadline: caseRow.discount_deadline,
            finalDeadline: caseRow.final_deadline,
            contraventionDescription: caseRow.contravention_description,
            contraventionCode: caseRow.contravention_code,
            paidAt: caseRow.paid_at,
          })}
        </p>

        <div className="mt-6 rounded-2xl border border-planal-border bg-planal-surface p-5">
          <CaseTimeline
            uploadedAt={caseRow.created_at}
            detailsConfirmedAt={caseRow.details_confirmed_at}
            appealReadyAt={appeal?.created_at ?? null}
            sentAt={appeal?.user_confirmed_at ?? null}
          />
        </div>

        <CaseDetailsCard
          caseId={caseId}
          details={{
            issuer_name: caseRow.issuer_name,
            issuer_type: caseRow.issuer_type,
            reference_number: caseRow.reference_number,
            contravention_code: caseRow.contravention_code,
            contravention_description: caseRow.contravention_description,
            location_text: caseRow.location_text,
            amount_full: caseRow.amount_full,
            amount_discounted: caseRow.amount_discounted,
            discount_deadline: caseRow.discount_deadline,
            final_deadline: caseRow.final_deadline,
            status: caseRow.status,
          }}
        />

        {paid === "0" && (
          <p className="mt-4 rounded-xl border border-planal-border bg-planal-surface p-3 text-sm text-planal-ink">
            Checkout cancelled — no charge was made.
          </p>
        )}

        <div className="mt-6">
          <a
            href={`/api/cases/${caseId}/pdf-pack`}
            className="block rounded-2xl border border-planal-border bg-planal-surface p-4 text-center text-sm font-medium text-planal-brand-dark hover:bg-planal-brand-tint"
          >
            Download PDF pack — for issuers who only take post
          </a>
        </div>

        <div className="mt-6" id="send-appeal">
          {!appeal ? (
            caseRow.details_confirmed_at && <AutoAssess caseId={caseId} />
          ) : (
            <>
              {!appeal.user_confirmed_at && !["paid", "closed"].includes(caseRow.status) && (
                <PayOrAppealChoice
                  caseId={caseId}
                  amountDiscounted={caseRow.amount_discounted}
                  discountDeadline={caseRow.discount_deadline}
                />
              )}
              <div className="mt-4">
                <AssessmentPanel
                  caseId={caseId}
                  appeal={appeal}
                  disclaimer={mandatoryDisclaimer(
                    appeal.ai_strength_rating,
                    caseRow.issuer_type,
                    matchedIssuer?.tribunal_name
                  )}
                  requiresPayment={!organisation}
                  isPaid={Boolean(paidCharge)}
                  priceLabel={priceLabel}
                  gmailDraftAvailable={gmailDraftAvailable}
                  issuerMatch={matchedIssuer}
                  userStatedReason={caseRow.user_stated_reason}
                  caseIssuerType={caseRow.issuer_type}
                  ticket={{
                    referenceNumber: caseRow.reference_number,
                    vrm: vehicle?.vrm ?? null,
                    date: caseRow.event_datetime,
                    location: caseRow.location_text,
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-6">
          <EvidenceForm caseId={caseId} vehicleId={caseRow.vehicle_id} />

          <div className="mt-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
              Evidence on file
            </h2>
            {!evidence || evidence.length === 0 ? (
              <p className="mt-2 text-sm text-planal-ink-muted">No evidence uploaded yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {evidence.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-xl border border-planal-border bg-planal-surface px-4 py-2 text-sm"
                  >
                    <span className="capitalize text-planal-ink">{e.evidence_type.replace(/_/g, " ")}</span>
                    <span className="text-planal-ink-muted">
                      {new Date(e.uploaded_at).toLocaleDateString("en-GB")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Activity log</h2>
          <p className="mt-1 text-sm text-planal-ink-muted">
            Every access to this case, with who and when — required under UK GDPR for the
            location/time data a PCN carries.
          </p>
          {!auditLog || auditLog.length === 0 ? (
            <p className="mt-2 text-sm text-planal-ink-muted">No activity recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {auditLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl border border-planal-border bg-planal-surface px-4 py-2 text-sm"
                >
                  <span className="text-planal-ink">
                    {formatAuditAction(entry.action)}
                    <span className="text-planal-ink-muted">
                      {" "}
                      &middot; {entry.users?.full_name ?? entry.users?.email ?? "Unknown user"}
                    </span>
                  </span>
                  <span className="text-planal-ink-muted">
                    {new Date(entry.created_at).toLocaleString("en-GB")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
