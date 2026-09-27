"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractPcnFromFile, type PcnExtraction } from "@/lib/ocr";
import { assessAppeal } from "@/lib/appeal";
import {
  checkAndRecordAnonymousUsage,
  createAnonymousDraft,
  getAnonymousDraft,
  saveAnonymousAssessment,
  saveAnonymousReason,
  updateAnonymousDraftFields,
  claimAnonymousDraft,
} from "@/lib/anonymous-draft";
import type { AppealReasonCode } from "@/lib/appeal-reasons";

export type StartDraftResult =
  | { error: string }
  | { token: string; thumbnailUrl: string | null; extraction: PcnExtraction };

/** UI review item 1: the anonymous capture step. No auth, no case, no
 * vehicle — just an extraction held in anonymous_drafts until the person
 * decides to send. Rate-limited per IP (checkAndRecordAnonymousUsage) since
 * this is the one anonymous action that costs real money with nothing else
 * gating it. */
export async function startAnonymousDraftAction(formData: FormData): Promise<StartDraftResult> {
  const file = formData.get("ticket") as File | null;
  if (!file || file.size === 0) return { error: "Please choose a photo or PDF of the ticket." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large (max 10MB)." };
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return { error: "Please use a photo (JPEG/PNG/WEBP/GIF) or a PDF." };
  }

  const forwardedFor = (await headers()).get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const usage = await checkAndRecordAnonymousUsage(ip);
  if (!usage.allowed) {
    return { error: "You've tried a lot of tickets today — sign up free to keep going." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extraction = await extractPcnFromFile(buffer, file.type);
  if (!extraction) {
    return { error: "Couldn't read this ticket automatically — try a clearer photo, or sign up and add the details yourself." };
  }

  const { token, thumbnailUrl } = await createAnonymousDraft({
    imageBytes: buffer,
    mimeType: file.type,
    filename: file.name,
    extraction,
  });

  return { token, thumbnailUrl, extraction };
}

export type AssessDraftResult = { error: string } | { assessment: NonNullable<Awaited<ReturnType<typeof assessAppeal>>> };

/** UI review item 4: runs automatically once the visitor confirms Check
 * Details and picks a reason, on the same stateless draft — still nothing
 * written to `cases` yet. The stated reason is what the user says
 * happened; assessAppeal treats it as an input to ground the draft in,
 * never as a fact it invents evidence for. */
export async function runAnonymousAssessmentAction(
  token: string,
  editedFields: PcnExtraction,
  userStatedReason: AppealReasonCode,
  userReasonDetails: string | null
): Promise<AssessDraftResult> {
  const draft = await getAnonymousDraft(token);
  if (!draft) return { error: "This session has expired — please start again." };

  await saveAnonymousReason(token, userStatedReason, userReasonDetails);

  const assessment = await assessAppeal({
    issuerType: editedFields.issuerType,
    issuerName: editedFields.issuerName,
    referenceNumber: editedFields.referenceNumber,
    contraventionCode: editedFields.contraventionCode,
    locationText: editedFields.locationText,
    eventDatetime: editedFields.eventDatetime,
    amountFull: editedFields.amountFull,
    amountDiscounted: editedFields.amountDiscounted,
    vrm: editedFields.vrm ?? "",
    evidenceTypes: ["ticket_photo"],
    userStatedReason,
    userReasonDetails,
  });

  if (!assessment) return { error: "AI appeal assessment isn't available right now — please try again shortly." };

  await saveAnonymousAssessment(token, editedFields, assessment);
  return { assessment };
}

/** Only reachable from an already-authenticated session (TryFlow checks
 * isAuthenticated before ever calling this) — an already-signed-up person
 * doesn't need the pre-signup preview at all, so this claims straight into
 * a real case and sends them to it. Anonymous visitors go through
 * /signup?draft=... instead — see src/app/signup/actions.ts. The reason is
 * saved onto the draft first so claimAnonymousDraft picks it up the same
 * way it would for an anonymous claim, one code path either way. */
export async function confirmAsAuthenticatedUserAction(
  token: string,
  editedFields: PcnExtraction,
  userStatedReason: AppealReasonCode,
  userReasonDetails: string | null
): Promise<{ error: string } | never> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — please sign in again." };

  await updateAnonymousDraftFields(token, editedFields);
  await saveAnonymousReason(token, userStatedReason, userReasonDetails);
  const caseId = await claimAnonymousDraft(supabase, token, user.id);
  if (!caseId) return { error: "This session has expired — please start again from the ticket photo." };

  redirect(`/dashboard/cases/${caseId}`);
}
