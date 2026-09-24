import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { BottomNav } from "@/components/ui/BottomNav";
import { CameraIcon } from "@/components/ui/icons";

export const metadata = { title: "Cases — Planal" };

type CaseRow = {
  id: string;
  reference_number: string | null;
  issuer_name: string | null;
  amount_full: number | null;
  final_deadline: string | null;
  status: string;
  vehicles: { vrm: string; assigned_driver_user_id: string | null } | null;
};

type MemberRow = { user_id: string; users: { email: string; full_name: string | null } | null };

export default async function CasesPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);

  const [{ data: cases }, { data: memberRows }] = await Promise.all([
    supabase
      .from("cases")
      // Cast needed: Supabase's generated-free client types this embedded
      // relation as an array by default; it's a single row via the FK.
      .select(
        "id, reference_number, issuer_name, amount_full, final_deadline, status, vehicles(vrm, assigned_driver_user_id)"
      )
      .order("final_deadline", { ascending: true, nullsFirst: false })
      .returns<CaseRow[]>(),
    organisation
      ? supabase
          .from("memberships")
          .select("user_id, users(email, full_name)")
          .eq("organisation_id", organisation.id)
          .returns<MemberRow[]>()
      : Promise.resolve({ data: null }),
  ]);

  const driverLabelById = new Map(
    (memberRows ?? []).map((m) => [m.user_id, m.users?.full_name ?? m.users?.email ?? m.user_id])
  );

  return (
    <main className="min-h-full bg-planal-bg px-5 pb-28 pt-10 text-planal-ink">
      <div className="mx-auto max-w-md">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
          {organisation ? `${organisation.name}'s cases` : "Your cases"}
        </h1>

        <Link
          href="/try"
          className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-planal-brand px-4 py-3.5 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
        >
          <CameraIcon /> Photograph a ticket
        </Link>

        {!cases || cases.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-planal-border p-6 text-center text-base text-planal-ink-muted">
            No cases yet.
          </p>
        ) : (
          <>
            <p className="mt-5 text-sm text-planal-ink-muted">
              Deadlines are read from the notice where printed, or estimated from standard rules
              for that issuer type otherwise. Always check the exact date on the notice itself.
            </p>
            <ul className="mt-3 space-y-3">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/cases/${c.id}`}
                    className="block rounded-2xl border border-planal-border bg-planal-surface p-4 hover:border-planal-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand focus-visible:ring-offset-1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{c.vehicles?.vrm ?? "Vehicle"}</p>
                        <p className="mt-0.5 truncate text-sm text-planal-ink-muted">
                          {c.issuer_name ?? "Reading the ticket…"}
                          {c.reference_number ? ` · ${c.reference_number}` : ""}
                        </p>
                        {organisation && (
                          <p className="mt-0.5 text-sm text-planal-ink-muted">
                            {c.vehicles?.assigned_driver_user_id
                              ? (driverLabelById.get(c.vehicles.assigned_driver_user_id) ?? "—")
                              : "Unassigned"}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 font-[family-name:var(--font-display)] text-lg font-bold">
                        {c.amount_full != null ? `£${c.amount_full}` : "—"}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <DeadlineChip deadline={c.final_deadline} settled={["paid", "closed"].includes(c.status)} />
                      <span className="text-sm capitalize text-planal-ink-muted">{c.status}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <BottomNav active="cases" />
    </main>
  );
}
