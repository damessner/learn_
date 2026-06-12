"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { syncExercisesToDb } from "@/lib/exercises";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

/**
 * Checks authentication and returns session data.
 * Throws an error or redirects if unauthenticated.
 */
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("Authentication required");
  }
  return session;
}

/**
 * Checks if current user is a Teacher.
 */
async function requireTeacher() {
  const session = await requireAuth();
  if (session.role !== "TEACHER") {
    throw new Error("Unauthorized: Teacher role required");
  }
  return session;
}

/**
 * Generates a random 6-character alphanumeric classroom join code.
 */
function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ==========================================
// Teacher Actions
// ==========================================

export async function createClassroom(name: string) {
  const teacher = await requireTeacher();

  if (!name || name.trim() === "") {
    return { error: "Classroom name is required" };
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

export async function assignExercise(classroomId: string, exerciseId: string, dueDateStr?: string) {
  await requireTeacher();

  try {
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;

    await prisma.assignment.create({
      data: {
        classroomId,
        exerciseId,
        dueDate,
      },
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign exercise:", error);
    return { error: "Failed to create assignment" };
  }
}

export async function triggerManualSync() {
  await requireTeacher();
  try {
    const result = await syncExercisesToDb();
    revalidatePath("/teacher");
    return { success: true, ...result };
  } catch (error) {
    console.error("Sync exercises error:", error);
    return { error: "Failed to synchronize exercises" };
  }
}

import { getAttemptMultiplier } from "@/lib/scoring";

// ==========================================
// Student Actions
// ==========================================

export async function submitAssignment(assignmentId: string, answers: any, score: number) {
  const student = await requireAuth();

  try {
    // Verify assignment exists and student is enrolled in that classroom
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        classroom: {
          include: {
            students: {
              where: { studentId: student.userId },
            },
          },
        },
      },
    });

    if (!assignment || assignment.classroom.students.length === 0) {
      return { error: "Access denied or assignment not found" };
    }

    // Count prior attempts to determine this attempt's number
    const priorCount = await prisma.submission.count({
      where: { assignmentId, studentId: student.userId },
    });

    const attemptNumber = priorCount + 1;
    const multiplier = getAttemptMultiplier(attemptNumber);
    const effectiveScore = score * multiplier;

    // Always create a new submission row — never overwrite
    await prisma.submission.create({
      data: {
        assignmentId,
        studentId: student.userId,
        answersJson: JSON.stringify(answers),
        score,
        effectiveScore,
        attemptNumber,
      },
    });

    revalidatePath("/student");
    return { success: true, attemptNumber, multiplier, effectiveScore };
  } catch (error) {
    console.error("Failed to submit assignment:", error);
    return { error: "Failed to record submission" };
  }
}


export async function createWorksheet(
  id: string,
  type: string,
  title: string,
  description: string,
  content: string,
  isUpdate: boolean = false,
  courseId?: string | null
) {
  await requireTeacher();

  // Validate ID: kebab-case
  const idRegex = /^[a-z0-9-]+$/;
  if (!idRegex.test(id)) {
    return { error: "ID must contain only lowercase letters, numbers, and hyphens (e.g. history-quiz-1)" };
  }

  try {
    const exerciseDir = path.join(process.cwd(), "content", "exercises", id);

    const folderExists = fs.existsSync(exerciseDir);

    if (!folderExists) {
      fs.mkdirSync(exerciseDir, { recursive: true });
    }

    // Clean up previous content files when overwriting an existing exercise
    if (isUpdate || folderExists) {
      const mdPath = path.join(exerciseDir, "index.md");
      const jsonPath = path.join(exerciseDir, "index.json");
      if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    }

    if (type === "gap-fill") {
      const mdContent = `---
id: ${id}
title: ${title}
description: ${description}
type: gap-fill
---
${content}
`;
      fs.writeFileSync(path.join(exerciseDir, "index.md"), mdContent, "utf-8");
    } else {
      const parsedContent = JSON.parse(content);
      const jsonContent = {
        id,
        title,
        description,
        type,
        ...parsedContent,
      };
      fs.writeFileSync(
        path.join(exerciseDir, "index.json"),
        JSON.stringify(jsonContent, null, 2),
        "utf-8"
      );
    }

    await syncExercisesToDb();

    // If a courseId is provided, link the exercise to that course
    if (courseId) {
      // Get the current max order in this course
      const maxOrder = await prisma.exercise.findFirst({
        where: { courseId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const nextOrder = (maxOrder?.order ?? -1) + 1;

      await prisma.exercise.update({
        where: { id },
        data: { courseId, order: nextOrder },
      });
    }

    revalidatePath("/teacher");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to write worksheet file:", err);
    return { error: `Failed to save worksheet: ${err.message}` };
  }
}

export async function uploadMedia(exerciseId: string, filename: string, base64Data: string) {
  await requireTeacher();
  try {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const assetsDir = path.join(process.cwd(), "content", "exercises", exerciseId, "assets");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(path.join(assetsDir, cleanFilename), buffer);
    return { success: true, filepath: cleanFilename };
  } catch (error: any) {
    console.error("Upload media error:", error);
    return { error: `Upload failed: ${error.message}` };
  }
}

// ==========================================
// Course Actions
// ==========================================

export async function createCourse(title: string, description?: string) {
  await requireTeacher();

  if (!title || title.trim() === "") {
    return { error: "Course title is required" };
  }

  try {
    // Get the current max order to place new course at the end
    const maxOrder = await prisma.course.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (maxOrder?.order ?? -1) + 1;

    await prisma.course.create({
      data: {
        title: title.trim(),
        description: description?.trim() || "",
        order: nextOrder,
      },
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to create course:", error);
    return { error: "Database error while creating course" };
  }
}

export async function updateCourse(id: string, title: string, description?: string) {
  await requireTeacher();

  if (!title || title.trim() === "") {
    return { error: "Course title is required" };
  }

  try {
    await prisma.course.update({
      where: { id },
      data: {
        title: title.trim(),
        description: description?.trim() || "",
      },
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to update course:", error);
    return { error: "Database error while updating course" };
  }
}

export async function deleteCourse(id: string) {
  await requireTeacher();

  try {
    // Ungroup all exercises in this course (set courseId to null)
    await prisma.exercise.updateMany({
      where: { courseId: id },
      data: { courseId: null, order: 0 },
    });

    // Delete the course (CourseAssignments cascade)
    await prisma.course.delete({ where: { id } });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete course:", error);
    return { error: "Database error while deleting course" };
  }
}

export async function addExerciseToCourse(exerciseId: string, courseId: string) {
  await requireTeacher();

  try {
    // Get the current max order in this course
    const maxOrder = await prisma.exercise.findFirst({
      where: { courseId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (maxOrder?.order ?? -1) + 1;

    await prisma.exercise.update({
      where: { id: exerciseId },
      data: { courseId, order: nextOrder },
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to add exercise to course:", error);
    return { error: "Database error while adding exercise to course" };
  }
}

export async function removeExerciseFromCourse(exerciseId: string) {
  await requireTeacher();

  try {
    await prisma.exercise.update({
      where: { id: exerciseId },
      data: { courseId: null, order: 0 },
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to remove exercise from course:", error);
    return { error: "Database error while removing exercise from course" };
  }
}

export async function reorderCourseExercises(courseId: string, exerciseIds: string[]) {
  await requireTeacher();

  try {
    // Update order for each exercise
    for (let i = 0; i < exerciseIds.length; i++) {
      await prisma.exercise.update({
        where: { id: exerciseIds[i] },
        data: { order: i },
      });
    }

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to reorder course exercises:", error);
    return { error: "Database error while reordering exercises" };
  }
}

export async function assignCourse(classroomId: string, courseId: string, dueDateStr?: string) {
  await requireTeacher();

  try {
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;

    // Get all exercises in the course
    const exercises = await prisma.exercise.findMany({
      where: { courseId },
      orderBy: { order: "asc" },
    });

    if (exercises.length === 0) {
      return { error: "Course has no exercises to assign" };
    }

    // Create the CourseAssignment
    const courseAssignment = await prisma.courseAssignment.create({
      data: {
        classroomId,
        courseId,
        dueDate,
      },
    });

    // Create individual Assignments for each exercise, linked to the CourseAssignment
    for (const exercise of exercises) {
      await prisma.assignment.create({
        data: {
          classroomId,
          exerciseId: exercise.id,
          dueDate,
          courseAssignmentId: courseAssignment.id,
        },
      });
    }

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign course:", error);
    return { error: "Failed to assign course" };
  }
}

// ==========================================
// Exercise Delete Action
// ==========================================

export async function deleteExercise(exerciseId: string) {
  await requireTeacher();

  try {
    // Delete the exercise folder from disk
    const exerciseDir = path.join(process.cwd(), "content", "exercises", exerciseId);
    if (fs.existsSync(exerciseDir)) {
      fs.rmSync(exerciseDir, { recursive: true, force: true });
    }

    // Delete from DB (cascades to Assignments → Submissions)
    await prisma.exercise.delete({ where: { id: exerciseId } });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete exercise:", error);
    return { error: "Failed to delete exercise" };
  }
}

