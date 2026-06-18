"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth, requireTeacher, generateJoinCode } from "./auth-helpers";

// Per-row Zod validation for bulk-imported usernames.
// 2-32 chars, must start with a letter/digit, allowed: lowercase letters, digits, dot, underscore, hyphen.
const BulkUsernameSchema = z
  .string()
  .min(2, "Username must be at least 2 characters")
  .max(32, "Username must be 32 characters or fewer")
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    "Username may only contain lowercase letters, digits, dot, underscore, or hyphen, and must start with a letter or digit"
  );

export async function createClassroom(name: string) {
  const teacher = await requireTeacher();

  if (!name || name.trim() === "") {
    return { error: "Classroom name is required" };
  }
  if (name.trim().length > 200) {
    return { error: "Classroom name must be 200 characters or fewer" };
  }

  try {
    let joinCode = generateJoinCode();
    // Ensure uniqueness
    let exists = await prisma.classroom.findUnique({ where: { joinCode } });
    while (exists) {
      joinCode = generateJoinCode();
      exists = await prisma.classroom.findUnique({ where: { joinCode } });
    }

    await prisma.classroom.create({
      data: {
        name: name.trim(),
        joinCode,
        teacherId: teacher.userId,
      },
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to create classroom:", error);
    return { error: "Database error while creating classroom" };
  }
}

export async function resetStudentPassword(studentId: string, newPasswordStr: string) {
  const teacher = await requireTeacher();
  if (!studentId || typeof studentId !== "string" || studentId.length > 128) {
    return { error: "Invalid student ID" };
  }
  if (!newPasswordStr || newPasswordStr.length < 6 || newPasswordStr.length > 128) {
    return { error: "Password must be between 6 and 128 characters." };
  }

  try {
    // Verify student belongs to one of teacher's classrooms
    const enrolled = await prisma.classroomStudent.findFirst({
      where: {
        studentId,
        classroom: {
          teacherId: teacher.userId,
        },
      },
    });

    if (!enrolled) {
      return { error: "Student not found in your classrooms." };
    }

    const passwordHash = await bcrypt.hash(newPasswordStr, 10);
    await prisma.user.update({
      where: { id: studentId },
      data: { passwordHash },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to reset student password:", error);
    return { error: "Failed to reset student password" };
  }
}

export async function bulkImportStudents(classroomId: string, usernamesCsv: string, defaultPassword?: string) {
  const teacher = await requireTeacher();

  // Validate classroomId
  if (!classroomId || typeof classroomId !== "string" || classroomId.length > 128) {
    return { error: "Invalid classroom ID" };
  }

  // Verify teacher owns the classroom
  const classroom = await prisma.classroom.findFirst({
    where: {
      id: classroomId,
      teacherId: teacher.userId,
    },
  });

  if (!classroom) {
    return { error: "Classroom not found or access denied." };
  }

  if (!usernamesCsv || !usernamesCsv.trim()) {
    return { error: "Please provide a list of usernames." };
  }

  if (!defaultPassword || defaultPassword.trim().length === 0) {
    return { error: "A default password is required for bulk import." };
  }

  const password = defaultPassword.trim();
  if (password.length < 8 || password.length > 128) {
    return { error: "Default password must be between 8 and 128 characters." };
  }
  const defaultPasswordHash = await bcrypt.hash(password, 10);

  // Split raw entries by newline, comma, or semicolon
  const rawEntries = usernamesCsv
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (rawEntries.length === 0) {
    return { error: "No usernames provided." };
  }

  // Per-row Zod validation. Skip empty rows; collect errors for invalid ones
  // so the teacher gets actionable feedback instead of a generic "all failed".
  interface RowError {
    row: number;
    input: string;
    message: string;
  }
  const errors: RowError[] = [];
  const validNames: string[] = [];
  rawEntries.forEach((raw, idx) => {
    // Normalize: usernames are stored lowercase to match the login flow.
    const normalized = raw.toLowerCase();
    const result = BulkUsernameSchema.safeParse(normalized);
    if (result.success) {
      validNames.push(result.data);
    } else {
      errors.push({
        row: idx + 1,
        input: raw,
        message: result.error.issues[0]?.message ?? "Invalid username",
      });
    }
  });

  // Deduplicate within the submitted batch — first occurrence wins.
  const seen = new Set<string>();
  const uniqueNames: string[] = [];
  const dupesSkipped: string[] = [];
  for (const name of validNames) {
    if (seen.has(name)) {
      dupesSkipped.push(name);
    } else {
      seen.add(name);
      uniqueNames.push(name);
    }
  }

  if (uniqueNames.length === 0) {
    return {
      error: "No valid usernames to import.",
      rowErrors: errors,
    };
  }

  let importedCount = 0;
  let enrolledCount = 0;
  let alreadyExistedCount = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const name of uniqueNames) {
        // Find or create student user
        let student = await tx.user.findUnique({
          where: { username: name },
        });

        if (!student) {
          student = await tx.user.create({
            data: {
              username: name,
              passwordHash: defaultPasswordHash,
              role: "STUDENT",
              active: true,
            },
          });
          importedCount++;
        } else if (student.role !== "STUDENT") {
          // Skip users with teacher role
          continue;
        } else {
          alreadyExistedCount++;
        }

        // Check if student is already in this classroom
        const alreadyEnrolled = await tx.classroomStudent.findUnique({
          where: {
            classroomId_studentId: {
              classroomId,
              studentId: student.id,
            },
          },
        });

        if (!alreadyEnrolled) {
          await tx.classroomStudent.create({
            data: {
              classroomId,
              studentId: student.id,
            },
          });
          enrolledCount++;
        }
      }
    });

    revalidatePath(`/teacher/classrooms/${classroomId}`);
    return {
      success: true,
      importedCount,
      enrolledCount,
      alreadyExistedCount,
      defaultPassword: password,
      rowErrors: errors,
      duplicatesSkipped: dupesSkipped,
    };
  } catch (error: unknown) {
    console.error("Failed to bulk import students:", error);
    return { error: "An error occurred during bulk student import." };
  }
}

export async function joinClassroom(joinCode: string) {
  const student = await requireAuth();
  if (student.role !== "STUDENT") {
    return { error: "Only students can join classrooms." };
  }

  if (!joinCode || joinCode.trim().length === 0) {
    return { error: "Join code is required." };
  }
  if (joinCode.trim().length > 20) {
    return { error: "Invalid join code" };
  }

  try {
    const normalizedCode = joinCode.trim().toUpperCase();

    const classroom = await prisma.classroom.findUnique({
      where: { joinCode: normalizedCode },
    });

    if (!classroom) {
      return { error: "Invalid classroom join code. Please check with your teacher." };
    }

    // Check if already enrolled
    const alreadyJoined = await prisma.classroomStudent.findUnique({
      where: {
        classroomId_studentId: {
          classroomId: classroom.id,
          studentId: student.userId,
        },
      },
    });

    if (alreadyJoined) {
      return { error: "You are already a member of this classroom." };
    }

    await prisma.classroomStudent.create({
      data: {
        classroomId: classroom.id,
        studentId: student.userId,
      },
    });

    revalidatePath("/student");
    return { success: true, classroomName: classroom.name };
  } catch (error) {
    console.error("Failed to join classroom:", error);
    return { error: "Database error while joining classroom." };
  }
}
