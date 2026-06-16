import { getSession } from "@/lib/session";
import crypto from "crypto";

/**
 * Checks authentication and returns session data.
 * Throws an error or redirects if unauthenticated.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("Authentication required");
  }
  return session;
}

/**
 * Checks if current user is a Teacher.
 */
export async function requireTeacher() {
  const session = await requireAuth();
  if (session.role !== "TEACHER") {
    throw new Error("Unauthorized: Teacher role required");
  }
  return session;
}

/**
 * Checks if current user is an Admin.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin role required");
  }
  return session;
}

/**
 * Checks if current user is a Teacher or Admin.
 */
export async function requireTeacherOrAdmin() {
  const session = await requireAuth();
  if (session.role !== "TEACHER" && session.role !== "ADMIN") {
    throw new Error("Unauthorized: Teacher or Admin role required");
  }
  return session;
}

/**
 * Generates a random 6-character alphanumeric classroom join code using crypto.
 */
export function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}
