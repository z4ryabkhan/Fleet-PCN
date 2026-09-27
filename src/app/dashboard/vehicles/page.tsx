import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { AddVehicleForm } from "@/components/vehicles/AddVehicleForm";
import { ImportVehiclesForm } from "@/components/vehicles/ImportVehiclesForm";
import { OrgVerificationForm } from "@/components/vehicles/OrgVerificationForm";
import { AssignDriverSelect } from "@/components/vehicles/AssignDriverSelect";
import { HireRecordForm } from "@/components/vehicles/HireRecordForm";
import { HireRecordsList } from "@/components/vehicles/HireRecordsList";
import { ReportFleetTicketForm } from "@/components/vehicles/ReportFleetTicketForm";

export const metadata = { title: "Vehicles — Planal" };

type Vehicle = {
  id: string;
  vrm: string;
  make: string | null;
  colour: string | null;
  tax_status: string | null;
  mot_status: string | null;
  ownership_verification_status: string;
  assigned_driver_user_id: string | null;
};

type MemberRow = { user_id: string; users: { email: string; full_name: string | null } | null };

export default async function VehiclesPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, organisation } = await ensureAccountProvisioned(supabase, user);

  let vehicles: Vehicle[] = [];
  let orgVerified = false;
  let members: { userId: string; label: string }[] = [];
  let hireRecords: { id: string; vrm: string; hirer_name: string; start_at: string; end_at: string }[] = [];

  if (organisation) {
    const [{ data: vehicleRows }, { data: orgRow }, { data: memberRows }, { data: hireRows }] = await Promise.all([
      supabase
        .from("vehicles")
        .select(
          "id, vrm, make, colour, tax_status, mot_status, ownership_verification_status, assigned_driver_user_id"
        )
        .eq("owner_organisation_id", organisation.id)
        .order("vrm"),
      supabase.from("organisations").select("verification_status").eq("id", organisation.id).single(),
      supabase
        .from("memberships")
        .select("user_id, users(email, full_name)")
        .eq("organisation_id", organisation.id)
        .returns<MemberRow[]>(),
      supabase
        .from("hire_records")
        .select("id, hirer_name, start_at, end_at, vehicles(vrm)")
        .eq("organisation_id", organisation.id)
        .order("start_at", { ascending: false })
        .returns<{ id: string; hirer_name: string; start_at: string; end_at: string; vehicles: { vrm: string } | null }[]>(),
    ]);
    vehicles = vehicleRows ?? [];
    orgVerified = orgRow?.verification_status === "verified";
    members = (memberRows ?? []).map((m) => ({
      userId: m.user_id,
      label: m.users?.full_name ?? m.users?.email ?? m.user_id,
    }));
    hireRecords = (hireRows ?? []).map((h) => ({
      id: h.id,
      vrm: h.vehicles?.vrm ?? "—",
      hirer_name: h.hirer_name,
      start_at: h.start_at,
      end_at: h.end_at,
    }));
  } else {
    const { data: vehicleRows } = await supabase
      .from("vehicles")
      .select(
        "id, vrm, make, colour, tax_status, mot_status, ownership_verification_status, assigned_driver_user_id"
      )
      .eq("owner_user_id", user.id)
      .order("vrm");
    vehicles = vehicleRows ?? [];
  }

  const isAdmin = organisation?.role === "admin";
  const membersById = new Map(members.map((m) => [m.userId, m.label]));

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Vehicles</h1>
          <a
            href="/dashboard"
            className="rounded text-sm text-zinc-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
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
                    {organisation && <th className="px-4 py-3 font-medium">Driver</th>}
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
                      {organisation && (
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <AssignDriverSelect
                              vehicleId={v.id}
                              currentDriverUserId={v.assigned_driver_user_id}
                              members={members}
                            />
                          ) : (
                            <span className="text-zinc-300">
                              {v.assigned_driver_user_id
                                ? (membersById.get(v.assigned_driver_user_id) ?? "—")
                                : "Unassigned"}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {organisation && orgVerified && isAdmin && vehicles.length > 0 && (
          <>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <HireRecordForm vehicles={vehicles} />
              <ReportFleetTicketForm vehicles={vehicles} />
            </div>

            <div className="mt-10">
              <h2 className="text-lg font-medium">Hires on record</h2>
              <p className="mt-1 text-sm text-zinc-400">
                A PCN dated inside one of these windows is routed to a transfer-of-liability letter automatically.
              </p>
              <div className="mt-3">
                <HireRecordsList records={hireRecords} />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
