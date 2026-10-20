import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const cookieName = "helloai-google-session";

function key() {
  return createHash("sha256").update(process.env.GOOGLE_SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || "helloai-development-session").digest();
}

export function getGoogleSessionCookieName() {
  return cookieName;
}

export function encryptGoogleSession(value: { accessToken: string; refreshToken?: string; expiresAt: number }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleSession(value: string) {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted) as { accessToken: string; refreshToken?: string; expiresAt: number };
  } catch {
    return null;
  }
}
