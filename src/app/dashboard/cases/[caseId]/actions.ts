"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAccountProvisioned } from "@/lib/account";
import { assessAppeal } from "@/lib/appeal";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshGoogleAccessToken, GMAIL_COMPOSE_SCOPE } from "@/lib/google-oauth";
import { createGmailAppealDraft } from "@/lib/gmail-drafts";
import {
  getOrCreateBillingAccount,
  createIndividualCaseCheckoutSession,
  addFleetPerCaseCharge,
} from "@/lib/billing";
import { PRICE_INDIVIDUAL_PER_CASE, getStripeClient } from "@/lib/stripe";

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

// Individuals pay per case to unlock this (Part 2.2 step 5/6); fleets pay
// recurring and are never blocked here — see addFleetPerCaseCharge's doc.
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

  const { organisation } = await ensureAccountProvisioned(supabase, user);

  if (!organisation) {
    const { data: paidCharge } = await supabase
      .from("case_charges")
      .select("id")
      .eq("case_id", caseId)
      .eq("charge_type", "individual_per_case")
      .eq("status", "paid")
      .maybeSingle();

    if (!paidCharge) {
      return { error: "This case needs to be paid for before it can be assessed." };
    }
  }

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

  if (organisation) {
    const admin = getSupabaseAdminClient();
    await addFleetPerCaseCharge(admin, organisation.id, caseId);
  }

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: "Assessment complete — review the draft below." };
}

