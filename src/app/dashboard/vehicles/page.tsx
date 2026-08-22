import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { AddVehicleForm } from "@/components/vehicles/AddVehicleForm";
import { ImportVehiclesForm } from "@/components/vehicles/ImportVehiclesForm";
import { OrgVerificationForm } from "@/components/vehicles/OrgVerificationForm";

export const metadata = { title: "Vehicles — Planal" };

type Vehicle = {
  id: string;
  vrm: string;
  make: string | null;
  colour: string | null;
  tax_status: string | null;
  mot_status: string | null;
  ownership_verification_status: string;
};

export default async function VehiclesPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, organisation } = await ensureAccountProvisioned(supabase, user);

  let vehicles: Vehicle[] = [];
  let orgVerified = false;

  if (organisation) {
    const [{ data: vehicleRows }, { data: orgRow }] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, vrm, make, colour, tax_status, mot_status, ownership_verification_status")
        .eq("owner_organisation_id", organisation.id)
        .order("vrm"),
      supabase.from("organisations").select("verification_status").eq("id", organisation.id).single(),
    ]);
    vehicles = vehicleRows ?? [];
    orgVerified = orgRow?.verification_status === "verified";
  } else {
    const { data: vehicleRows } = await supabase
      .from("vehicles")
      .select("id, vrm, make, colour, tax_status, mot_status, ownership_verification_status")
      .eq("owner_user_id", user.id)
      .order("vrm");
    vehicles = vehicleRows ?? [];
  }

  const isAdmin = organisation?.role === "admin";

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Vehicles</h1>
          <a href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            &larr; Dashboard
          </a>
        </div>

        {organisation && !orgVerified && isAdmin && (
          <div className="mt-8">
            <OrgVerificationForm />
          </div>
        )}

        {(!organisation || (organisation && orgVerified && isAdmin)) && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {!organisation && <AddVehicleForm />}
            {organisation && orgVerified && isAdmin && <ImportVehiclesForm />}
          </div>
        )}

        {organisation && !isAdmin && (
          <p className="mt-8 text-sm text-zinc-400">
            Vehicles assigned to you by your fleet admin will appear below.
          </p>
        )}

        <div className="mt-10">
          <h2 className="text-lg font-medium">
            {organisation ? `${organisation.name}'s vehicles` : `${profile?.full_name ?? "Your"} vehicles`}
          </h2>

          {vehicles.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No vehicles yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">VRM</th>
                    <th className="px-4 py-3 font-medium">Make</th>
                    <th className="px-4 py-3 font-medium">Colour</th>
                    <th className="px-4 py-3 font-medium">Tax</th>
                    <th className="px-4 py-3 font-medium">MOT</th>
                    <th className="px-4 py-3 font-medium">Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 font-medium">{v.vrm}</td>
                      <td className="px-4 py-3 text-zinc-300">{v.make ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{v.colour ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{v.tax_status ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{v.mot_status ?? "—"}</td>
                      <td className="px-4 py-3 capitalize text-zinc-300">
                        {organisation ? (orgVerified ? "verified" : "pending") : v.ownership_verification_status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
