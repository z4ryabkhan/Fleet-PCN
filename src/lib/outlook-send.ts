// Actually sends the appeal via Outlook/Microsoft Graph, from the user's
// own connected account — same "recipient is never guessed" rule as
// src/lib/gmail-send.ts. Requires the Mail.Send delegated scope
// (src/lib/microsoft-oauth.ts), which didn't exist before this — anyone
// connected before it was added needs to reconnect.

export type EmailAttachment = { filename: string; mimeType: string; data: Buffer };

function attachmentsPayload(attachments: EmailAttachment[]) {
  return attachments.map((a) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: a.filename,
    contentType: a.mimeType,
    contentBytes: a.data.toString("base64"),
  }));
}

/** Sends the message immediately via Microsoft Graph. Returns the sent
 * message's id and conversationId, or null if the send failed. Uses the
 * create-then-send pattern (POST /messages, then POST
 * /messages/{id}/send) rather than the simpler /sendMail, purely to get an
 * id and conversationId back — /sendMail returns no body at all, which
 * left evidence-on-request's reply-checking (see scan-mailboxes) with
 * nothing to poll against. */
export async function sendOutlookAppeal(
  accessToken: string,
  params: { to: string; subject: string; bodyText: string; attachments: EmailAttachment[] }
): Promise<{ messageId: string; threadId: string } | null> {
  const createRes = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: params.subject,
      body: { contentType: "text", content: params.bodyText },
      toRecipients: [{ emailAddress: { address: params.to } }],
      attachments: attachmentsPayload(params.attachments),
    }),
  });

  if (!createRes.ok) {
    console.error("Outlook draft create failed", createRes.status, await createRes.text());
    return null;
  }

  const draft = await createRes.json();

  const sendRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!sendRes.ok) {
    console.error("Outlook send failed", sendRes.status, await sendRes.text());
    return null;
  }

  return { messageId: draft.id, threadId: draft.conversationId };
}

/** Sends evidence as a reply in the same conversation as the original
 * appeal — evidence-on-request (Zaryab's spec): only ever called after the
 * user has approved sending, and only once an issuer's reply has actually
 * asked for it. Graph's createReply/send pair threads automatically (no
 * manual In-Reply-To/References needed, unlike Gmail) — createReply makes
 * a draft reply to the named message, attachments are added to that draft,
 * then it's sent. */
export async function sendOutlookEvidenceReply(
  accessToken: string,
  params: { inReplyToMessageId: string; bodyText: string; attachments: EmailAttachment[] }
): Promise<{ messageId: string; threadId: string } | null> {
  const replyRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${params.inReplyToMessageId}/createReply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: params.bodyText }),
    }
  );

  if (!replyRes.ok) {
    console.error("Outlook createReply failed", replyRes.status, await replyRes.text());
    return null;
  }

  const draft = await replyRes.json();

  for (const attachment of attachmentsPayload(params.attachments)) {
    const attachRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/attachments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(attachment),
    });
    if (!attachRes.ok) {
      console.error("Outlook reply attachment failed", attachRes.status, await attachRes.text());
      return null;
    }
  }

  const sendRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!sendRes.ok) {
    console.error("Outlook evidence reply send failed", sendRes.status, await sendRes.text());
    return null;
  }

  return { messageId: draft.id, threadId: draft.conversationId };
}
