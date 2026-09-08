// Creates the AI-drafted appeal as a real Gmail draft in the user's own
// mailbox, so they can review and send it from Gmail itself instead of
// copy-pasting out of Planal's UI — added per Zaryab's explicit request
// (2026-09-08). Uses the gmail.compose scope (src/lib/google-oauth.ts)
// and only ever calls drafts.create — never anything that sends. The
// draft has no recipient filled in: Planal has no directory of which
// email address (if any — many UK PCN appeals go through a web portal,
// not email) a given issuer actually accepts appeals at, and guessing
// one would be worse than leaving it blank for the user to fill in
// themselves. Untested against a live Gmail account — see
// src/lib/google-oauth.ts's header comment for why.

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/** Builds a minimal RFC 2822 message with no To/From (Gmail fills From in
 * from the authenticated account; To is left for the user to fill in in
 * the Gmail compose window before sending). */
function buildRawMessage(subject: string, bodyText: string): string {
  // RFC 2822 header values shouldn't contain raw newlines; Subject is the
  // only header taking user/AI-generated text, so it's the only one that
  // needs sanitizing here.
  const safeSubject = subject.replace(/[\r\n]+/g, " ").trim();
  const message = [
    `Subject: =?UTF-8?B?${Buffer.from(safeSubject, "utf8").toString("base64")}?=`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(bodyText, "utf8").toString("base64"),
  ].join("\r\n");
  return base64UrlEncode(message);
}

export async function createGmailAppealDraft(
  accessToken: string,
  params: { subject: string; bodyText: string }
): Promise<{ draftId: string } | null> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: { raw: buildRawMessage(params.subject, params.bodyText) },
    }),
  });

  if (!res.ok) {
    console.error("Gmail draft creation failed", res.status, await res.text());
    return null;
  }

  const json = await res.json();
  return { draftId: json.id };
}
