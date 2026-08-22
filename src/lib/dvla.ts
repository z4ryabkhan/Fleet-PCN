// DVLA Vehicle Enquiry Service — cosmetic vehicle display only. Per Part 9
// rule 4 of PLANAL_MASTER_PLAN.md: never treat this as keeper-identity or
// penalty data, and never use it to establish or infer ownership. Ownership
// is established solely by the uploaded verification document (individual)
// or Companies House + fleet document (organisation) — see
// supabase/migrations/0005_vehicles_and_org_verification.sql.
//
// Note: VES does not return a vehicle "model" field, despite Part 2.3 of
// the master plan listing make/model/colour — that's a real limitation of
// the API, not something worth working around (no other free/reliable UK
// source exists without a commercial data provider).

export type VesResult = {
  make: string | null;
  colour: string | null;
  taxStatus: string | null;
  motStatus: string | null;
  yearOfManufacture: number | null;
};

const VES_ENDPOINT =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

/**
 * Looks up cosmetic vehicle details by VRM. Returns null if no API key is
 * configured yet, the vehicle isn't found, or the call fails — callers
 * should treat a null result as "no cosmetic data available yet", never as
 * an error blocking vehicle creation.
 */
export async function lookupVehicleVes(vrm: string): Promise<VesResult | null> {
  const apiKey = process.env.DVLA_VES_API_KEY;
  if (!apiKey) {
    return null;
  }

  const registrationNumber = vrm.replace(/\s+/g, "");

  try {
    const res = await fetch(VES_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registrationNumber }),
    });

    if (!res.ok) {
      console.error(`DVLA VES lookup failed for ${registrationNumber}: ${res.status}`);
      return null;
    }

    const data = await res.json();

    return {
      make: data.make ?? null,
      colour: data.colour ?? null,
      taxStatus: data.taxStatus ?? null,
      motStatus: data.motStatus ?? null,
      yearOfManufacture: data.yearOfManufacture ?? null,
    };
  } catch (err) {
    console.error(`DVLA VES lookup error for ${registrationNumber}`, err);
    return null;
  }
}
