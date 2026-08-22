// Outlook/Microsoft Graph OAuth (read-only email monitoring) — Part 6/Part
// 8 Phase 7. Standard OAuth 2.0 authorization-code flow on the Microsoft
// identity platform v2.0 endpoints; verified against Microsoft's current
// docs (learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow)
// rather than assumed. Same "untestable without real credentials" caveat
// as src/lib/google-oauth.ts — Zaryab needs to register an app in Azure AD
// himself (Part 7); this follows the documented flow but hasn't been
// exercised against a live Microsoft consent screen.

const TOKEN_ENDPOINT_BASE = "https://login.microsoftonline.com";

// Read-only, per Part 6 — never request write/send/delete scopes.
export const GRAPH_MAIL_READ_SCOPE = "https://graph.microsoft.com/Mail.Read";

function getTenant(): string {
  // "common" supports both work/school and personal Microsoft accounts —
  // the right default for arbitrary fleet/individual users. Overridable
  // via MS_OAUTH_TENANT_ID if a specific tenant is ever needed.
  return process.env.MS_OAUTH_TENANT_ID || "common";
}

export function isMicrosoftOAuthConfigured(): boolean {
  return Boolean(process.env.MS_OAUTH_CLIENT_ID && process.env.MS_OAUTH_CLIENT_SECRET && process.env.MS_OAUTH_REDIRECT_URI);
}

export function buildMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MS_OAUTH_CLIENT_ID!,
    redirect_uri: process.env.MS_OAUTH_REDIRECT_URI!,
    response_type: "code",
    response_mode: "query",
    scope: `openid email offline_access ${GRAPH_MAIL_READ_SCOPE}`,
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
      scope: `openid email offline_access ${GRAPH_MAIL_READ_SCOPE}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Microsoft token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
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
