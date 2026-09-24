import { createHash } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PcnExtraction } from "@/lib/ocr";
import type { AppealAssessment } from "@/lib/appeal";
import { normalizeVrm } from "@/lib/vrm";

// UI review item 1: everything before "Send" happens against
// anonymous_drafts (migration 0035), never against `cases` — see that
// migration's own comment for why. Every function here uses the
// service-role client deliberately: there's no authenticated user for most
// of this flow, so access is controlled purely by knowledge of the random
// token, the same trust model as a magic link.

const MAX_ANONYMOUS_EXTRACTIONS_PER_DAY = 20;

/** Coarse per-IP throttle on the one anonymous action that costs real
 * money (a Claude vision call) with no auth gate in front of it. Not a
 * security boundary — an attacker can rotate IPs — just a cheap backstop
 * against one runaway client or script. */
export async function checkAndRecordAnonymousUsage(ip: string): Promise<{ allowed: boolean }> {
  const admin = getSupabaseAdminClient();
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { count } = await admin
    .from("anonymous_extraction_usage")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_ANONYMOUS_EXTRACTIONS_PER_DAY) {
    return { allowed: false };
  }

  await admin.from("anonymous_extraction_usage").insert({ ip_hash: ipHash });
  return { allowed: true };
}

export async function createAnonymousDraft(params: {
  imageBytes: Buffer;
  mimeType: string;
  filename: string;
  extraction: PcnExtraction;
}): Promise<{ token: string; thumbnailUrl: string | null }> {
  const admin = getSupabaseAdminClient();
  const token = crypto.randomUUID();
  const path = `_anonymous/${token}/${params.filename}`;

  const { error: uploadError } = await admin.storage
    .from("case-evidence")
    .upload(path, params.imageBytes, { contentType: params.mimeType });
  if (uploadError) throw new Error(`Anonymous draft upload failed: ${uploadError.message}`);

  const { error: insertError } = await admin.from("anonymous_drafts").insert({
    token,
    image_storage_path: path,
    extraction_json: params.extraction,
  });
  if (insertError) throw new Error(`Anonymous draft insert failed: ${insertError.message}`);

  const { data: signed } = await admin.storage.from("case-evidence").createSignedUrl(path, 3600);
  return { token, thumbnailUrl: signed?.signedUrl ?? null };
}

export type AnonymousDraftRow = {
  id: string;
  token: string;
  image_storage_path: string;
  extraction_json: PcnExtraction | null;
  edited_fields_json: PcnExtraction | null;
  ai_strength_rating: AppealAssessment["strength"] | null;
  ai_grounds_json: AppealAssessment["applicableGrounds"] | null;
  ai_reasoning_text: string | null;
  draft_text: string | null;
  claimed_at: string | null;
};

export async function getAnonymousDraft(token: string): Promise<AnonymousDraftRow | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("anonymous_drafts")
    .select("*")
    .eq("token", token)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data as AnonymousDraftRow | null;
}

export async function updateAnonymousDraftFields(token: string, editedFields: PcnExtraction): Promise<void> {
  const admin = getSupabaseAdminClient();
  await admin.from("anonymous_drafts").update({ edited_fields_json: editedFields }).eq("token", token);
}

export async function saveAnonymousAssessment(
  token: string,
  editedFields: PcnExtraction,
  assessment: AppealAssessment
): Promise<void> {
  const admin = getSupabaseAdminClient();
  await admin
    .from("anonymous_drafts")
    .update({
      edited_fields_json: editedFields,
      ai_strength_rating: assessment.strength,
      ai_grounds_json: assessment.applicableGrounds,
      ai_reasoning_text: assessment.reasoningText,
      draft_text: assessment.draftText,
    })
    .eq("token", token);
}

/** Turns a claimed draft into the real thing: a verified vehicle (if one
 * doesn't already exist for this VRM under this user), a case, an appeal
 * with the assessment already computed, and an evidence row for the
 * photo — moved out of the anonymous staging path into the same
 * {vehicleId}/{filename} convention every other upload uses. Returns the
 * new case id, or null if the token is invalid/expired/already claimed
 * (the route calling this treats that as "nothing to claim", not an
 * error — a user can always just use the app normally instead). */
export async function claimAnonymousDraft(
  userSupabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").getSupabaseServerClient>>,
  token: string,
  userId: string
): Promise<string | null> {
  const admin = getSupabaseAdminClient();

  const { data: draft } = await admin
    .from("anonymous_drafts")
    .select("*")
    .eq("token", token)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!draft) return null;

  const fields = (draft.edited_fields_json ?? draft.extraction_json) as PcnExtraction | null;
  if (!fields) return null;

  const vrm = normalizeVrm(fields.vrm ?? "");
  if (!vrm) return null;

  // Reuse an existing vehicle for this VRM if the user already added one
  // (e.g. they tried the flow, abandoned it, then added the vehicle
  // properly before coming back) — otherwise create it self-attested,
  // per "verification optional for individuals": no document required,
  // marked verified immediately. Fleet/organisation vehicles still go
  // through the existing document-based flow untouched.
  const { data: existingVehicle } = await userSupabase
    .from("vehicles")
    .select("id")
    .eq("owner_type", "individual")
    .eq("owner_user_id", userId)
    .eq("vrm", vrm)
    .maybeSingle();

  let vehicleId = existingVehicle?.id as string | undefined;
  if (!vehicleId) {
    const { data: newVehicle, error: vehicleError } = await userSupabase
      .from("vehicles")
      .insert({
        vrm,
        owner_type: "individual",
        owner_user_id: userId,
        created_by: userId,
        ownership_verification_status: "verified",
        ownership_verification_method: "self_attested_no_document",
      })
      .select("id")
      .single();
    if (vehicleError || !newVehicle) return null;
    vehicleId = newVehicle.id;
  }

  const newPath = `${vehicleId}/${Date.now()}-${draft.image_storage_path.split("/").pop()}`;
  await admin.storage.from("case-evidence").move(draft.image_storage_path, newPath);

  const { data: caseRow, error: caseError } = await userSupabase
    .from("cases")
    .insert({
      vehicle_id: vehicleId,
      source: "manual_upload",
      status: "reviewing",
      issuer_name: fields.issuerName,
      issuer_type: fields.issuerType,
      reference_number: fields.referenceNumber,
      contravention_code: fields.contraventionCode,
      contravention_description: fields.contraventionDescription,
      location_text: fields.locationText,
      event_datetime: fields.eventDatetime,
      notice_date: fields.noticeDate,
      amount_full: fields.amountFull,
      amount_discounted: fields.amountDiscounted,
      discount_deadline: fields.discountDeadline,
      final_deadline: fields.finalDeadline,
      raw_ocr_json: fields,
      created_by: userId,
      details_confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (caseError || !caseRow) return null;

  await userSupabase.from("evidence").insert({
    case_id: caseRow.id,
    file_ref: newPath,
    evidence_type: "ticket_photo",
    uploaded_by: userId,
  });

  if (draft.draft_text) {
    await userSupabase.from("appeals").upsert(
      {
        case_id: caseRow.id,
        ai_strength_rating: draft.ai_strength_rating,
        ai_grounds_json: draft.ai_grounds_json,
        ai_reasoning_text: draft.ai_reasoning_text,
        draft_text: draft.draft_text,
        created_by: userId,
      },
      { onConflict: "case_id" }
    );
    await userSupabase.from("cases").update({ status: "appealing" }).eq("id", caseRow.id);
  }

  await admin.from("anonymous_drafts").update({ claimed_at: new Date().toISOString(), claimed_by: userId }).eq("token", token);

  return caseRow.id;
}
