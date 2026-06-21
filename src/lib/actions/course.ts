"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "./auth-helpers";

export async function createCourse(title: string, description?: string) {
  await requireTeacher();

  if (!title || title.trim() === "") {
    return { error: "Course title is required" };
  }
  if (title.trim().length > 200) {
    return { error: "Course title must be 200 characters or fewer" };
  }
  if (description && description.length > 2000) {
    return { error: "Description must be 2000 characters or fewer" };
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

  if (!id || typeof id !== "string" || id.length > 128) {
    return { error: "Invalid course ID" };
  }
  if (!title || title.trim() === "") {
    return { error: "Course title is required" };
  }
  if (title.trim().length > 200) {
    return { error: "Course title must be 200 characters or fewer" };
  }
  if (description && description.length > 2000) {
    return { error: "Description must be 2000 characters or fewer" };
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

  if (!id || typeof id !== "string" || id.length > 128) {
    return { error: "Invalid course ID" };
  }

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

  if (!exerciseId || typeof exerciseId !== "string" || exerciseId.length > 128) {
    return { error: "Invalid exercise ID" };
  }
  if (!courseId || typeof courseId !== "string" || courseId.length > 128) {
    return { error: "Invalid course ID" };
  }

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

  if (!exerciseId || typeof exerciseId !== "string" || exerciseId.length > 128) {
    return { error: "Invalid exercise ID" };
  }

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

export async function unassignCourse(courseAssignmentId: string) {
  const teacher = await requireTeacher();

  if (!courseAssignmentId || typeof courseAssignmentId !== "string" || courseAssignmentId.length > 128) {
    return { error: "Invalid course assignment ID" };
  }

  try {
    // Verify this CourseAssignment belongs to one of this teacher's classrooms
    const ca = await prisma.courseAssignment.findUnique({
      where: { id: courseAssignmentId },
      include: { classroom: true },
    });
    if (!ca || ca.classroom.teacherId !== teacher.userId) {
      return { error: "Access denied" };
    }

    // Delete assignments first (the FK uses onDelete: SetNull, so manual cleanup needed)
    await prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({
        where: { courseAssignmentId },
      });
      await tx.courseAssignment.delete({
        where: { id: courseAssignmentId },
      });
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to unassign course:", error);
    return { error: "Failed to unassign course" };
  }
}

export async function reorderCourseExercises(courseId: string, exerciseIds: string[]) {
  await requireTeacher();

  // Validate inputs
  if (!courseId || typeof courseId !== "string" || courseId.length > 128) {
    return { error: "Invalid course ID" };
  }
  if (!Array.isArray(exerciseIds) || exerciseIds.length > 200) {
    return { error: "Invalid exercise list" };
  }
  for (const id of exerciseIds) {
    if (typeof id !== "string" || id.length > 128) {
      return { error: "Invalid exercise ID in list" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < exerciseIds.length; i++) {
        await tx.exercise.update({
          where: { id: exerciseIds[i] },
          data: { order: i },
        });
      }
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to reorder course exercises:", error);
    return { error: "Database error while reordering exercises" };
  }
}

export async function assignCourse(classroomId: string, courseId: string, dueDateStr?: string) {
  await requireTeacher();

  // Validate inputs
  if (!classroomId || typeof classroomId !== "string" || classroomId.length > 128) {
    return { error: "Invalid classroom ID" };
  }
  if (!courseId || typeof courseId !== "string" || courseId.length > 128) {
    return { error: "Invalid course ID" };
  }

  try {
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;
    if (dueDateStr && isNaN(dueDate!.getTime())) {
      return { error: "Invalid due date" };
    }

    // Prevent duplicate course assignment
    const existingCourseAssignment = await prisma.courseAssignment.findFirst({
      where: { classroomId, courseId },
    });
    if (existingCourseAssignment) {
      return { error: "This course is already assigned to this classroom" };
    }

    // Get all exercises in the course
    const exercises = await prisma.exercise.findMany({
      where: { courseId, pendingDeletion: false },
      orderBy: { order: "asc" },
    });

    if (exercises.length === 0) {
      return { error: "Course has no exercises to assign" };
    }

    // Create the CourseAssignment and individual Assignments in a transaction
    await prisma.$transaction(async (tx) => {
      const courseAssignment = await tx.courseAssignment.create({
        data: {
          classroomId,
          courseId,
          dueDate,
        },
      });

      // Create individual Assignments for each exercise, linked to the CourseAssignment
      for (const exercise of exercises) {
        await tx.assignment.create({
          data: {
            classroomId,
            exerciseId: exercise.id,
            dueDate,
            courseAssignmentId: courseAssignment.id,
          },
        });
      }

      return courseAssignment;
    });

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign course:", error);
    return { error: "Failed to assign course" };
  }
}
