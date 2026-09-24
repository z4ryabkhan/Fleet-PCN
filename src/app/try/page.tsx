import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TryFlow } from "@/components/try/TryFlow";

export const metadata = { title: "Photograph your ticket — Planal" };

export default async function TryPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <TryFlow isAuthenticated={Boolean(user)} />;
}
