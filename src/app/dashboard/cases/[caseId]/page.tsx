import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { mandatoryDisclaimer } from "@/lib/appeal";
import { AssessmentPanel } from "@/components/appeal/AssessmentPanel";
import { EvidenceForm } from "@/components/appeal/EvidenceForm";
import { CaseDetailsCard } from "@/components/cases/CaseDetailsCard";
import { formatCaseSummary } from "@/lib/case-summary";
import { formatAuditAction } from "@/lib/audit-log";

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
      "id, vehicle_id, issuer_type, issuer_name, reference_number, contravention_code, contravention_description, location_text, event_datetime, notice_date, amount_full, amount_discounted, discount_deadline, final_deadline, status, paid_at, vehicles(vrm)"
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

  const [{ data: evidence }, { data: appeal }, { data: paidCharge }, { data: gmailConnection }, { data: auditLog }] =
    await Promise.all([
      supabase
        .from("evidence")
        .select("id, evidence_type, file_ref, uploaded_at")
        .eq("case_id", caseId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("appeals")
        .select(
          "ai_strength_rating, ai_grounds_json, ai_reasoning_text, draft_text, user_edited_text, user_confirmed_at, outcome"
        )
        .eq("case_id", caseId)
        .maybeSingle(),
      organisation
        ? Promise.resolve({ data: null })
        : supabase
            .from("case_charges")
            .select("id")
            .eq("case_id", caseId)
            .eq("charge_type", "individual_per_case")
            .eq("status", "paid")
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
    ]);

  const gmailDraftAvailable = Boolean(
    gmailConnection?.scopes?.includes("https://www.googleapis.com/auth/gmail.compose")
  );

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{vehicle?.vrm ?? "Case"}</h1>
          <Link href="/dashboard/cases" className="text-sm text-zinc-400 hover:text-white">
            &larr; Cases
          </Link>
        </div>

        <p className="mt-4 text-lg text-zinc-100">
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
          <p className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">
            Checkout cancelled — no charge was made.
          </p>
        )}

        <div className="mt-8">
          <AssessmentPanel
            caseId={caseId}
            appeal={appeal}
            disclaimer={mandatoryDisclaimer(appeal?.ai_strength_rating ?? "weak", caseRow.issuer_type)}
            requiresPayment={!organisation}
            isPaid={Boolean(paidCharge)}
            gmailDraftAvailable={gmailDraftAvailable}
          />
        </div>

        <div className="mt-8">
          <EvidenceForm caseId={caseId} vehicleId={caseRow.vehicle_id} />

          <div className="mt-4">
            <h2 className="text-lg font-medium">Evidence on file</h2>
            {!evidence || evidence.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No evidence uploaded yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {evidence.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-md border border-white/10 px-4 py-2 text-sm"
                  >
                    <span className="capitalize text-zinc-300">{e.evidence_type.replace(/_/g, " ")}</span>
                    <span className="text-zinc-500">{new Date(e.uploaded_at).toLocaleDateString("en-GB")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-medium">Activity log</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Every access to this case, with who and when — required under UK GDPR for the
            location/time data a PCN carries.
          </p>
          {!auditLog || auditLog.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No activity recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {auditLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border border-white/10 px-4 py-2 text-sm"
                >
                  <span className="text-zinc-300">
                    {formatAuditAction(entry.action)}
                    <span className="text-zinc-500">
                      {" "}
                      &middot; {entry.users?.full_name ?? entry.users?.email ?? "Unknown user"}
                    </span>
                  </span>
                  <span className="text-zinc-500">
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
