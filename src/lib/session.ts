import crypto from "crypto";
import { cookies } from "next/headers";
import { SESSION_SECRET } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

// Derive a 32-byte key from the validated secret
const key = crypto.scryptSync(SESSION_SECRET, "learn-platform-salt", 32);

export interface SessionData {
  userId: string;
  username: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string | null {
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

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionVal = cookieStore.get("session")?.value;
  if (!sessionVal) return null;

  const decrypted = decrypt(sessionVal);
  if (!decrypted) return null;

  try {
    const parsed = JSON.parse(decrypted);
    if (
      typeof parsed?.userId !== "string" ||
      typeof parsed?.username !== "string" ||
      (parsed?.role !== "ADMIN" && parsed?.role !== "TEACHER" && parsed?.role !== "STUDENT")
    ) {
      return null;
    }
    return parsed as SessionData;
  } catch {
    return null;
  }
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const encrypted = encrypt(JSON.stringify(data));
  cookieStore.set("session", encrypted, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
