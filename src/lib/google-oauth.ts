// Gmail OAuth — Part 6/Part 8 Phase 6, extended per Zaryab's explicit
// request (2026-09-08) to also create the AI-drafted appeal as a real
// Gmail draft the user reviews and sends themselves, rather than only
// copy-pasting it out of Planal's own UI. Standard OAuth 2.0
// authorization-code web-server flow; endpoints and response shape
// verified against Google's current docs
// (developers.google.com/identity/protocols/oauth2/web-server) rather than
// assumed. Untestable end-to-end without real Google Cloud OAuth
// credentials — Zaryab needs to create those himself (Part 7); this code
// follows the documented flow but hasn't been exercised against a live
// Google consent screen yet.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

// gmail.readonly: inbox scanning (Part 6). gmail.compose: creating an
// appeal draft (src/lib/gmail-drafts.ts) — deliberately compose, not
// gmail.modify or gmail.send. compose can create/read/update/delete
// drafts and send an existing draft, but Planal's own code only ever
// calls drafts.create — never messages.send or drafts.send. The appeal
// still only ever reaches a draft; a human still has to open Gmail
// themselves and press send, same "never auto-submit" posture as every
// other appeal-related rule in Part 9.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope: `${GMAIL_SCOPE} ${GMAIL_COMPOSE_SCOPE} openid email`,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

/** Decodes the email address out of the id_token (a JWT) without verifying
 * the signature — safe here because it arrived directly from Google's own
 * token endpoint over TLS in the same request, not from the client. */
export function getEmailFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}

// Node-side token refresh — needed because creating a Gmail draft happens
// synchronously on a user's click (src/lib/gmail-drafts.ts,
// createGmailDraftAction), not on the scan-mailboxes Edge Function's own
// schedule, so a stored access token may well have expired since the
// connection was last used. supabase/functions/scan-mailboxes/index.ts
// has its own equivalent for the same reason, duplicated rather than
// shared because that one runs on Deno and can't import this file.
export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}
