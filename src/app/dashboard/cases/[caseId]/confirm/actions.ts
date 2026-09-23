"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { computeDeadlines, type IssuerType } from "@/lib/deadlines";

export type ConfirmDetailsState = { error: string } | undefined;

function numberOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/** Check Details screen (build brief section 7 screen 2) — "Looks right,
 * continue". Saves whatever the user edited (same fields OCR extracts) and
 * stamps details_confirmed_at, the timeline's second stage. Distinct from
 * updateCaseDetailsAction (the general edit form on the case/appeal page)
 * since this one also advances the timeline and always redirects forward
 * rather than staying on the same page. */
export async function confirmDetailsAction(
  _prevState: ConfirmDetailsState,
  formData: FormData
): Promise<ConfirmDetailsState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");
  if (!caseId) return { error: "Missing case." };

  const issuerType = stringOrNull(formData.get("issuerType")) as IssuerType | null;
  const noticeDate = stringOrNull(formData.get("noticeDate"));
  const explicitDiscountDeadline = stringOrNull(formData.get("discountDeadline"));
  const explicitFinalDeadline = stringOrNull(formData.get("finalDeadline"));
  const computed = computeDeadlines(issuerType, noticeDate);

  const { error } = await supabase
    .from("cases")
    .update({
      issuer_name: stringOrNull(formData.get("issuerName")),
      issuer_type: issuerType,
      reference_number: stringOrNull(formData.get("referenceNumber")),
      contravention_code: stringOrNull(formData.get("contraventionCode")),
      contravention_description: stringOrNull(formData.get("contraventionDescription")),
      location_text: stringOrNull(formData.get("locationText")),
      event_datetime: stringOrNull(formData.get("eventDatetime")),
      notice_date: noticeDate,
      amount_full: numberOrNull(formData.get("amountFull")),
      amount_discounted: numberOrNull(formData.get("amountDiscounted")),
      discount_deadline: explicitDiscountDeadline ?? computed?.discountDeadline ?? null,
      final_deadline: explicitFinalDeadline ?? computed?.finalDeadline ?? null,
      details_confirmed_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (error) return { error: "Could not save these details. Please try again." };

  redirect(`/dashboard/cases/${caseId}`);
}
