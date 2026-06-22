"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { generateClassroomDiagnosticReport } from "@/lib/gemini";
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

import { getJoinedTeams, getTeamMembers } from "@/lib/microsoftGraph";

export async function fetchTeacherTeams() {
  const teacher = await requireTeacher();
  try {
    const teams = await getJoinedTeams(teacher.userId);
    return { teams };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch Teams classes." };
  }
}

export async function syncClassroomRoster(classroomId: string) {
  const teacher = await requireTeacher();
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.userId },
  });

  if (!classroom || !classroom.msGraphClassId) {
    return { error: "Classroom not found or not linked to Microsoft Teams." };
  }

  try {
    const members = await getTeamMembers(teacher.userId, classroom.msGraphClassId);
    // Filter for members who are NOT owners (i.e. students)
    const studentMembers = members.filter((m: { roles: string[]; email?: string | null }) => !m.roles.includes("owner"));

    let enrolledCount = 0;

    for (const member of studentMembers) {
      if (!member.email) continue;
      const email = member.email.toLowerCase();

      // Find or create student user
      let student = await prisma.user.findFirst({
        where: {
          OR: [
            { microsoftEmail: email },
            { username: email.split("@")[0] }
          ]
        }
      });

      if (!student) {
        // Create new student account
        const randomPass = Math.random().toString(36).substring(2, 12);
        const passwordHash = await bcrypt.hash(randomPass, 10);
        student = await prisma.user.create({
          data: {
            username: email.split("@")[0] + "_" + Math.floor(100 + Math.random() * 900), // append random digits for uniqueness
            passwordHash,
            role: "STUDENT",
            active: true,
            microsoftEmail: email,
            microsoftId: member.userId,
          }
        });
      } else if (!student.microsoftId) {
        // Link student's Microsoft ID if they existed but weren't linked
        student = await prisma.user.update({
          where: { id: student.id },
          data: {
            microsoftId: member.userId,
            microsoftEmail: email,
          }
        });
      }

      // Check enrollment
      const enrolled = await prisma.classroomStudent.findUnique({
        where: {
          classroomId_studentId: {
            classroomId: classroom.id,
            studentId: student.id
          }
        }
      });

      if (!enrolled) {
        await prisma.classroomStudent.create({
          data: {
            classroomId: classroom.id,
            studentId: student.id
          }
        });
        enrolledCount++;
      }
    }

    revalidatePath("/teacher");
    return { success: true, enrolledCount };
  } catch (error: any) {
    console.error("Failed to sync classroom roster:", error);
    return { error: error.message || "Failed to sync roster from Microsoft Teams." };
  }
}

