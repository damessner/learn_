import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { username, password, role, joinCode } = await request.json();

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

    // Check if username is taken
    const existingUser = await prisma.user.findUnique({
      where: { username },
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
          username,
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
