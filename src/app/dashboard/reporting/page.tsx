import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";

export const metadata = { title: "Reporting — Planal" };

// Part 2.3: "Fleet reporting: monthly summary (tickets caught, value
// managed, deadlines hit, discount value saved)". Never built before this
// — see docs/DPIA.md and the master plan's own feature list, which named
// this explicitly. Scoped to the current calendar month, computed here in
// the app layer (no stored procedure) rather than as a stored report,
// matching how the rest of this codebase favours simple app-layer
// queries over database-side aggregation machinery.
//
// "Deadlines hit" reads as: of the cases whose final_deadline fell in
// this month, how many were actually resolved (paid/appealed/closed)
// rather than left open past their own deadline — the master plan
// doesn't define this term precisely, so this is the most natural
// reading, not an assumption to treat as settled.
//
// "Discount value saved" needs to know a case was paid AT the discounted
// rate specifically, which needs paid_at (0027) compared against
// discount_deadline — a case marked paid after its discount window doesn't
// count, even though it's still "paid".
type CaseForReport = {
  amount_full: number | null;
  amount_discounted: number | null;
  created_at: string;
  final_deadline: string | null;
  paid_at: string | null;
  discount_deadline: string | null;
  status: string;
};

export default async function ReportingPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);
  if (!organisation || organisation.role !== "admin") redirect("/dashboard");

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthLabel = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // RLS (can_view_vehicle) already scopes this to the org's own cases —
  // no explicit organisation filter needed, same pattern the cases
  // dashboard page already uses.
  const { data: cases } = await supabase
    .from("cases")
    .select("amount_full, amount_discounted, created_at, final_deadline, paid_at, discount_deadline, status")
    .returns<CaseForReport[]>();

  const inMonth = (iso: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= monthStart && d < monthEnd;
  };

  const caughtThisMonth = (cases ?? []).filter((c) => inMonth(c.created_at));
  const ticketsCaught = caughtThisMonth.length;
  const valueManaged = caughtThisMonth.reduce((sum, c) => sum + (c.amount_full ?? 0), 0);

  const deadlinesThisMonth = (cases ?? []).filter((c) => inMonth(c.final_deadline));
  const deadlinesHit = deadlinesThisMonth.filter((c) =>
    ["paid", "appealed", "closed"].includes(c.status)
  ).length;

  const discountValueSaved = (cases ?? [])
    .filter(
      (c) =>
        inMonth(c.paid_at) &&
        c.discount_deadline &&
        c.paid_at &&
        new Date(c.paid_at) <= new Date(`${c.discount_deadline}T23:59:59Z`) &&
        c.amount_full != null &&
        c.amount_discounted != null
    )
    .reduce((sum, c) => sum + ((c.amount_full ?? 0) - (c.amount_discounted ?? 0)), 0);

  const stats = [
    { label: "Tickets caught", value: ticketsCaught.toString() },
    { label: "Value managed", value: `£${valueManaged.toFixed(2)}` },
    { label: "Deadlines hit", value: `${deadlinesHit} / ${deadlinesThisMonth.length}` },
    { label: "Discount value saved", value: `£${discountValueSaved.toFixed(2)}` },
  ];

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Reporting</h1>
          <a href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            &larr; Dashboard
          </a>
        </div>
        <p className="mt-1 text-sm text-zinc-400">{monthLabel}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 p-6">
              <p className="text-sm text-zinc-400">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-zinc-500">
          &quot;Deadlines hit&quot; counts cases whose final deadline fell this month and that
          were resolved (paid, appealed, or closed) rather than left open past it. &quot;Discount
          value saved&quot; only counts cases actually paid on or before their discount deadline.
        </p>
      </div>
    </main>
  );
}