export async function createClassroom(name: string, msGraphClassId?: string) {
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
        msGraphClassId: msGraphClassId || null,
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

export async function addStudentToClassroomByUsername(classroomId: string, username: string) {
  const teacher = await requireTeacher();

  if (!classroomId || typeof classroomId !== "string") {
    return { error: "Invalid classroom ID" };
  }
  if (!username || typeof username !== "string") {
    return { error: "Username is required" };
  }

  const normalizedUsername = username.trim().toLowerCase();

  try {
    // 1. Verify teacher owns the classroom
    const classroom = await prisma.classroom.findFirst({
      where: {
        id: classroomId,
        teacherId: teacher.userId,
      },
    });
    if (!classroom) {
      return { error: "Classroom not found or access denied." };
    }

    // 2. Find the user with that username
    const studentUser = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    if (!studentUser) {
      return { error: `User "${username}" not found.` };
    }

    // 3. Ensure role is STUDENT
    if (studentUser.role !== "STUDENT") {
      return { error: `User "${username}" is not a student.` };
    }

    // 4. Check if already enrolled
    const exists = await prisma.classroomStudent.findUnique({
      where: {
        classroomId_studentId: {
          classroomId,
          studentId: studentUser.id,
        },
      },
    });
    if (exists) {
      return { error: `Student "${username}" is already in this class.` };
    }

    // 5. Enroll student
    await prisma.classroomStudent.create({
      data: {
        classroomId,
        studentId: studentUser.id,
      },
    });

    revalidatePath(`/teacher/classrooms/${classroomId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to add student by username:", error);
    return { error: "Failed to add student due to a database error." };
  }
}

export async function generateClassroomDiagnosticAction(classroomId: string) {
  const teacher = await requireTeacher();

  if (!classroomId || typeof classroomId !== "string") {
    return { error: "Invalid classroom ID" };
  }

  try {
    // 1. Fetch classroom data
    const classroom = await prisma.classroom.findFirst({
      where: {
        id: classroomId,
        teacherId: teacher.userId,
      },
      include: {
        students: {
          include: {
            student: {
              include: {
                submissions: {
                  where: {
                    assignment: {
                      classroomId,
                    },
                  },
                  include: {
                    assignment: {
                      include: {
                        exercise: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        assignments: {
          include: {
            exercise: true,
            submissions: true,
          },
        },
      },
    });

    if (!classroom) {
      return { error: "Classroom not found or access denied." };
    }

    if (classroom.students.length === 0) {
      return { error: "No students in this classroom to analyze." };
    }

    // 2. Compile stats
    const totalStudents = classroom.students.length;
    let overallSum = 0;
    let overallCount = 0;

    // Averages per category/type
    const categoryScores: Record<string, { sum: number; count: number }> = {};
    // Exercise difficulties
    const exerciseScores: Record<string, { title: string; sum: number; count: number }> = {};
    // Student individual stats
    const studentStats: Array<{ username: string; average: number; struggles: string[] }> = [];

    classroom.students.forEach(({ student }) => {
      let studentSum = 0;
      let studentCount = 0;
      const studentCategoryScores: Record<string, { sum: number; count: number }> = {};

      student.submissions.forEach((sub) => {
        const score = sub.teacherScore !== null ? sub.teacherScore : sub.effectiveScore;
        const exType = sub.assignment.exercise.type || "worksheet";

        // Classroom overall
        overallSum += score;
        overallCount++;

        // Student overall
        studentSum += score;
        studentCount++;

        // Category averages
        if (!categoryScores[exType]) categoryScores[exType] = { sum: 0, count: 0 };
        categoryScores[exType].sum += score;
        categoryScores[exType].count++;

        if (!studentCategoryScores[exType]) studentCategoryScores[exType] = { sum: 0, count: 0 };
        studentCategoryScores[exType].sum += score;
        studentCategoryScores[exType].count++;

        // Exercise averages
        const exId = sub.assignment.exerciseId;
        if (!exerciseScores[exId]) {
          exerciseScores[exId] = { title: sub.assignment.exercise.title, sum: 0, count: 0 };
        }
        exerciseScores[exId].sum += score;
        exerciseScores[exId].count++;
      });

      if (studentCount > 0) {
        const avg = studentSum / studentCount;
        const struggles: string[] = [];

        // Check which categories they struggle in
        Object.entries(studentCategoryScores).forEach(([cat, data]) => {
          const catAvg = data.sum / data.count;
          if (catAvg < 75) {
            struggles.push(cat);
          }
        });

        studentStats.push({
          username: student.username,
          average: Math.round(avg),
          struggles,
        });
      }
    });

    const overallClassAverage = overallCount > 0 ? Math.round(overallSum / overallCount) : "—";

    const finalCategoryAverages: Record<string, number> = {};
    Object.entries(categoryScores).forEach(([cat, data]) => {
      finalCategoryAverages[cat] = Math.round(data.sum / data.count);
    });

    const lowScoringExercises: Array<{ title: string; average: number }> = [];
    Object.values(exerciseScores).forEach((data) => {
      const avg = Math.round(data.sum / data.count);
      if (avg < 75) {
        lowScoringExercises.push({ title: data.title, average: avg });
      }
    });

    const strugglingStudents = studentStats.filter((s) => s.average < 75);

    // 3. Call Gemini helper
    const diagnosticReport = await generateClassroomDiagnosticReport({
      className: classroom.name,
      numStudents: totalStudents,
      classAverage: overallClassAverage,
      categoryAverages: finalCategoryAverages,
      strugglingStudents,
      lowScoringExercises,
    });

    // 4. Update classroom
    await prisma.classroom.update({
      where: { id: classroomId },
      data: {
        aiDiagnostic: diagnosticReport,
        aiDiagnosticDate: new Date(),
      },
    });

    revalidatePath(`/teacher/classrooms/${classroomId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to generate classroom diagnostic action:", error);
    const message = error instanceof Error ? error.message : "Failed to generate AI insights due to an error.";
    return { error: message };
  }
}
