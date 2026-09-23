import { redirect, notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ConfirmDetailsForm } from "@/components/cases/ConfirmDetailsForm";

export const metadata = { title: "Check details — Planal" };

type FieldConfidence = "high" | "low";

export default async function ConfirmDetailsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: caseRow } = await supabase
    .from("cases")
    .select(
      "id, issuer_name, issuer_type, reference_number, contravention_code, contravention_description, location_text, event_datetime, notice_date, amount_full, amount_discounted, discount_deadline, final_deadline, raw_ocr_json, vehicles(vrm)"
    )
    .eq("id", caseId)
    .single();

  if (!caseRow) notFound();

  const vehicle = caseRow.vehicles as unknown as { vrm: string } | null;

  const { data: evidenceRow } = await supabase
    .from("evidence")
    .select("file_ref")
    .eq("case_id", caseId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let thumbnailUrl: string | null = null;
  if (evidenceRow) {
    const { data } = await supabase.storage
      .from("case-evidence")
      .createSignedUrl(evidenceRow.file_ref, 60 * 10);
    thumbnailUrl = data?.signedUrl ?? null;
  }

  const confidence = (caseRow.raw_ocr_json as { fieldConfidence?: Record<string, FieldConfidence> } | null)
    ?.fieldConfidence;

  return (
    <main className="min-h-full bg-planal-bg px-5 py-10 text-planal-ink">
      <div className="mx-auto max-w-md">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
          Check the details
        </h1>
        <p className="mt-2 text-sm text-planal-ink-muted">
          We read this off your ticket. Anything marked{" "}
          <span className="rounded-full bg-planal-amber-bg px-2 py-0.5 text-xs font-semibold text-planal-amber-text">
            Please check
          </span>{" "}
          is worth a second look before you continue.
        </p>

        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a static asset next/image can optimise
          <img
            src={thumbnailUrl}
            alt="Uploaded ticket"
            className="mt-5 max-h-64 w-full rounded-2xl border border-planal-border object-contain bg-planal-surface"
          />
        )}

        <ConfirmDetailsForm
          caseId={caseId}
          vrm={vehicle?.vrm ?? ""}
          details={{
            issuerName: caseRow.issuer_name,
            issuerType: caseRow.issuer_type,
            referenceNumber: caseRow.reference_number,
            contraventionCode: caseRow.contravention_code,
            contraventionDescription: caseRow.contravention_description,
            locationText: caseRow.location_text,
            eventDatetime: caseRow.event_datetime,
            noticeDate: caseRow.notice_date,
            amountFull: caseRow.amount_full,
            amountDiscounted: caseRow.amount_discounted,
            discountDeadline: caseRow.discount_deadline,
            finalDeadline: caseRow.final_deadline,
          }}
          confidence={confidence ?? null}
        />
      </div>
    </main>
  );
}
