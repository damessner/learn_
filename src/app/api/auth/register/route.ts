import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/session";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rateLimit";
import { headers } from "next/headers";

export async function POST(request: Request) {
  try {
    const { username, password, role, joinCode } = await request.json();

    // Validate input types
    if (typeof username !== "string" || typeof password !== "string" || typeof role !== "string") {
      return NextResponse.json({ error: "Invalid input types" }, { status: 400 });
    }
    if (username.length > 64) {
      return NextResponse.json({ error: "Username must be 64 characters or fewer" }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: "Password must be 128 characters or fewer" }, { status: 400 });
    }
    const normalizedUsername = username.trim().toLowerCase();

    if (!username || !password || !role) {
      return NextResponse.json(
        { error: "Username, password, and role are required" },
        { status: 400 }
      );
    }

    if (role !== "TEACHER" && role !== "STUDENT") {
      return NextResponse.json(
        { error: "Invalid role. Must be TEACHER or STUDENT" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // IP-based rate limiting for registration
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown";
    const registerRateLimitKey = `register:${ip}`;
    const { blocked: regBlocked } = checkRateLimit(registerRateLimitKey);
    if (regBlocked) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }
    recordFailedAttempt(registerRateLimitKey); // count each registration attempt

    // Check if username is taken
    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      );
    }

    // If student, check joinCode
    let classroom = null;
    if (role === "STUDENT") {
      if (!joinCode) {
        return NextResponse.json(
          { error: "Classroom join code is required for students" },
          { status: 400 }
        );
      }

      const normalizedJoinCode = joinCode.trim().toUpperCase();

      classroom = await prisma.classroom.findUnique({
        where: { joinCode: normalizedJoinCode },
      });

      if (!classroom) {
        return NextResponse.json(
          { error: "Invalid classroom join code" },
          { status: 400 }
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in transaction to ensure consistent student mapping
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: normalizedUsername,
          passwordHash,
          role,
        },
      });

      if (role === "STUDENT" && classroom) {
        await tx.classroomStudent.create({
          data: {
            classroomId: classroom.id,
            studentId: newUser.id,
          },
        });
      }

      return newUser;
    });

    // Establish session
    await setSession({
      userId: user.id,
      username: user.username,
      role: user.role as "TEACHER" | "STUDENT",
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
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
