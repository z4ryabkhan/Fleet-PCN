import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { AddCaseForm } from "@/components/cases/AddCaseForm";

export const metadata = { title: "Cases — Planal" };

type CaseRow = {
  id: string;
  reference_number: string | null;
  issuer_name: string | null;
  amount_full: number | null;
  final_deadline: string | null;
  status: string;
  vehicles: { vrm: string } | null;
};

export default async function CasesPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);

  const vehicleQuery = organisation
    ? supabase.from("vehicles").select("id, vrm").eq("owner_organisation_id", organisation.id)
    : supabase.from("vehicles").select("id, vrm").eq("owner_user_id", user.id);

  const [{ data: vehicles }, { data: cases }] = await Promise.all([
    vehicleQuery.order("vrm"),
    supabase
      .from("cases")
      // Cast needed: Supabase's generated-free client types this embedded
      // relation as an array by default; it's a single row via the FK.
      .select("id, reference_number, issuer_name, amount_full, final_deadline, status, vehicles(vrm)")
      .order("final_deadline", { ascending: true, nullsFirst: false })
      .returns<CaseRow[]>(),
  ]);

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Cases</h1>
          <a href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            &larr; Dashboard
          </a>
        </div>

        <div className="mt-8">
          <AddCaseForm vehicles={vehicles ?? []} />
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-medium">
            {organisation ? `${organisation.name}'s cases` : "Your cases"}
          </h2>

          {!cases || cases.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No cases yet.</p>
          ) : (
            <>
              <p className="mt-3 text-xs text-zinc-500">
                Deadlines are read from the notice where printed, or estimated from standard rules
                for that issuer type otherwise. Always check the exact date on the notice itself.
              </p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Vehicle</th>
                    <th className="px-4 py-3 font-medium">Issuer</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium">Deadline</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/5"
                    >
                      <td className="px-4 py-3 font-medium">
                        <a href={`/dashboard/cases/${c.id}`} className="block">
                          {c.vehicles?.vrm ?? "—"}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        <a href={`/dashboard/cases/${c.id}`} className="block">
                          {c.issuer_name ?? "—"}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        <a href={`/dashboard/cases/${c.id}`} className="block">
                          {c.reference_number ?? "—"}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        <a href={`/dashboard/cases/${c.id}`} className="block">
                          {c.amount_full != null ? `£${c.amount_full}` : "—"}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        <a href={`/dashboard/cases/${c.id}`} className="block">
                          {c.final_deadline ?? "—"}
                        </a>
                      </td>
                      <td className="px-4 py-3 capitalize text-zinc-300">
                        <a href={`/dashboard/cases/${c.id}`} className="block">
                          {c.status}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
