import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { DeadlineChip } from "@/components/ui/DeadlineChip";
import { BottomNav } from "@/components/ui/BottomNav";
import { CameraIcon } from "@/components/ui/icons";

export const metadata = { title: "Planal" };

type CaseCard = {
  id: string;
  issuer_name: string | null;
  amount_full: number | null;
  final_deadline: string | null;
  status: string;
  vehicles: { vrm: string } | null;
};

export default async function DashboardHomePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);

  const { data: cases } = await supabase
    .from("cases")
    .select("id, issuer_name, amount_full, final_deadline, status, vehicles(vrm)")
    .order("final_deadline", { ascending: true, nullsFirst: false })
    .limit(20)
    .returns<CaseCard[]>();

  return (
    <main className="min-h-full bg-planal-bg pb-28 text-planal-ink">
      <div className="mx-auto max-w-md px-5 pt-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Planal</h1>
        <p className="mt-1 text-base text-planal-ink-muted">
          {organisation ? organisation.name : "Snap it, we'll handle the rest."}
        </p>

        <Link
          href="/try"
          className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-planal-brand px-4 py-4 text-base font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-planal-brand-dark focus-visible:ring-offset-2"
        >
          <CameraIcon /> Photograph your ticket
        </Link>

        <div className="mt-9">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-planal-ink-muted">
            Your cases
          </h2>

          {!cases || cases.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-planal-border p-6 text-center text-base text-planal-ink-muted">
              No tickets yet — photograph one above to get started.
            </p>
          ) : (
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
                        </p>
                      </div>
                      <p className="shrink-0 font-[family-name:var(--font-display)] text-lg font-bold">
                        {c.amount_full != null ? `£${c.amount_full}` : "—"}
                      </p>
                    </div>
                    <div className="mt-3">
                      <DeadlineChip
                        deadline={c.final_deadline}
                        settled={["paid", "closed"].includes(c.status)}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <BottomNav active="cases" />
    </main>
  );
}
