"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { assessAppeal } from "@/lib/appeal";

export type CaseDetailActionState = { error: string } | { success: string } | undefined;

async function loadCaseContext(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  caseId: string
) {
  const { data: caseRow } = await supabase
    .from("cases")
    .select(
      "id, vehicle_id, issuer_type, issuer_name, contravention_code, location_text, event_datetime, amount_full, amount_discounted, vehicles(vrm)"
    )
    .eq("id", caseId)
    .single();

  if (!caseRow) return null;

  const { data: evidence } = await supabase
    .from("evidence")
    .select("evidence_type")
    .eq("case_id", caseId);

  const vehicle = caseRow.vehicles as unknown as { vrm: string } | null;

  return {
    caseRow,
    vrm: vehicle?.vrm ?? "unknown",
    evidenceTypes: (evidence ?? []).map((e) => e.evidence_type),
  };
}

export async function requestAssessmentAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");
  const ctx = await loadCaseContext(supabase, caseId);
  if (!ctx) return { error: "Case not found." };

  const assessment = await assessAppeal({
    issuerType: ctx.caseRow.issuer_type,
    issuerName: ctx.caseRow.issuer_name,
    contraventionCode: ctx.caseRow.contravention_code,
    locationText: ctx.caseRow.location_text,
    eventDatetime: ctx.caseRow.event_datetime,
    amountFull: ctx.caseRow.amount_full,
    amountDiscounted: ctx.caseRow.amount_discounted,
    vrm: ctx.vrm,
    evidenceTypes: ctx.evidenceTypes,
  });

  if (!assessment) {
    return { error: "AI appeal assessment isn't available yet — the Anthropic API key hasn't been configured." };
  }

  const { error: upsertError } = await supabase.from("appeals").upsert(
    {
      case_id: caseId,
      ai_strength_rating: assessment.strength,
      ai_grounds_json: assessment.applicableGrounds,
      ai_reasoning_text: assessment.reasoningText,
      draft_text: assessment.draftText,
      created_by: user.id,
    },
    { onConflict: "case_id" }
  );

  if (upsertError) return { error: "Could not save the assessment. Please try again." };

  await supabase.from("cases").update({ status: "appealing" }).eq("id", caseId);

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: "Assessment complete — review the draft below." };
}

export async function saveDraftEditAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");
  const editedText = String(formData.get("editedText") || "");

  const { error } = await supabase
    .from("appeals")
    .update({ user_edited_text: editedText })
    .eq("case_id", caseId);

  if (error) return { error: "Could not save your edits." };

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: "Draft saved." };
}

// This marks the case "appealed" in Planal only — Part 9 rule 2: never
// auto-submit into a third-party portal. The user has already been told,
// immediately before this click, that they must submit the text
// themselves. Nothing here reaches any external system.
export async function confirmAppealAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");

  const { error: appealError } = await supabase
    .from("appeals")
    .update({ user_confirmed_at: new Date().toISOString(), outcome: "pending" })
    .eq("case_id", caseId);

  if (appealError) return { error: "Could not confirm. Please try again." };

  await supabase.from("cases").update({ status: "appealed" }).eq("id", caseId);

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: "Marked as appealed. Remember: you still need to submit this yourself." };
}

export async function addEvidenceAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");
  const vehicleId = String(formData.get("vehicleId") || "");
  const evidenceType = String(formData.get("evidenceType") || "");
  const file = formData.get("file") as File | null;

  if (!["receipt", "permit", "blue_badge", "breakdown_doc", "other"].includes(evidenceType)) {
    return { error: "Please choose an evidence type." };
  }
  if (!file || file.size === 0) return { error: "Please choose a file." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large (max 10MB)." };

  const path = `${vehicleId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("case-evidence").upload(path, file);
  if (uploadError) return { error: "Could not upload the file." };

  const { error: insertError } = await supabase.from("evidence").insert({
    case_id: caseId,
    file_ref: path,
    evidence_type: evidenceType,
    uploaded_by: user.id,
  });
  if (insertError) return { error: "Could not save the evidence record." };

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: "Evidence added." };
}

export async function setOutcomeAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");
  const outcome = String(formData.get("outcome") || "");
  if (!["won", "lost"].includes(outcome)) return { error: "Invalid outcome." };

  const { error } = await supabase.from("appeals").update({ outcome }).eq("case_id", caseId);
  if (error) return { error: "Could not save the outcome." };

  await supabase.from("cases").update({ status: "closed" }).eq("id", caseId);

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: "Outcome recorded." };
}
