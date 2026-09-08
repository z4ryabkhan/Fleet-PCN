// Phase 6/7 completion: turns connected mailboxes (Gmail/Outlook OAuth,
// shipped in migrations 0016/0018 as connect/revoke only) into actual PCN
// auto-detection — Part 2.2 step 4 ("System auto-detects PCN-related mail,
// extracts fields, creates a case, attributes it to a vehicle").
//
// Invoked on a schedule by pg_cron (see migration
// 0022_scan_mailboxes_cron.sql) via pg_net, same auth pattern as
// send-reminders: the caller presents the service role key as a bearer
// token and this function checks it directly, since pg_net's caller isn't
// a Supabase Auth JWT the platform gateway would otherwise verify.
//
// Reads a PDF/photo attachment when a message has one supported (same
// mime types the manual-upload OCR path accepts — application/pdf,
// image/jpeg|png|webp|gif), passing it to Claude alongside the body text
// and saving it as case evidence exactly like a manual upload would.
// Added because the original version shipped body-text-only, and a real
// council/private-operator PCN notice commonly arrives as a near-empty
// email with the actual notice as an attached PDF — that pattern wasn't
// just unextracted before this, it was filtered out before extraction
// ever ran, since the keyword pre-filter only looked at subject/snippet
// text. Both providers' filters now also let a message through solely
// because it has a supported attachment, whatever its subject says.
// Not yet verified against a real such email (no live mailbox connected
// to this project yet) — worth an early check once one is.
//
// UNVERIFIED AGAINST LIVE GMAIL/OUTLOOK DATA. Written to the documented
// Gmail API (developers.google.com/gmail/api) and Microsoft Graph
// (learn.microsoft.com/graph/api/user-list-messages) request/response
// shapes, and to Anthropic's forced-tool-use structured-extraction
// pattern (docs.claude.com/en/docs/build-with-claude/tool-use) — but this
// session had no outbound network access to Google, Microsoft, or
// Anthropic to exercise it end-to-end (same constraint noted in
// src/lib/google-oauth.ts and src/lib/microsoft-oauth.ts for the OAuth
// flows themselves). Test against a real connected mailbox before relying
// on it, and check the invocation logs (`supabase functions logs
// scan-mailboxes`) after the first few scheduled runs.
//
// GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / MS_OAUTH_CLIENT_ID
// / MS_OAUTH_CLIENT_SECRET / ANTHROPIC_API_KEY / ENCRYPTION_KEY_FOR_OAUTH_TOKENS
// must be set as Edge Function secrets (`supabase secrets set ... --project-ref
// znjbothwzjiaabqlnlhn`), separately from the same-named Vercel env vars —
// Edge Functions don't read Vercel's environment. Until they're set, this
// runs as a no-op per connection (skipped, not failed) — same "inert
// without the key" pattern as send-reminders.

import { createClient } from "jsr:@supabase/supabase-js@2";

const BATCH_CONNECTIONS_LIMIT = 20;
const MESSAGES_PER_CONNECTION_LIMIT = 25;
// First scan of a newly connected mailbox looks back this far; every scan
// after that looks back from last_scanned_at minus a small overlap buffer,
// so a message that arrives mid-scan-window on one run is still caught on
// the next rather than silently skipped at the boundary.
const INITIAL_LOOKBACK_HOURS = 72;
const OVERLAP_BUFFER_MINUTES = 15;

// Cheap pre-filter before anything reaches Claude — cost control, and
// keeps the scanner from asking an LLM to classify every newsletter in
// the inbox. Deliberately broad (false positives cost a wasted Claude
// call and get silently discarded at extraction; false negatives silently
// lose a real PCN, which is worse) — keep additions to this list, don't
// tighten it, unless real scan logs show it's letting too much through.
const KEYWORDS = [
  "penalty charge notice",
  "pcn",
  "parking charge notice",
  "excess charge notice",
  "notice to keeper",
  "notice to owner",
  "contravention",
  "congestion charge",
  "ultra low emission zone",
  "ulez",
  "dart charge",
  "bus lane",
  "moving traffic",
  "traffic penalty tribunal",
  "popla",
];

