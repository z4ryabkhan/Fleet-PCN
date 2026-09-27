"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeVrm } from "@/lib/vrm";
import { lookupVehicleVes } from "@/lib/dvla";
import { syncFleetVehicleCountBilling } from "@/lib/billing";

export type VehicleActionState = { error: string } | { success: string } | undefined;

async function applyVesLookup(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  vehicleId: string,
  vrm: string
) {
  const ves = await lookupVehicleVes(vrm);
  if (!ves) return;

  await supabase
    .from("vehicles")
    .update({
      make: ves.make,
      colour: ves.colour,
      tax_status: ves.taxStatus,
      mot_status: ves.motStatus,
      year_of_manufacture: ves.yearOfManufacture,
      ves_looked_up_at: new Date().toISOString(),
    })
    .eq("id", vehicleId);
}

// Self-attested for v1: there is no reviewer/admin-approval role or queue
// anywhere in the master plan's feature list, so verification is marked
// "verified" immediately rather than left stuck at "pending" forever.
//
// UI review item 1: the document is now optional for individuals —
// verification happens either way (self-attested), a document just gets
// attached as extra backing if the person has one handy. This removes the
// friction the review flagged; fleet/organisation vehicles are untouched
// and still go through submitOrgVerificationAction's document-required
// flow, since liability transfer for a fleet has real stakes a self-attest
// doesn't cover. Revisit the individual side too if fraud becomes a real
// concern.
export async function addIndividualVehicleAction(
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const vrm = normalizeVrm(String(formData.get("vrm") || ""));
  const documentType = String(formData.get("documentType") || "");
  const file = formData.get("document") as File | null;

  if (!vrm) return { error: "Please enter a registration number." };

  let path: string | null = null;
  if (file && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      return { error: "File is too large (max 10MB)." };
    }
    path = `individual/${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("verification-documents")
      .upload(path, file);
    if (uploadError) {
      return { error: "Could not upload your document. Please try again." };
    }
  }

  const { data: vehicle, error: insertError } = await supabase
    .from("vehicles")
    .insert({
      vrm,
      owner_type: "individual",
      owner_user_id: user.id,
      created_by: user.id,
      ownership_verification_status: "verified",
      ownership_verification_method: path ? documentType || "other" : "self_attested_no_document",
      ownership_doc_ref: path,
    })
    .select("id")
    .single();

  if (insertError || !vehicle) {
    return {
      error: insertError?.code === "23505" ? "You've already added that vehicle." : "Could not add vehicle.",
    };
  }

  await applyVesLookup(supabase, vehicle.id, vrm);

  revalidatePath("/dashboard/vehicles");
  return { success: `${vrm} added.` };
}

// CSV parsing here is intentionally simple (split on newlines/commas, first
// column = VRM) rather than pulling in a CSV library — fleet VRM lists are
// simple single- or first-column data, and this covers that without
// over-building a general-purpose parser.
export async function importFleetVehiclesCsvAction(
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  const organisationId = memberships?.[0]?.organisation_id;
  if (!organisationId) return { error: "Only fleet admins can import vehicles." };

  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) return { error: "Please upload a CSV file." };

  const text = await file.text();
  const lines = text.split(/\r?\n/);
  // Real UK VRMs always contain a digit; a header row ("VRM,Notes") doesn't,
  // so drop a headerless-looking first line rather than importing it as data.
  const firstCell = normalizeVrm(lines[0]?.split(",")[0] || "");
  if (firstCell && !/\d/.test(firstCell)) {
    lines.shift();
  }
  const vrms = Array.from(
    new Set(
      lines
        .map((line) => normalizeVrm(line.split(",")[0] || ""))
        .filter(Boolean)
    )
  ).slice(0, 200);

  if (vrms.length === 0) return { error: "No registration numbers found in that file." };

  const { data: inserted, error: insertError } = await supabase
    .from("vehicles")
    .upsert(
      vrms.map((vrm) => ({
        vrm,
        owner_type: "organisation" as const,
        owner_organisation_id: organisationId,
        created_by: user.id,
      })),
      { onConflict: "owner_organisation_id,vrm", ignoreDuplicates: true }
    )
    .select("id, vrm");

  if (insertError) {
    return { error: "Could not import vehicles. Please check the file and try again." };
  }

  // Best-effort cosmetic lookup per vehicle. Sequential and capped — fine
  // for a first import; a large fleet's re-imports should move to a
  // background job (Part 6 already earmarks Edge Functions + pg_cron for
  // this kind of work) rather than block the request.
  for (const v of inserted ?? []) {
    await applyVesLookup(supabase, v.id, v.vrm);
  }

  await syncFleetVehicleCountBilling(getSupabaseAdminClient(), organisationId);

  revalidatePath("/dashboard/vehicles");
  return { success: `Imported ${inserted?.length ?? 0} vehicle(s).` };
}

// Authorization is the existing "owners and org admins can update their
// vehicles" RLS policy (0005) — an admin can already update any column on
// their org's vehicles, this is nothing new there. What IS new here:
// enforce_assigned_driver_is_org_member() (0025) rejects the update at
// the database level if driverUserId isn't actually a member of the
// vehicle's organisation — this action doesn't need to (and shouldn't)
// duplicate that check, just surface the DB's rejection as a friendly
// error if it happens.
export async function assignVehicleDriverAction(
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const vehicleId = String(formData.get("vehicleId") || "");
  const driverUserId = String(formData.get("driverUserId") || "");

  const { error } = await supabase
    .from("vehicles")
    .update({ assigned_driver_user_id: driverUserId || null })
    .eq("id", vehicleId);

  if (error) return { error: "Could not update the assigned driver. Please try again." };

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/cases");
  return { success: "Driver updated." };
}

// Companies House lookup isn't wired yet (no API key) — company_number is
// captured as-entered for now and the lookup call added later without a
// schema change.
export async function submitOrgVerificationAction(
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organisation_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  const organisationId = memberships?.[0]?.organisation_id;
  if (!organisationId) return { error: "Only fleet admins can submit verification." };

  const companiesHouseNumber = String(formData.get("companiesHouseNumber") || "").trim();
  const documentType = String(formData.get("documentType") || "");
  const file = formData.get("document") as File | null;

  if (!companiesHouseNumber) return { error: "Please enter your Companies House number." };
  if (!["fleet_insurance_schedule", "lease_agreements", "director_attestation"].includes(documentType)) {
    return { error: "Please choose a document type." };
  }
  if (!file || file.size === 0) return { error: "Please upload a document." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large (max 10MB)." };

  const path = `organisation/${organisationId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("verification-documents")
    .upload(path, file, { upsert: true });

  if (uploadError) return { error: "Could not upload your document. Please try again." };

  const { error: updateError } = await supabase
    .from("organisations")
    .update({
      companies_house_number: companiesHouseNumber,
      verification_method: documentType,
      verification_doc_ref: path,
      verification_status: "verified",
      verified_at: new Date().toISOString(),
    })
    .eq("id", organisationId);

  if (updateError) return { error: "Could not save verification. Please try again." };

  revalidatePath("/dashboard/vehicles");
  return { success: "Fleet verified." };
}

// Build brief Phase 4: logging who had a fleet/rental vehicle and when, so
// compute_case_route() (0043) can match a PCN's event date to a hire and
// route it to transfer_liability instead of an appeal. Only org admins can
// add these — hirer name/email/address is personal data about someone who
// has never signed up to Planal.
export async function addHireRecordAction(
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organisation_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  const organisationId = memberships?.[0]?.organisation_id;
  if (!organisationId) return { error: "Only fleet admins can log hire records." };

  const vehicleId = String(formData.get("vehicleId") || "");
  const hirerName = String(formData.get("hirerName") || "").trim();
  const hirerEmail = String(formData.get("hirerEmail") || "").trim();
  const hirerAddress = String(formData.get("hirerAddress") || "").trim();
  const startAt = String(formData.get("startAt") || "").trim();
  const endAt = String(formData.get("endAt") || "").trim();
  const file = formData.get("agreement") as File | null;

  if (!vehicleId) return { error: "Please choose a vehicle." };
  if (!hirerName) return { error: "Please enter the hirer's name." };
  if (!hirerAddress) return { error: "Please enter the hirer's address — it goes on the transfer letter." };
  if (!startAt || !endAt) return { error: "Please enter both hire dates." };
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return { error: "The end date must be after the start date." };
  }

  let agreementFilePath: string | null = null;
  if (file && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return { error: "Agreement file is too large (max 10MB)." };
    agreementFilePath = `${organisationId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("hire-agreements")
      .upload(agreementFilePath, file);
    if (uploadError) return { error: "Could not upload the hire agreement. Please try again." };
  }

  const { error: insertError } = await supabase.from("hire_records").insert({
    organisation_id: organisationId,
    vehicle_id: vehicleId,
    hirer_name: hirerName,
    hirer_email: hirerEmail || null,
    hirer_address: hirerAddress,
    start_at: new Date(startAt).toISOString(),
    end_at: new Date(endAt).toISOString(),
    agreement_file_path: agreementFilePath,
    created_by: user.id,
  });

  if (insertError) return { error: "Could not save this hire record. Please try again." };

  revalidatePath("/dashboard/vehicles");
  return { success: `Hire record added for ${hirerName}.` };
}

export async function deleteHireRecordAction(
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const hireRecordId = String(formData.get("hireRecordId") || "");
  const { error } = await supabase.from("hire_records").delete().eq("id", hireRecordId);
  if (error) return { error: "Could not delete this hire record." };

  revalidatePath("/dashboard/vehicles");
  return { success: "Hire record removed." };
}

// The only way to create a case for an organisation-owned vehicle from the
// dashboard today (email_auto via scan-mailboxes is the other). No OCR here
// — a fleet admin types in what the notice says. compute_case_route() (0043)
// fires on this insert exactly as it does on scan-mailboxes' insert.
export async function reportFleetTicketAction(
  _prevState: VehicleActionState,
  formData: FormData
): Promise<VehicleActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organisation_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  const organisationId = memberships?.[0]?.organisation_id;
  if (!organisationId) return { error: "Only fleet admins can report a ticket." };

  const vehicleId = String(formData.get("vehicleId") || "");
  const issuerName = String(formData.get("issuerName") || "").trim();
  const issuerType = String(formData.get("issuerType") || "") || null;
  const referenceNumber = String(formData.get("referenceNumber") || "").trim() || null;
  const locationText = String(formData.get("locationText") || "").trim() || null;
  const eventDatetime = String(formData.get("eventDatetime") || "").trim();
  const amountFullRaw = String(formData.get("amountFull") || "").trim();
  const amountFull = amountFullRaw ? Number(amountFullRaw) : null;

  if (!vehicleId) return { error: "Please choose a vehicle." };
  if (!issuerName) return { error: "Please enter who issued the notice." };
  if (!eventDatetime) return { error: "Please enter the date of the contravention." };
  if (amountFull !== null && (!Number.isFinite(amountFull) || amountFull < 0)) {
    return { error: "Amount must be a number, e.g. 70." };
  }

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("owner_organisation_id", organisationId)
    .maybeSingle();
  if (!vehicle) return { error: "That vehicle isn't in your fleet." };

  const { data: caseRow, error: insertError } = await supabase
    .from("cases")
    .insert({
      vehicle_id: vehicleId,
      source: "manual_upload",
      status: "reviewing",
      issuer_name: issuerName,
      issuer_type: issuerType,
      reference_number: referenceNumber,
      location_text: locationText,
      event_datetime: new Date(eventDatetime).toISOString(),
      amount_full: amountFull,
      created_by: user.id,
      details_confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !caseRow) return { error: "Could not save this ticket. Please try again." };

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/cases");
  return { success: "Ticket reported — see it on the Cases page." };
}
