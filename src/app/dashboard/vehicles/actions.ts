"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeVrm } from "@/lib/vrm";
import { lookupVehicleVes } from "@/lib/dvla";

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
// "verified" as soon as a document is uploaded rather than left stuck at
// "pending" forever. Revisit if fraud becomes a real concern.
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
  if (!["v5c", "insurance", "lease"].includes(documentType)) {
    return { error: "Please choose a document type." };
  }
  if (!file || file.size === 0) {
    return { error: "Please upload a document." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File is too large (max 10MB)." };
  }

  const path = `individual/${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("verification-documents")
    .upload(path, file);

  if (uploadError) {
    return { error: "Could not upload your document. Please try again." };
  }

  const { data: vehicle, error: insertError } = await supabase
    .from("vehicles")
    .insert({
      vrm,
      owner_type: "individual",
      owner_user_id: user.id,
      created_by: user.id,
      ownership_verification_status: "verified",
      ownership_verification_method: documentType,
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

  revalidatePath("/dashboard/vehicles");
  return { success: `Imported ${inserted?.length ?? 0} vehicle(s).` };
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
