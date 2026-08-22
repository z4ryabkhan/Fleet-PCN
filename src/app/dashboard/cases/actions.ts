"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractPcnFromFile } from "@/lib/ocr";

export type CaseActionState = { error: string } | { success: string } | undefined;

export async function addManualCaseAction(
  _prevState: CaseActionState,
  formData: FormData
): Promise<CaseActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const vehicleId = String(formData.get("vehicleId") || "");
  const file = formData.get("ticket") as File | null;

  if (!vehicleId) return { error: "Please choose a vehicle." };
  if (!file || file.size === 0) return { error: "Please upload a photo or PDF of the ticket." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large (max 10MB)." };

  const path = `${vehicleId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("case-evidence")
    .upload(path, file);

  if (uploadError) {
    // The vehicle_is_verified check constraint isn't checked here (storage
    // has no view of it) — this is just "upload failed", surfaced plainly;
    // the friendlier "vehicle not verified" message comes from the insert
    // below, which is where that constraint actually lives.
    return { error: "Could not upload the file. Please try again." };
  }

  const { data: caseRow, error: insertError } = await supabase
    .from("cases")
    .insert({
      vehicle_id: vehicleId,
      source: "manual_upload",
      status: "new",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !caseRow) {
    return {
      error: insertError?.message.includes("cases_vehicle_must_be_verified")
        ? "This vehicle hasn't passed verification yet — verify it before adding a case."
        : "Could not create the case. Please try again.",
    };
  }

  await supabase.from("evidence").insert({
    case_id: caseRow.id,
    file_ref: path,
    evidence_type: file.type === "application/pdf" ? "ticket_pdf" : "ticket_photo",
    uploaded_by: user.id,
  });

  const extraction = await extractPcnFromFile(Buffer.from(await file.arrayBuffer()), file.type);
  if (extraction) {
    await supabase
      .from("cases")
      .update({
        issuer_name: extraction.issuerName,
        issuer_type: extraction.issuerType,
        reference_number: extraction.referenceNumber,
        contravention_code: extraction.contraventionCode,
        location_text: extraction.locationText,
        event_datetime: extraction.eventDatetime,
        amount_full: extraction.amountFull,
        amount_discounted: extraction.amountDiscounted,
        discount_deadline: extraction.discountDeadline,
        final_deadline: extraction.finalDeadline,
        raw_ocr_json: extraction,
        status: "reviewing",
      })
      .eq("id", caseRow.id);
  }

  revalidatePath("/dashboard/cases");
  return {
    success: extraction
      ? "Ticket added and details extracted — review below."
      : "Ticket added. Automatic extraction isn't available yet, so add the details manually.",
  };
}