// Individuals only — creates a pending case_charges row and redirects to
// Stripe Checkout. The webhook (or, as a fallback, the success-page
// verification below) is what actually flips it to 'paid'; this action
// never marks a charge paid itself.
export async function startIndividualCasePaymentAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");

  if (!getStripeClient() || !PRICE_INDIVIDUAL_PER_CASE) {
    return { error: "Payments aren't set up yet — the Stripe API key hasn't been configured." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("id", user.id)
    .single();

  const admin = getSupabaseAdminClient();
  const account = await getOrCreateBillingAccount(admin, {
    ownerType: "individual",
    ownerId: user.id,
    email: profile?.email ?? user.email ?? "",
    name: profile?.full_name ?? "",
  });

  if (!account) {
    return { error: "Could not set up billing. Please try again." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = await createIndividualCaseCheckoutSession(
    admin,
    account.stripeCustomerId,
    caseId,
    `${appUrl}/api/billing/confirm-case-payment?case_id=${caseId}&session_id={CHECKOUT_SESSION_ID}`,
    `${appUrl}/dashboard/cases/${caseId}?paid=0`
  );

  if (!url) {
    return { error: "Could not start checkout. Please try again." };
  }

  redirect(url);
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

// Pushes the current appeal draft into the user's own Gmail as a real,
// unsent draft — added per Zaryab's explicit request (2026-09-08). Still
// never auto-submits anything (Part 9 rule 2): src/lib/gmail-drafts.ts
// only ever calls drafts.create, and the recipient is left blank since
// Planal has no reliable directory of per-issuer appeal email addresses
// (and many UK appeals go through a web portal, not email, at all) —
// the user fills in who it's actually going to themselves, in Gmail,
// before sending. Individual accounts only for now, matching how this
// was asked for; fleet accounts don't get this button yet.
export async function createGmailDraftAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");

  const { data: caseRow } = await supabase
    .from("cases")
    .select("issuer_name, reference_number, vehicles(vrm)")
    .eq("id", caseId)
    .single();
  if (!caseRow) return { error: "Case not found." };

  const { data: appeal } = await supabase
    .from("appeals")
    .select("draft_text, user_edited_text")
    .eq("case_id", caseId)
    .maybeSingle();

  const bodyText = appeal?.user_edited_text ?? appeal?.draft_text;
  if (!bodyText) return { error: "Assess the case and get a draft first." };

  const { data: connection } = await supabase
    .from("email_connections")
    .select("id, encrypted_access_token, encrypted_refresh_token, token_expires_at, scopes")
    .eq("owner_type", "individual")
    .eq("owner_user_id", user.id)
    .eq("provider", "gmail")
    .eq("status", "connected")
    .maybeSingle();

  if (!connection) {
    return { error: "Connect Gmail first, from the Connected email page." };
  }
  if (!connection.scopes?.includes(GMAIL_COMPOSE_SCOPE)) {
    return {
      error:
        "Your Gmail connection needs to be renewed to allow creating drafts — revoke it and reconnect from the Connected email page.",
    };
  }

  let accessToken = decryptToken(connection.encrypted_access_token);
  if (new Date(connection.token_expires_at).getTime() - Date.now() < 5 * 60_000) {
    try {
      const refreshToken = decryptToken(connection.encrypted_refresh_token);
      const refreshed = await refreshGoogleAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      await supabase
        .from("email_connections")
        .update({
          encrypted_access_token: encryptToken(refreshed.accessToken),
          token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        })
        .eq("id", connection.id);
    } catch (err) {
      console.error("Failed to refresh Google access token", err);
      return { error: "Your Gmail connection has expired. Please reconnect it." };
    }
  }

  const vehicle = caseRow.vehicles as unknown as { vrm: string } | null;
  const subject = `PCN appeal — ${vehicle?.vrm ?? ""} — ${caseRow.issuer_name ?? "issuer"}${
    caseRow.reference_number ? ` — ref ${caseRow.reference_number}` : ""
  }`;

  const draft = await createGmailAppealDraft(accessToken, { subject, bodyText });
  if (!draft) {
    return { error: "Could not create the Gmail draft. Please try again." };
  }

  await supabase.rpc("log_gmail_draft_created", { p_case_id: caseId });

  return { success: "Draft created in your Gmail — check your Drafts folder, add the recipient, and send when you're ready." };
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

// Part 2.2 individual journey step 4 promises paying the fine as the
// alternative to appealing it; nothing in the app could previously record
// that a user chose to pay it themselves, off-platform (Planal is never
// merchant of record for the fine itself — Part 2.2 step 4 again — so
// this only ever updates Planal's own record, same "never touches a
// third-party system" posture as confirmAppealAction). Cancels any
// not-yet-sent reminders for the case, since there's no deadline left to
// remind anyone about once it's paid; already-sent ones are left alone as
// a record of what went out, same reasoning regenerate_case_reminders()
// (0012) already uses for deadline changes.
export async function markCasePaidAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");

  const { error } = await supabase
    .from("cases")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", caseId);
  if (error) return { error: "Could not update the case. Please try again." };

  const admin = getSupabaseAdminClient();
  await admin.from("reminders").delete().eq("case_id", caseId).is("sent_at", null);

  revalidatePath(`/dashboard/cases/${caseId}`);
  revalidatePath("/dashboard/cases");
  return { success: "Marked as paid. Reminders for this case are cancelled." };
}

// Mirrors supabase/migrations/0010_cases_and_evidence.sql's issuer_type
// check constraint — keep in sync (same duplication this codebase
// already accepts elsewhere, e.g. src/lib/deadlines.ts and
// scan-mailboxes/index.ts).
const CASE_ISSUER_TYPES = [
  "council_pcn",
  "tfl_pcn",
  "congestion_charge",
  "ulez",
  "dart_charge",
  "private_pcn",
  "bus_lane",
  "moving_traffic",
] as const;

// addManualCaseAction's own success message says "add the details
// manually" whenever OCR doesn't return an extraction (no API key
// configured, or the notice just wasn't legible) — but until this
// action existed, there was no form anywhere to actually do that. Same
// RLS as every other case update (0005/0010's "vehicle owners and org
// admins can update cases"), no new authorization needed.
export async function updateCaseDetailsAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");

  const issuerType = String(formData.get("issuerType") || "");
  if (issuerType && !CASE_ISSUER_TYPES.includes(issuerType as (typeof CASE_ISSUER_TYPES)[number])) {
    return { error: "Invalid issuer type." };
  }

  const parseMoney = (raw: FormDataEntryValue | null): number | null => {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const amountFull = parseMoney(formData.get("amountFull"));
  const amountDiscounted = parseMoney(formData.get("amountDiscounted"));
  if (Number.isNaN(amountFull) || Number.isNaN(amountDiscounted)) {
    return { error: "Amounts must be numbers, e.g. 70 or 35.50." };
  }

  const parseDate = (raw: FormDataEntryValue | null): string | null => {
    const s = String(raw ?? "").trim();
    return s || null;
  };

  const update: Record<string, unknown> = {
    issuer_name: String(formData.get("issuerName") || "").trim() || null,
    issuer_type: issuerType || null,
    reference_number: String(formData.get("referenceNumber") || "").trim() || null,
    contravention_code: String(formData.get("contraventionCode") || "").trim() || null,
    contravention_description: String(formData.get("contraventionDescription") || "").trim() || null,
    location_text: String(formData.get("locationText") || "").trim() || null,
    amount_full: amountFull,
    amount_discounted: amountDiscounted,
    discount_deadline: parseDate(formData.get("discountDeadline")),
    final_deadline: parseDate(formData.get("finalDeadline")),
  };

  // Only ever advances 'new' (nothing filled in yet) to 'reviewing' —
  // never touches status on a case that's already further along
  // (appealing/paid/appealed/closed), so correcting a typo after the
  // fact can't accidentally reopen a settled case.
  const { data: current } = await supabase.from("cases").select("status").eq("id", caseId).single();
  if (current?.status === "new") update.status = "reviewing";

  const { error } = await supabase.from("cases").update(update).eq("id", caseId);

  if (error) return { error: "Could not save these details. Please try again." };

  revalidatePath(`/dashboard/cases/${caseId}`);
  revalidatePath("/dashboard/cases");
  return { success: "Details saved." };
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
  const mayContainSpecialCategoryData = formData.get("mayContainSpecialCategoryData") === "true";
  const specialCategoryConsent = formData.get("specialCategoryConsent") === "true";

  if (!["receipt", "permit", "blue_badge", "breakdown_doc", "other"].includes(evidenceType)) {
    return { error: "Please choose an evidence type." };
  }
  if (!file || file.size === 0) return { error: "Please choose a file." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large (max 10MB)." };
  // DPIA §2.2/§3: health information disclosed as mitigating-circumstances
  // evidence is special-category data — explicit consent (Article 9(2)(a))
  // is required in the same step, and the DB constraint backs this up.
  if (mayContainSpecialCategoryData && !specialCategoryConsent) {
    return { error: "Please confirm consent to processing this health information." };
  }

  const path = `${vehicleId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("case-evidence").upload(path, file);
  if (uploadError) return { error: "Could not upload the file." };

  const { error: insertError } = await supabase.from("evidence").insert({
    case_id: caseId,
    file_ref: path,
    evidence_type: evidenceType,
    uploaded_by: user.id,
    may_contain_special_category_data: mayContainSpecialCategoryData,
    special_category_consent_at: mayContainSpecialCategoryData ? new Date().toISOString() : null,
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
