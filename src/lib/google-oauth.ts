// Gmail OAuth (read-only email monitoring) — Part 6/Part 8 Phase 6.
// Standard OAuth 2.0 authorization-code web-server flow; endpoints and
// response shape verified against Google's current docs
// (developers.google.com/identity/protocols/oauth2/web-server) rather than
// assumed. Untestable end-to-end without real Google Cloud OAuth
// credentials — Zaryab needs to create those himself (Part 7); this code
// follows the documented flow but hasn't been exercised against a live
// Google consent screen yet.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

// Read-only, per Part 6 — never request write/send/delete scopes.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

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
    scope: `${GMAIL_SCOPE} openid email`,
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
