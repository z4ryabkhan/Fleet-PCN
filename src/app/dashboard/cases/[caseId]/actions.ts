"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureAccountProvisioned } from "@/lib/account";
import { assessAppeal } from "@/lib/appeal";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshGoogleAccessToken, GMAIL_COMPOSE_SCOPE } from "@/lib/google-oauth";
import { refreshMicrosoftAccessToken, GRAPH_MAIL_SEND_SCOPE } from "@/lib/microsoft-oauth";
import { createGmailAppealDraft } from "@/lib/gmail-drafts";
import { sendGmailAppeal, type EmailAttachment } from "@/lib/gmail-send";
import { sendOutlookAppeal } from "@/lib/outlook-send";
import {
  getOrCreateBillingAccount,
  createIndividualCaseCheckoutSession,
  addFleetPerCaseCharge,
  chargeCaseOnWin,
  waiveCaseCharge,
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

// UI review items 1/4: assessment now runs free for everyone, automatically,
// right after Check Details is confirmed (see AutoAssess.tsx) — the
// individual-per-case charge moved from gating this to gating the actual
// send (sendAppealAction below), matching "ask for sign-up and payment
// only at Send". Fleets were never gated here either way — they pay
// recurring, per addFleetPerCaseCharge's own doc, added below regardless.
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

// Actually sends the appeal — build brief section 3 step 6. Superseded
// confirmAppealAction's mark-only behaviour once Zaryab confirmed
// (2026-09) that clicking Send is itself the Part 9 rule 2 confirmation
// this needs, for both the individual and fleet paths (createGmailDraftAction
// stays individual-only, but sending isn't limited to that). The recipient
// is always either typed by the user or read from a verified issuers row —
// never guessed — and a failed send is never reported as sent.
export async function sendAppealAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");
  const to = String(formData.get("to") || "").trim();
  if (!to || !to.includes("@")) return { error: "Enter a valid recipient email address." };

  // UI review items 1/5: payment gates the send, not the assessment —
  // fleets pay recurring (never gated here). No-win-no-fee (2026-09-24):
  // individuals only need a card on file ('authorized') to send — they're
  // not actually charged until/unless the appeal is later marked Won.
  const { organisation } = await ensureAccountProvisioned(supabase, user);
  if (!organisation) {
    const { data: authorizedCharge } = await supabase
      .from("case_charges")
      .select("id")
      .eq("case_id", caseId)
      .eq("charge_type", "individual_per_case")
      .in("status", ["authorized", "paid"])
      .maybeSingle();
    if (!authorizedCharge) {
      return { error: "Save a card to send this appeal first — you're only charged if you win." };
    }
  }

  const { data: caseRow } = await supabase
    .from("cases")
    .select("issuer_name, reference_number, vehicle_id, vehicles(vrm, owner_type, owner_user_id, owner_organisation_id)")
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

  const vehicle = caseRow.vehicles as unknown as {
    vrm: string;
    owner_type: "individual" | "organisation";
    owner_user_id: string | null;
    owner_organisation_id: string | null;
  } | null;
  if (!vehicle) return { error: "Case has no vehicle." };

  const { data: connection } = await supabase
    .from("email_connections")
    .select("id, provider, encrypted_access_token, encrypted_refresh_token, token_expires_at, scopes")
    .eq("owner_type", vehicle.owner_type)
    .eq(
      vehicle.owner_type === "individual" ? "owner_user_id" : "owner_organisation_id",
      vehicle.owner_type === "individual" ? vehicle.owner_user_id : vehicle.owner_organisation_id
    )
    .eq("status", "connected")
    .maybeSingle();

  if (!connection) {
    return { error: "Connect Gmail or Outlook first, from the Connected email page." };
  }

  const requiredScope = connection.provider === "gmail" ? GMAIL_COMPOSE_SCOPE : GRAPH_MAIL_SEND_SCOPE;
  if (!connection.scopes?.includes(requiredScope)) {
    return {
      error: `Your ${connection.provider === "gmail" ? "Gmail" : "Outlook"} connection needs to be renewed to allow sending — revoke it and reconnect from the Connected email page.`,
    };
  }

  let accessToken = decryptToken(connection.encrypted_access_token);
  if (new Date(connection.token_expires_at).getTime() - Date.now() < 5 * 60_000) {
    try {
      const refreshToken = decryptToken(connection.encrypted_refresh_token);
      if (connection.provider === "gmail") {
        const refreshed = await refreshGoogleAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        await supabase
          .from("email_connections")
          .update({
            encrypted_access_token: encryptToken(refreshed.accessToken),
            token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          })
          .eq("id", connection.id);
      } else {
        const refreshed = await refreshMicrosoftAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        await supabase
          .from("email_connections")
          .update({
            encrypted_access_token: encryptToken(refreshed.accessToken),
            encrypted_refresh_token: encryptToken(refreshed.refreshToken),
            token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          })
          .eq("id", connection.id);
      }
    } catch (err) {
      console.error("Failed to refresh email access token", err);
      return { error: "Your email connection has expired. Please reconnect it." };
    }
  }

  const { data: evidenceRows } = await supabase
    .from("evidence")
    .select("file_ref")
    .eq("case_id", caseId)
    .order("uploaded_at", { ascending: true });

  const attachments: EmailAttachment[] = [];
  for (const row of evidenceRows ?? []) {
    const { data: blob, error } = await supabase.storage.from("case-evidence").download(row.file_ref);
    if (error || !blob) continue;
    const ext = row.file_ref.toLowerCase().split(".").pop() ?? "";
    const mimeType = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
    attachments.push({
      filename: row.file_ref.split("/").pop() ?? "evidence",
      mimeType,
      data: Buffer.from(await blob.arrayBuffer()),
    });
  }

  const subject = `PCN appeal — ${vehicle.vrm} — ${caseRow.issuer_name ?? "issuer"}${
    caseRow.reference_number ? ` — ref ${caseRow.reference_number}` : ""
  }`;

  const sent =
    connection.provider === "gmail"
      ? await sendGmailAppeal(accessToken, { to, subject, bodyText, attachments })
      : (await sendOutlookAppeal(accessToken, { to, subject, bodyText, attachments })) ? {} : null;

  if (!sent) {
    return { error: "Could not send the email. Please try again, or use the PDF pack instead." };
  }

  const { error: appealError } = await supabase
    .from("appeals")
    .update({
      user_confirmed_at: new Date().toISOString(),
      outcome: "pending",
      sent_to_email: to,
      send_method: connection.provider,
    })
    .eq("case_id", caseId);
  if (appealError) return { error: "Sent, but could not update the case record. Please refresh." };

  await supabase.from("cases").update({ status: "appealed" }).eq("id", caseId);

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: `Sent to ${to}.` };
}

