import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { mandatoryDisclaimer } from "@/lib/appeal";
import { AssessmentPanel } from "@/components/appeal/AssessmentPanel";
import { EvidenceForm } from "@/components/appeal/EvidenceForm";

export const metadata = { title: "Case — Planal" };

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
      "id, vehicle_id, issuer_type, issuer_name, reference_number, contravention_code, location_text, event_datetime, notice_date, amount_full, amount_discounted, discount_deadline, final_deadline, status, vehicles(vrm)"
    )
    .eq("id", caseId)
    .single();

  if (!caseRow) notFound();

  const vehicle = caseRow.vehicles as unknown as { vrm: string } | null;

  const [{ data: evidence }, { data: appeal }, { data: paidCharge }] = await Promise.all([
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
  ]);

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{vehicle?.vrm ?? "Case"}</h1>
          <Link href="/dashboard/cases" className="text-sm text-zinc-400 hover:text-white">
            &larr; Cases
          </Link>
        </div>

        <div className="mt-6 grid gap-4 rounded-xl border border-white/10 p-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-zinc-400">Issuer</p>
            <p className="mt-1">{caseRow.issuer_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Reference</p>
            <p className="mt-1">{caseRow.reference_number ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Contravention code</p>
            <p className="mt-1">{caseRow.contravention_code ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Location</p>
            <p className="mt-1">{caseRow.location_text ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Full amount</p>
            <p className="mt-1">{caseRow.amount_full != null ? `£${caseRow.amount_full}` : "—"}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Discounted amount</p>
            <p className="mt-1">
              {caseRow.amount_discounted != null ? `£${caseRow.amount_discounted}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Discount deadline</p>
            <p className="mt-1">{caseRow.discount_deadline ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Final deadline</p>
            <p className="mt-1">{caseRow.final_deadline ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Status</p>
            <p className="mt-1 capitalize">{caseRow.status}</p>
          </div>
        </div>

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
      </div>
    </main>
  );
}
