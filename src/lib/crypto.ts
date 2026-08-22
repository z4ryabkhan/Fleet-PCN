import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// OAuth token encryption at rest — Part 4 rule 6. AES-256-GCM: random 12-byte
// IV per encryption, auth tag appended, all base64-joined so a single text
// column can store it. ENCRYPTION_KEY_FOR_OAUTH_TOKENS is a locally
// generated app secret (not a third-party credential) — 32 raw bytes,
// base64-encoded in .env.local.

function getKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY_FOR_OAUTH_TOKENS;
  if (!b64) {
    throw new Error("ENCRYPTION_KEY_FOR_OAUTH_TOKENS is not configured.");
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY_FOR_OAUTH_TOKENS must decode to 32 bytes.");
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