// Mirrors src/lib/ocr.ts's PcnExtractionSchema and
// supabase/migrations/0010_cases_and_evidence.sql's issuer_type check
// constraint — keep all three in sync. Duplicated rather than shared
// because this function runs on Deno and can't import src/lib's Node code
// directly (same reasoning as send-reminders/index.ts being self-contained).
const ISSUER_TYPES = [
  "council_pcn",
  "tfl_pcn",
  "congestion_charge",
  "ulez",
  "dart_charge",
  "private_pcn",
  "bus_lane",
  "moving_traffic",
] as const;

const EXTRACTION_TOOL = {
  name: "record_pcn_extraction",
  description:
    "Records structured fields extracted from a UK parking/traffic penalty notice email, or reports that this email is not actually a PCN.",
  input_schema: {
    type: "object",
    properties: {
      isPcn: {
        type: "boolean",
        description: "True only if this email is genuinely about a specific penalty/contravention notice, not a newsletter, marketing email, or unrelated correspondence that merely mentions parking.",
      },
      vrm: { type: ["string", "null"], description: "UK vehicle registration mark referenced, if stated." },
      issuerName: { type: ["string", "null"] },
      issuerType: { type: ["string", "null"], enum: [...ISSUER_TYPES, null] },
      referenceNumber: { type: ["string", "null"] },
      contraventionCode: { type: ["string", "null"] },
      contraventionDescription: {
        type: ["string", "null"],
        description: "The human-readable reason as actually written in the email, separate from the code — leave null if only a code is stated.",
      },
      locationText: { type: ["string", "null"] },
      eventDatetime: { type: ["string", "null"], description: "ISO 8601 datetime the contravention occurred, if stated." },
      noticeDate: {
        type: ["string", "null"],
        description:
          "ISO 8601 date (YYYY-MM-DD) the notice was issued/served — often a different, later date than eventDatetime. Deadlines are counted from this date, so extract it carefully.",
      },
      amountFull: { type: ["number", "null"] },
      amountDiscounted: { type: ["number", "null"] },
      discountDeadline: { type: ["string", "null"], description: "ISO 8601 date, only if explicitly stated." },
      finalDeadline: { type: ["string", "null"], description: "ISO 8601 date, only if explicitly stated." },
    },
    required: ["isPcn", "vrm", "issuerName", "issuerType", "referenceNumber", "contraventionCode", "contraventionDescription", "locationText", "eventDatetime", "noticeDate", "amountFull", "amountDiscounted", "discountDeadline", "finalDeadline"],
  },
};

// Same mime types src/lib/ocr.ts accepts for a manual upload.
const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type CandidateAttachment = { filename: string; mimeType: string; base64Data: string };
type Candidate = { messageId: string; subject: string; bodyText: string; attachment: CandidateAttachment | null };

type Extraction = {
  isPcn: boolean;
  vrm: string | null;
  issuerName: string | null;
  issuerType: (typeof ISSUER_TYPES)[number] | null;
  referenceNumber: string | null;
  contraventionCode: string | null;
  contraventionDescription: string | null;
  locationText: string | null;
  eventDatetime: string | null;
  noticeDate: string | null;
  amountFull: number | null;
  amountDiscounted: number | null;
  discountDeadline: string | null;
  finalDeadline: string | null;
};

