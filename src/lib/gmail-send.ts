// Actually sends the appeal via Gmail, from the user's own connected
// account — build brief section 3 step 6 ("Send by email from their own
// connected account with evidence attached"). Uses the same gmail.compose
// scope already granted for drafts: Google's own scope description for
// gmail.compose is "Create, read, update, and delete drafts. Send messages
// and drafts" — it already covers users.messages.send, no new consent
// needed from anyone already connected.
//
// The recipient is never inferred or guessed here — it's passed in by the
// caller, which only ever gets it from the user's own typed input or a
// verified issuers-table row (never fabricated). Confirmed with Zaryab
// (2026-09) that clicking Send is the explicit per-send confirmation Part 9
// rule 2 requires — the send happens immediately, there is no separate
// "open Gmail and press send yourself" step for this path (that's what
// createGmailAppealDraft is still for, kept as a lower-key alternative).

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.isBuffer(input) ? input.toString("base64url") : Buffer.from(input, "utf8").toString("base64url");
}

function encodeHeaderValue(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export type EmailAttachment = { filename: string; mimeType: string; data: Buffer };

function buildMimeMessage(
  params: {
    to: string;
    subject: string;
    bodyText: string;
    attachments: EmailAttachment[];
  },
  replyToMessageIdHeader?: string | null
): string {
  const safeSubject = params.subject.replace(/[\r\n]+/g, " ").trim();
  const safeTo = params.to.replace(/[\r\n]+/g, " ").trim();
  const boundary = `planal_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const lines = [
    `To: ${safeTo}`,
    `Subject: ${encodeHeaderValue(safeSubject)}`,
    ...(replyToMessageIdHeader
      ? [`In-Reply-To: ${replyToMessageIdHeader}`, `References: ${replyToMessageIdHeader}`]
      : []),
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(params.bodyText, "utf8").toString("base64"),
    ``,
  ];

  for (const attachment of params.attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      attachment.data.toString("base64"),
      ``
    );
  }

  lines.push(`--${boundary}--`);
  return base64UrlEncode(lines.join("\r\n"));
}

/** Sends the message immediately via the Gmail API. Returns the sent
 * message's id and threadId, or null if the send failed (caller surfaces
 * this as an error — a failed send must never be reported to the user as
 * sent). threadId is what evidence-on-request reply-checking (see
 * scan-mailboxes) later polls to find the issuer's reply. */
export async function sendGmailAppeal(
  accessToken: string,
  params: { to: string; subject: string; bodyText: string; attachments: EmailAttachment[] }
): Promise<{ messageId: string; threadId: string } | null> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: buildMimeMessage(params) }),
  });

  if (!res.ok) {
    console.error("Gmail send failed", res.status, await res.text());
    return null;
  }

  const json = await res.json();
  return { messageId: json.id, threadId: json.threadId };
}

/** Looks up the RFC822 Message-ID header of a message we sent, needed to
 * set In-Reply-To/References on a same-thread reply — Gmail's own
 * `id`/`threadId` aren't valid values for those headers, only the actual
 * Message-ID is. */
async function fetchGmailMessageIdHeader(accessToken: string, messageId: string): Promise<string | null> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`);
  url.searchParams.set("format", "metadata");
  url.searchParams.append("metadataHeaders", "Message-ID");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const json = await res.json();
  const header = (json.payload?.headers ?? []).find((h: { name: string }) => h.name === "Message-ID");
  return header?.value ?? null;
}

/** Sends evidence as a reply in the same thread as the original appeal —
 * evidence-on-request (Zaryab's spec): only ever called after the user has
 * approved sending, and only once an issuer's reply has actually asked for
 * it (never proactively). Threads via the same threadId as the original
 * send plus a proper In-Reply-To/References chain, since Gmail's threading
 * isn't reliable on threadId alone without it. */
export async function sendGmailEvidenceReply(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    bodyText: string;
    attachments: EmailAttachment[];
    threadId: string;
    inReplyToMessageId: string;
  }
): Promise<{ messageId: string; threadId: string } | null> {
  const messageIdHeader = await fetchGmailMessageIdHeader(accessToken, params.inReplyToMessageId);
  const safeSubject = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject}`;
  const raw = buildMimeMessage(
    { to: params.to, subject: safeSubject, bodyText: params.bodyText, attachments: params.attachments },
    messageIdHeader
  );

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw, threadId: params.threadId }),
  });

  if (!res.ok) {
    console.error("Gmail evidence reply send failed", res.status, await res.text());
    return null;
  }

  const json = await res.json();
  return { messageId: json.id, threadId: json.threadId };
}
