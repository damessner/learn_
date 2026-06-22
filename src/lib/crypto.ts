import crypto from "crypto";
import { SESSION_SECRET } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

// Derive a 32-byte key from the validated secret
const key = crypto.scryptSync(SESSION_SECRET, "learn-token-salt", 32);

/**
 * Encrypt a plain-text token using AES-256-GCM.
 */
export function encryptToken(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted token.
 * Returns null if decryption fails.
 */
export function decryptToken(encryptedText: string): string | null {
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}
