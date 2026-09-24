// Actually sends the appeal via Outlook/Microsoft Graph, from the user's
// own connected account — same "recipient is never guessed" rule as
// src/lib/gmail-send.ts. Requires the Mail.Send delegated scope
// (src/lib/microsoft-oauth.ts), which didn't exist before this — anyone
// connected before it was added needs to reconnect.

export type EmailAttachment = { filename: string; mimeType: string; data: Buffer };

/** Sends the message immediately via Microsoft Graph's sendMail. Returns
 * true on success — sendMail itself returns no body, so there's no
 * message id to hand back, unlike Gmail's send. Caller treats false as a
 * hard failure, never as sent. */
export async function sendOutlookAppeal(
  accessToken: string,
  params: { to: string; subject: string; bodyText: string; attachments: EmailAttachment[] }
): Promise<boolean> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: { contentType: "text", content: params.bodyText },
        toRecipients: [{ emailAddress: { address: params.to } }],
        attachments: params.attachments.map((a) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.filename,
          contentType: a.mimeType,
          contentBytes: a.data.toString("base64"),
        })),
      },
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    console.error("Outlook send failed", res.status, await res.text());
    return false;
  }
  return true;
}