// Mirrors src/lib/deadlines.ts — keep in sync (same duplication reasoning
// as the issuer types above).
const DEADLINE_RULES: Record<(typeof ISSUER_TYPES)[number], { discountDays: number; finalDays: number }> = {
  council_pcn: { discountDays: 14, finalDays: 28 },
  tfl_pcn: { discountDays: 14, finalDays: 28 },
  congestion_charge: { discountDays: 14, finalDays: 28 },
  ulez: { discountDays: 14, finalDays: 28 },
  dart_charge: { discountDays: 14, finalDays: 28 },
  private_pcn: { discountDays: 14, finalDays: 28 },
  bus_lane: { discountDays: 21, finalDays: 28 },
  moving_traffic: { discountDays: 21, finalDays: 28 },
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeDeadlines(issuerType: string | null, noticeDate: string | null) {
  if (!issuerType || !noticeDate || !(issuerType in DEADLINE_RULES)) return null;
  const rule = DEADLINE_RULES[issuerType as (typeof ISSUER_TYPES)[number]];
  return { discountDeadline: addDays(noticeDate, rule.discountDays), finalDeadline: addDays(noticeDate, rule.finalDays) };
}

function normalizeVrm(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}

// --- Token encryption, Deno/Web Crypto side. Must stay byte-for-byte
// compatible with src/lib/crypto.ts (Node's `crypto` module, AES-256-GCM,
// base64(iv).base64(authTag).base64(ciphertext)) since tokens encrypted by
// the Next.js app are decrypted here, and refreshed tokens encrypted here
// are later decrypted by the Next.js app (e.g. if a connection is revoked
// there). Web Crypto's AES-GCM concatenates ciphertext+tag as one output
// (tag last, 16 bytes) rather than returning them separately like Node's
// cipher.getAuthTag() — reconciled below by splitting/joining explicitly.

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function getAesKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get("ENCRYPTION_KEY_FOR_OAUTH_TOKENS");
  if (!b64) throw new Error("ENCRYPTION_KEY_FOR_OAUTH_TOKENS is not configured.");
  const raw = b64ToBytes(b64);
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY_FOR_OAUTH_TOKENS must decode to 32 bytes.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function decryptToken(ciphertext: string): Promise<string> {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(".");
  const iv = b64ToBytes(ivB64);
  const authTag = b64ToBytes(authTagB64);
  const data = b64ToBytes(dataB64);
  const combined = new Uint8Array(data.length + authTag.length);
  combined.set(data, 0);
  combined.set(authTag, data.length);
  const key = await getAesKey();
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return new TextDecoder().decode(plainBuf);
}

async function encryptToken(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getAesKey();
  const combined = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext))
  );
  // Web Crypto's AES-GCM output is ciphertext with the 16-byte tag
  // appended — split it back into Node's separate ciphertext/authTag
  // shape so decryptToken (either runtime) can read it uniformly.
  const data = combined.slice(0, combined.length - 16);
  const authTag = combined.slice(combined.length - 16);
  return [bytesToB64(iv), bytesToB64(authTag), bytesToB64(data)].join(".");
}

// --- Gmail

async function refreshGoogleAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return new TextDecoder().decode(b64ToBytes(b64));
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type GmailPayload = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string };
  parts?: GmailPayload[];
};

function extractGmailBodyText(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  if (payload.body?.data && (payload.mimeType === "text/plain" || payload.mimeType === "text/html")) {
    const text = decodeBase64Url(payload.body.data);
    return payload.mimeType === "text/html" ? stripHtml(text) : text;
  }
  for (const part of payload.parts ?? []) {
    const text = extractGmailBodyText(part);
    if (text) return text;
  }
  return "";
}

/** First attachment part in a supported mime type, if any — mirrors the
 * OCR path's "one file per case" assumption; a PCN email realistically
 * carries at most one notice attachment. */
function findGmailAttachment(payload: GmailPayload | undefined): { filename: string; mimeType: string; attachmentId: string } | null {
  if (!payload) return null;
  if (
    payload.filename &&
    payload.body?.attachmentId &&
    payload.mimeType &&
    SUPPORTED_ATTACHMENT_MIME_TYPES.has(payload.mimeType)
  ) {
    return { filename: payload.filename, mimeType: payload.mimeType, attachmentId: payload.body.attachmentId };
  }
  for (const part of payload.parts ?? []) {
    const found = findGmailAttachment(part);
    if (found) return found;
  }
  return null;
}

