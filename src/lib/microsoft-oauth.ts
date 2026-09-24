// Outlook/Microsoft Graph OAuth (read-only email monitoring) — Part 6/Part
// 8 Phase 7. Standard OAuth 2.0 authorization-code flow on the Microsoft
// identity platform v2.0 endpoints; verified against Microsoft's current
// docs (learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow)
// rather than assumed. Same "untestable without real credentials" caveat
// as src/lib/google-oauth.ts — Zaryab needs to register an app in Azure AD
// himself (Part 7); this follows the documented flow but hasn't been
// exercised against a live Microsoft consent screen.

const TOKEN_ENDPOINT_BASE = "https://login.microsoftonline.com";

// Read-only, per Part 6 — never request write/send/delete scopes beyond
// this. Mail.Send added for the real appeal-send path (build brief section
// 8 Phase 2) — anyone who connected Outlook before this scope existed
// needs to reconnect before sendOutlookAppeal will work for them; the
// calling action checks connection.scopes and says so explicitly rather
// than failing silently.
export const GRAPH_MAIL_READ_SCOPE = "https://graph.microsoft.com/Mail.Read";
export const GRAPH_MAIL_SEND_SCOPE = "https://graph.microsoft.com/Mail.Send";

function getTenant(): string {
  // "common" supports both work/school and personal Microsoft accounts —
  // the right default for arbitrary fleet/individual users. Overridable
  // via MS_OAUTH_TENANT_ID if a specific tenant is ever needed.
  return process.env.MS_OAUTH_TENANT_ID || "common";
}

export function isMicrosoftOAuthConfigured(): boolean {
  return Boolean(process.env.MS_OAUTH_CLIENT_ID && process.env.MS_OAUTH_CLIENT_SECRET && process.env.MS_OAUTH_REDIRECT_URI);
}

const REQUESTED_SCOPES = `openid email offline_access ${GRAPH_MAIL_READ_SCOPE} ${GRAPH_MAIL_SEND_SCOPE}`;

export function buildMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MS_OAUTH_CLIENT_ID!,
    redirect_uri: process.env.MS_OAUTH_REDIRECT_URI!,
    response_type: "code",
    response_mode: "query",
    scope: REQUESTED_SCOPES,
    state,
  });
  return `${TOKEN_ENDPOINT_BASE}/${getTenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<MicrosoftTokenResponse> {
  const res = await fetch(`${TOKEN_ENDPOINT_BASE}/${getTenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MS_OAUTH_CLIENT_ID!,
      client_secret: process.env.MS_OAUTH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.MS_OAUTH_REDIRECT_URI!,
      scope: REQUESTED_SCOPES,
    }),
  });

  if (!res.ok) {
    throw new Error(`Microsoft token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// Node-side token refresh, mirroring
// supabase/functions/scan-mailboxes/index.ts's Deno copy (duplicated for
// the same reason as refreshGoogleAccessToken in google-oauth.ts — sending
// happens synchronously on a user's click, not on that function's own
// schedule). Microsoft rotates refresh tokens on use, unlike Google's.
export async function refreshMicrosoftAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
  const res = await fetch(`${TOKEN_ENDPOINT_BASE}/${getTenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MS_OAUTH_CLIENT_ID!,
      client_secret: process.env.MS_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: REQUESTED_SCOPES,
    }),
  });
  if (!res.ok) {
    throw new Error(`Microsoft token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return { accessToken: json.access_token, expiresIn: json.expires_in, refreshToken: json.refresh_token };
}

/** Decodes the email out of the id_token (a JWT) without verifying the
 * signature — safe here because it arrived directly from Microsoft's own
 * token endpoint over TLS in the same request, not from the client. */
export function getEmailFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.email ?? decoded.preferred_username ?? null;
  } catch {
    return null;
  }
}

// Microsoft's identity platform has no server-side token revocation
// endpoint equivalent to Google's /revoke — refresh tokens are invalidated
// by the user removing the app's consent in their Microsoft account, or by
// an admin revoking sessions. Locally, revoke still means: stop using the
// stored token and mark the connection 'revoked' (handled in the calling
// action) — there's just no API call to make here first.
