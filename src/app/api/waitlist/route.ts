import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const waitlistSchema = z.object({
  accountType: z.enum(["fleet", "individual"]),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  company: z.string().trim().max(200).optional(),
  fleetSize: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(50).optional(),
  message: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = waitlistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again." },
      { status: 400 }
    );
  }

  const { accountType, name, email, company, fleetSize, phone, message } =
    parsed.data;

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (err) {
    console.error("Waitlist signup failed: Supabase not configured", err);
    return NextResponse.json(
      { error: "Signups aren't accepting submissions yet. Please try again shortly." },
      { status: 503 }
    );
  }

  const { error } = await supabase.from("waitlist_signups").insert({
    account_type: accountType,
    name,
    email,
    company: company || null,
    fleet_size: fleetSize || null,
    phone: phone || null,
    message: message || null,
  });

  if (error) {
    console.error("Waitlist signup insert failed", error);
    return NextResponse.json(
      { error: "Something went wrong saving your details. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
