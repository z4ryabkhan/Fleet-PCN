import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAccountProvisioned } from "@/lib/account";
import { isStripeConfigured } from "@/lib/stripe";
import { SubscribeButton } from "@/components/billing/SubscribeButton";

export const metadata = { title: "Billing — Planal" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; cancelled?: string }>;
}) {
  const { subscribed, cancelled } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organisation } = await ensureAccountProvisioned(supabase, user);

  if (!organisation) {
    return (
      <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Individual accounts pay per case, right from the case page — there&apos;s no
            subscription to manage here.
          </p>
          <Link href="/dashboard" className="mt-6 inline-block text-sm text-zinc-400 hover:text-white">
            &larr; Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (organisation.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: billingAccount } = await supabase
    .from("billing_accounts")
    .select("subscription_status")
    .eq("owner_organisation_id", organisation.id)
    .maybeSingle();

  const isActive = billingAccount?.subscription_status === "active";

  return (
    <main className="min-h-full bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Billing</h1>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            &larr; Dashboard
          </Link>
        </div>

        {subscribed && (
          <p className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">
            Subscription active.
          </p>
        )}
        {cancelled && (
          <p className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">
            Checkout cancelled — no charge was made.
          </p>
        )}

        <div className="mt-6 rounded-xl border border-white/10 p-6">
          <p className="text-sm text-zinc-400">Plan</p>
          <p className="mt-1 text-lg font-medium">£25/month — covers up to 10 vehicles</p>
          <p className="mt-1 text-sm text-zinc-500">
            + £2/vehicle/month beyond 10, + £5 per case processed
          </p>

          <p className="mt-4 text-sm text-zinc-400">Status</p>
          <p className="mt-1 text-lg font-medium capitalize">
            {billingAccount?.subscription_status ?? "Not set up"}
          </p>

          {!isActive && (
            <div className="mt-6">
              {isStripeConfigured() ? (
                <SubscribeButton />
              ) : (
                <p className="text-sm text-zinc-500">
                  Billing isn&apos;t live yet — it&apos;s waiting on the Stripe API key.
                </p>
              )}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          These are starting prices we&apos;re still validating with real fleet conversations —
          not locked in.
        </p>
      </div>
    </main>
  );
}
