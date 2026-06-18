import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/session";
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  buildRateLimitKey,
} from "@/lib/rateLimit";
import { headers } from "next/headers";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    // Validate input types and lengths
    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid input types" }, { status: 400 });
    }
    if (username.length > 64 || password.length > 128) {
      return NextResponse.json({ error: "Input too long" }, { status: 400 });
    }
    const normalizedUsername = username.trim().toLowerCase();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Rate limiting: build key from username and best-effort IP
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
      || headersList.get("x-real-ip")
      || "unknown";
    const rateLimitKey = buildRateLimitKey(normalizedUsername, ip);

    // Check if this key is currently blocked
    const { blocked } = checkRateLimit(rateLimitKey);
    if (blocked) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (!user) {
      // Record failure before returning
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 400 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      // Record failure before returning
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 400 }
      );
    }

    // Check if account is activated by admin
    if (!user.active) {
      return NextResponse.json(
        { error: "Account not yet activated. Please contact an administrator." },
        { status: 403 }
      );
    }

    // Successful login: clear rate limit for this key
    clearRateLimit(rateLimitKey);

    // Establish session
    await setSession({
      userId: user.id,
      username: user.username,
      role: user.role as "ADMIN" | "TEACHER" | "STUDENT",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