async function fetchGmailAttachmentData(accessToken: string, messageId: string, attachmentId: string): Promise<string> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Gmail attachment fetch failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  // Gmail attachment bytes are base64url, same as message body parts —
  // convert to standard base64 for the Claude API and for Supabase
  // Storage upload later.
  return (body.data as string).replace(/-/g, "+").replace(/_/g, "/");
}

async function fetchGmailCandidates(accessToken: string, sinceIso: string): Promise<Candidate[]> {
  const afterEpochSeconds = Math.floor(new Date(sinceIso).getTime() / 1000);
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", `in:inbox after:${afterEpochSeconds}`);
  listUrl.searchParams.set("maxResults", String(MESSAGES_PER_CONNECTION_LIMIT));

  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status} ${await listRes.text()}`);
  const { messages } = await listRes.json();

  const candidates: Candidate[] = [];
  for (const { id } of messages ?? []) {
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!msgRes.ok) continue;
    const msg = await msgRes.json();
    const subject: string = (msg.payload?.headers ?? []).find((h: { name: string }) => h.name === "Subject")?.value ?? "";
    const attachmentRef = findGmailAttachment(msg.payload);
    const haystack = `${subject} ${msg.snippet ?? ""}`.toLowerCase();
    // A supported attachment lets a message through regardless of
    // subject/snippet wording — a scanned notice PDF with a generic
    // "Your document" subject has no keyword to match on in the text at
    // all, and would otherwise never reach extraction.
    if (!attachmentRef && !KEYWORDS.some((k) => haystack.includes(k))) continue;

    let attachment: CandidateAttachment | null = null;
    if (attachmentRef) {
      try {
        attachment = {
          filename: attachmentRef.filename,
          mimeType: attachmentRef.mimeType,
          base64Data: await fetchGmailAttachmentData(accessToken, id, attachmentRef.attachmentId),
        };
      } catch (err) {
        console.error(`Failed to fetch Gmail attachment for message ${id}`, err);
      }
    }

    candidates.push({ messageId: id, subject, bodyText: extractGmailBodyText(msg.payload) || msg.snippet || "", attachment });
  }
  return candidates;
}

// --- Microsoft Graph

async function refreshMicrosoftAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
  const tenant = Deno.env.get("MS_OAUTH_TENANT_ID") || "common";
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("MS_OAUTH_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("MS_OAUTH_CLIENT_SECRET") ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Mail.Read offline_access",
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // Microsoft rotates refresh tokens on use — the new one must be stored,
  // unlike Google's which stays valid and is only returned on first grant.
  return { accessToken: json.access_token, expiresIn: json.expires_in, refreshToken: json.refresh_token };
}

async function fetchOutlookAttachment(accessToken: string, messageId: string): Promise<CandidateAttachment | null> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph attachments fetch failed: ${res.status} ${await res.text()}`);
  const { value } = (await res.json()) as {
    value?: { "@odata.type"?: string; name: string; contentType: string; contentBytes?: string }[];
  };
  const match = (value ?? []).find(
    (a) =>
      (a["@odata.type"] === "#microsoft.graph.fileAttachment" || !a["@odata.type"]) &&
      a.contentBytes &&
      SUPPORTED_ATTACHMENT_MIME_TYPES.has(a.contentType)
  );
  if (!match || !match.contentBytes) return null;
  // Graph file attachments are already standard base64 — no url-safe
  // conversion needed, unlike Gmail's.
  return { filename: match.name, mimeType: match.contentType, base64Data: match.contentBytes };
}