// Covers issuers whose appeal_channel is 'portal' or 'post' — the app
// can't submit anything on the user's behalf there (no email API to call),
// so this only ever marks the case as submitted once the user tells us
// they've done it themselves elsewhere.
//
// Deliberately free, unlike sendAppealAction: charging the same price for
// "here's a draft, go paste it in yourself" as for "we actually sent it"
// overcharges for less work (Zaryab, 2026-09-24) — individuals only ever
// pay when Planal itself performs the send. Still needed regardless of
// price: without this action, portal/post cases had no way to ever leave
// the "appeal ready" state, so deadline tracking and outcome capture
// silently never kicked in for them.
export async function confirmManualAppealSubmissionAction(
  _prevState: CaseDetailActionState,
  formData: FormData
): Promise<CaseDetailActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const caseId = String(formData.get("caseId") || "");

  const { data: appeal } = await supabase
    .from("appeals")
    .select("draft_text, user_edited_text")
    .eq("case_id", caseId)
    .maybeSingle();
  if (!appeal?.draft_text && !appeal?.user_edited_text) {
    return { error: "Assess the case and get a draft first." };
  }

  const { error: appealError } = await supabase
    .from("appeals")
    .update({
      user_confirmed_at: new Date().toISOString(),
      outcome: "pending",
      send_method: "manual",
    })
    .eq("case_id", caseId);
  if (appealError) return { error: "Could not update the case record. Please refresh." };

  await supabase.from("cases").update({ status: "appealed" }).eq("id", caseId);

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: "Marked as submitted." };
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

// No-win-no-fee (2026-09-24): this is the one moment an individual is
// ever actually charged. Won triggers the off-session charge against the
// card saved at send time; Lost releases it, charging nothing. Fleets
// never have an individual_per_case charge row to act on here (they pay
// recurring instead), so chargeCaseOnWin/waiveCaseCharge just no-op for
// them.
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

  const { organisation } = await ensureAccountProvisioned(supabase, user);
  if (!organisation) {
    const admin = getSupabaseAdminClient();
    if (outcome === "won") {
      await chargeCaseOnWin(admin, caseId);
    } else {
      await waiveCaseCharge(admin, caseId);
    }
  }

  revalidatePath(`/dashboard/cases/${caseId}`);
  return { success: "Outcome recorded." };
}
