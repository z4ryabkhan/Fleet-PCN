// Sends due reminders (email via Resend, SMS via Twilio) and marks them
// sent. Invoked on a schedule by pg_cron (see migration
// 0014_send_reminders_cron.sql) via pg_net, authenticated with the
// project's service role key.
//
// RESEND_API_KEY / TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
// TWILIO_FROM_NUMBER are NOT set yet as of this deploy — set with:
//   supabase secrets set RESEND_API_KEY=... TWILIO_ACCOUNT_SID=... \
//     TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=... --project-ref znjbothwzjiaabqlnlhn
// Until then this function runs as a no-op (0 sent) rather than failing —
// same "inert without the key" pattern as the DVLA/Anthropic integrations.
//
// FROM_EMAIL uses Resend's sandbox address until a Planal domain is
// registered and verified in Resend — sandbox sending is restricted to
// the account owner's own address, so this won't reach real users yet.

import { createClient } from "jsr:@supabase/supabase-js@2";

const FROM_EMAIL = "Planal <onboarding@resend.dev>";
const BATCH_LIMIT = 50;

type Reminder = {
  id: string;
  case_id: string;
  channel: "email" | "sms";
  deadline_type: "discount" | "final";
  scheduled_for: string;
};

type Recipient = { email: string | null; phone: string | null; full_name: string | null };

function formatMessage(
  deadlineType: "discount" | "final",
  vrm: string,
  issuerName: string | null,
  referenceNumber: string | null,
  deadlineDate: string
): string {
  const what = deadlineType === "discount" ? "discount payment window" : "final deadline";
  const issuer = issuerName ?? "your PCN issuer";
  const ref = referenceNumber ? ` (ref ${referenceNumber})` : "";
  return `Reminder: your ${vrm} PCN from ${issuer}${ref} has its ${what} on ${deadlineDate}. Log in to Planal to review.`;
}

async function sendEmail(apiKey: string, to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendSms(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  to: string,
  body: string
) {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    }
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  // verify_jwt is disabled for this function (see deploy notes) because
  // the caller (pg_cron via pg_net) sends the project's service role key
  // as a bearer token, and Supabase's newer sb_secret_... key format isn't
  // a JWT the platform gateway would accept — so auth is handled here
  // instead, by comparing against the same auto-injected service role key.
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

  const { data: reminders, error: remindersError } = await supabase
    .from("reminders")
    .select("id, case_id, channel, deadline_type, scheduled_for")
    .is("sent_at", null)
    .lte("scheduled_for", new Date().toISOString())
    .limit(BATCH_LIMIT)
    .returns<Reminder[]>();

  if (remindersError) {
    return new Response(JSON.stringify({ error: remindersError.message }), { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const reminder of reminders ?? []) {
    const { data: caseRow } = await supabase
      .from("cases")
      .select(
        "reference_number, issuer_name, discount_deadline, final_deadline, vehicle_id, vehicles(vrm, owner_type, owner_user_id, owner_organisation_id)"
      )
      .eq("id", reminder.case_id)
      .single();

    const vehicle = caseRow?.vehicles as unknown as {
      vrm: string;
      owner_type: "individual" | "organisation";
      owner_user_id: string | null;
      owner_organisation_id: string | null;
    } | null;

    if (!caseRow || !vehicle) {
      skipped++;
      continue;
    }

    let recipients: Recipient[] = [];
    if (vehicle.owner_type === "individual" && vehicle.owner_user_id) {
      const { data } = await supabase
        .from("users")
        .select("email, phone, full_name")
        .eq("id", vehicle.owner_user_id)
        .returns<Recipient[]>();
      recipients = data ?? [];
    } else if (vehicle.owner_type === "organisation" && vehicle.owner_organisation_id) {
      const { data } = await supabase
        .from("memberships")
        .select("users(email, phone, full_name)")
        .eq("organisation_id", vehicle.owner_organisation_id)
        .eq("role", "admin")
        .returns<{ users: Recipient }[]>();
      recipients = (data ?? []).map((m: { users: Recipient }) => m.users).filter(Boolean);
    }

    const deadlineDate =
      reminder.deadline_type === "discount" ? caseRow.discount_deadline : caseRow.final_deadline;
    if (!deadlineDate) {
      skipped++;
      continue;
    }

    const message = formatMessage(
      reminder.deadline_type,
      vehicle.vrm,
      caseRow.issuer_name,
      caseRow.reference_number,
      deadlineDate
    );

    try {
      if (reminder.channel === "email") {
        if (!resendKey) {
          skipped++;
          continue;
        }
        const targets = recipients.filter((r) => r.email);
        if (targets.length === 0) {
          skipped++;
          continue;
        }
        for (const r of targets) {
          await sendEmail(resendKey, r.email!, `Planal — ${vehicle.vrm} deadline reminder`, message);
        }
      } else {
        if (!twilioSid || !twilioToken || !twilioFrom) {
          skipped++;
          continue;
        }
        const targets = recipients.filter((r) => r.phone);
        if (targets.length === 0) {
          skipped++;
          continue;
        }
        for (const r of targets) {
          await sendSms(twilioSid, twilioToken, twilioFrom, r.phone!, message);
        }
      }

      await supabase.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", reminder.id);
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder ${reminder.id}`, err);
      failed++;
    }
  }

  return new Response(JSON.stringify({ sent, skipped, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