async function fetchOutlookCandidates(accessToken: string, sinceIso: string): Promise<Candidate[]> {
  const url = new URL("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages");
  url.searchParams.set("$filter", `receivedDateTime ge ${sinceIso}`);
  url.searchParams.set("$select", "subject,bodyPreview,body,hasAttachments");
  url.searchParams.set("$top", String(MESSAGES_PER_CONNECTION_LIMIT));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Graph list failed: ${res.status} ${await res.text()}`);
  const { value } = (await res.json()) as {
    value?: {
      id: string;
      subject?: string;
      bodyPreview?: string;
      body?: { contentType?: string; content?: string };
      hasAttachments?: boolean;
    }[];
  };

  const candidates: Candidate[] = [];
  for (const msg of value ?? []) {
    const haystack = `${msg.subject ?? ""} ${msg.bodyPreview ?? ""}`.toLowerCase();
    // Same reasoning as the Gmail path: hasAttachments alone is enough to
    // warrant a look, regardless of subject/preview wording.
    if (!msg.hasAttachments && !KEYWORDS.some((k) => haystack.includes(k))) continue;

    let attachment: CandidateAttachment | null = null;
    if (msg.hasAttachments) {
      try {
        attachment = await fetchOutlookAttachment(accessToken, msg.id);
      } catch (err) {
        console.error(`Failed to fetch Outlook attachment for message ${msg.id}`, err);
      }
    }

    const bodyText = msg.body?.contentType === "html" ? stripHtml(msg.body.content ?? "") : (msg.body?.content ?? msg.bodyPreview ?? "");
    candidates.push({ messageId: msg.id, subject: msg.subject ?? "", bodyText, attachment });
  }
  return candidates;
}

// --- Claude extraction

async function extractPcnFromEmailText(
  subject: string,
  bodyText: string,
  attachment: CandidateAttachment | null
): Promise<Extraction | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const textBlock = {
    type: "text",
    text: `Subject: ${subject}\n\nBody:\n${bodyText.slice(0, 12000)}\n\nUse the tool to record what this email says about a UK parking/traffic penalty notice, or report isPcn: false if it isn't genuinely about one. Never guess or invent a value — use null for anything not actually stated. Never calculate a deadline yourself; only fill discountDeadline/finalDeadline if a specific date is explicitly written in the email or its attachment.`,
  };

  // A supported attachment (the actual notice, when the email body is
  // near-empty) goes to Claude the same way a manual OCR upload does —
  // as a document/image block alongside the text, not a separate call.
  const attachmentBlock = attachment
    ? attachment.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: attachment.base64Data } }
      : { type: "image", source: { type: "base64", media_type: attachment.mimeType, data: attachment.base64Data } }
    : null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-5",
      max_tokens: 1024,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
      messages: [
        {
          role: "user",
          content: attachmentBlock ? [textBlock, attachmentBlock] : [textBlock],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error(`Claude extraction failed: ${res.status} ${await res.text()}`);
    return null;
  }

  const json = await res.json();
  const toolUse = (json.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  if (!toolUse) return null;
  return toolUse.input as Extraction;
}

// --- New-case notification
//
// Without this, "catches it in minutes" (the master plan's whole pitch
// for this pipeline, Part 1.1) delivered nothing of the sort in
// practice — a case appeared in the database, but nobody found out
// until they happened to open the dashboard. The T-7/T-2/T-1 deadline
// reminders (send-reminders) don't cover this: those fire close to a
// deadline, not the moment something is actually detected. Same Resend
// sandbox-address caveat as send-reminders/index.ts until a Planal
// domain is verified there.

const FROM_EMAIL = "Planal <onboarding@resend.dev>";

async function sendNewCaseEmail(apiKey: string, to: string, vrm: string, issuerName: string | null) {
  const issuer = issuerName ?? "an issuer";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: `Planal — new PCN found for ${vrm}`,
      text: `We found a new penalty notice for ${vrm} from ${issuer} in your connected inbox. Log in to Planal to see the details, the deadline, and your appeal options.`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function notifyNewCase(
  supabase: ReturnType<typeof createClient>,
  resendKey: string | undefined,
  ownerType: "individual" | "organisation",
  ownerId: string,
  vrm: string,
  issuerName: string | null
) {
  if (!resendKey) return; // inert without the key, same pattern as send-reminders
  try {
    let emails: string[] = [];
    if (ownerType === "individual") {
      const { data } = await supabase.from("users").select("email").eq("id", ownerId).maybeSingle();
      if (data?.email) emails = [data.email as string];
    } else {
      const { data } = await supabase
        .from("memberships")
        .select("users(email)")
        .eq("organisation_id", ownerId)
        .eq("role", "admin")
        .returns<{ users: { email: string | null } }[]>();
      emails = (data ?? []).map((m) => m.users?.email).filter((e): e is string => Boolean(e));
    }
    for (const email of emails) {
      await sendNewCaseEmail(resendKey, email, vrm, issuerName);
    }
  } catch (err) {
    // Never let a notification failure undo or block the case that was
    // already successfully created — log and move on.
    console.error("Failed to send new-case notification", err);
  }
}

// --- Main

Deno.serve(async (req: Request) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const resendKey = Deno.env.get("RESEND_API_KEY");

  const { data: connections, error: connectionsError } = await supabase
    .from("email_connections")
    .select("id, owner_type, owner_user_id, owner_organisation_id, provider, encrypted_access_token, encrypted_refresh_token, token_expires_at, last_scanned_at, created_by")
    .eq("status", "connected")
    .limit(BATCH_CONNECTIONS_LIMIT);

  if (connectionsError) {
    return new Response(JSON.stringify({ error: connectionsError.message }), { status: 500 });
  }

  let scanned = 0;
  let casesCreated = 0;
  let failed = 0;

  for (const conn of connections ?? []) {
    try {
      const sinceIso = conn.last_scanned_at
        ? new Date(new Date(conn.last_scanned_at).getTime() - OVERLAP_BUFFER_MINUTES * 60_000).toISOString()
        : new Date(Date.now() - INITIAL_LOOKBACK_HOURS * 3600_000).toISOString();

      let accessToken = await decryptToken(conn.encrypted_access_token);
      const expiresAt = new Date(conn.token_expires_at).getTime();
      const needsRefresh = expiresAt - Date.now() < 5 * 60_000;

      if (needsRefresh) {
        const refreshToken = await decryptToken(conn.encrypted_refresh_token);
        if (conn.provider === "gmail") {
          const refreshed = await refreshGoogleAccessToken(refreshToken);
          accessToken = refreshed.accessToken;
          await supabase
            .from("email_connections")
            .update({
              encrypted_access_token: await encryptToken(refreshed.accessToken),
              token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
            })
            .eq("id", conn.id);
        } else {
          const refreshed = await refreshMicrosoftAccessToken(refreshToken);
          accessToken = refreshed.accessToken;
          await supabase
            .from("email_connections")
            .update({
              encrypted_access_token: await encryptToken(refreshed.accessToken),
              encrypted_refresh_token: await encryptToken(refreshed.refreshToken),
              token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
            })
            .eq("id", conn.id);
        }
      }

      const candidates =
        conn.provider === "gmail"
          ? await fetchGmailCandidates(accessToken, sinceIso)
          : await fetchOutlookCandidates(accessToken, sinceIso);

      // Vehicles this connection is allowed to attribute a case to — the
      // mailbox owner's own vehicles only. cases_vehicle_must_be_verified
      // (0010) is the actual enforcement; this is just how we pick the
      // right vehicle_id to insert.
      const { data: candidateVehicles } = await supabase
        .from("vehicles")
        .select("id, vrm")
        .eq("owner_type", conn.owner_type)
        .eq(conn.owner_type === "individual" ? "owner_user_id" : "owner_organisation_id", conn.owner_type === "individual" ? conn.owner_user_id : conn.owner_organisation_id);

      const vehicleByVrm = new Map((candidateVehicles ?? []).map((v: { id: string; vrm: string }) => [normalizeVrm(v.vrm), v.id]));

      for (const candidate of candidates) {
        scanned++;
        const extraction = await extractPcnFromEmailText(candidate.subject, candidate.bodyText, candidate.attachment);
        if (!extraction || !extraction.isPcn) continue;

        const vehicleId = extraction.vrm ? vehicleByVrm.get(normalizeVrm(extraction.vrm)) : undefined;
        if (!vehicleId) {
          // No VRM stated, or it doesn't match any of this mailbox
          // owner's own vehicles — never create a case against a vehicle
          // outside the account this mailbox belongs to.
          continue;
        }

        const computed = computeDeadlines(extraction.issuerType, extraction.noticeDate);

        const { data: caseRow, error: insertError } = await supabase
          .from("cases")
          .insert({
            vehicle_id: vehicleId,
            source: "email_auto",
            source_message_id: candidate.messageId,
            status: "reviewing",
            issuer_name: extraction.issuerName,
            issuer_type: extraction.issuerType,
            reference_number: extraction.referenceNumber,
            contravention_code: extraction.contraventionCode,
            contravention_description: extraction.contraventionDescription,
            location_text: extraction.locationText,
            event_datetime: extraction.eventDatetime,
            notice_date: extraction.noticeDate,
            amount_full: extraction.amountFull,
            amount_discounted: extraction.amountDiscounted,
            discount_deadline: extraction.discountDeadline ?? computed?.discountDeadline ?? null,
            final_deadline: extraction.finalDeadline ?? computed?.finalDeadline ?? null,
            raw_ocr_json: extraction,
            created_by: conn.created_by,
          })
          .select("id")
          .single();

        if (!insertError && caseRow) {
          casesCreated++;

          if (candidate.attachment) {
            // Same evidence bucket/path convention as a manual upload
            // (src/app/dashboard/cases/actions.ts) — "{vehicleId}/{ts}-{filename}"
            // — so it shows up identically on the case's Evidence tab.
            try {
              const path = `${vehicleId}/${Date.now()}-${candidate.attachment.filename}`;
              const bytes = Uint8Array.from(atob(candidate.attachment.base64Data), (c) => c.charCodeAt(0));
              const { error: uploadError } = await supabase.storage
                .from("case-evidence")
                .upload(path, bytes, { contentType: candidate.attachment.mimeType });
              if (!uploadError) {
                await supabase.from("evidence").insert({
                  case_id: caseRow.id,
                  file_ref: path,
                  evidence_type: candidate.attachment.mimeType === "application/pdf" ? "ticket_pdf" : "ticket_photo",
                  uploaded_by: conn.created_by,
                });
              } else {
                console.error(`Failed to upload evidence for message ${candidate.messageId}`, uploadError);
              }
            } catch (err) {
              // Evidence is a bonus on top of an already-created case —
              // never let a storage/decoding failure here look like the
              // whole scan failed.
              console.error(`Failed to save evidence for message ${candidate.messageId}`, err);
            }
          }

          await notifyNewCase(
            supabase,
            resendKey,
            conn.owner_type,
            conn.owner_type === "individual" ? conn.owner_user_id! : conn.owner_organisation_id!,
            extraction.vrm!,
            extraction.issuerName
          );
        } else if (insertError && !insertError.message.includes("cases_source_message_id_unique")) {
          // A real failure (e.g. verification not passed) — log and move
          // on rather than losing the rest of the batch.
          console.error(`Case insert failed for message ${candidate.messageId}`, insertError);
        }
      }

      await supabase.from("email_connections").update({ last_scanned_at: new Date().toISOString() }).eq("id", conn.id);
    } catch (err) {
      failed++;
      console.error(`Scan failed for connection ${conn.id}`, err);
    }
  }

  return new Response(JSON.stringify({ connectionsScanned: (connections ?? []).length, messagesScanned: scanned, casesCreated, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
