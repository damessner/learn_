"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "./auth-helpers";
import { headers } from "next/headers";
import { createTeamsAssignment } from "@/lib/microsoftGraph";

export async function assignExercise(
  classroomId: string,
  exerciseId: string,
  dueDateStr?: string,
  syncToTeams: boolean = false
) {
  const teacher = await requireTeacher();

  if (!classroomId || typeof classroomId !== "string" || classroomId.length > 128) {
    return { error: "Invalid classroom ID" };
  }
  if (!exerciseId || typeof exerciseId !== "string" || exerciseId.length > 128) {
    return { error: "Invalid exercise ID" };
  }

  try {
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;
    if (dueDateStr && isNaN(dueDate!.getTime())) {
      return { error: "Invalid due date" };
    }

    // Verify classroom belongs to this teacher
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, teacherId: teacher.userId },
    });
    if (!classroom) {
      return { error: "Access denied" };
    }

    // Prevent duplicate assignment for same exercise+classroom (standalone or course-linked)
    const existing = await prisma.assignment.findFirst({
      where: {
        classroomId,
        exerciseId,
      },
      include: {
        courseAssignment: {
          include: {
            course: true,
          },
        },
      },
    });
    if (existing) {
      if (existing.courseAssignment) {
        return { error: `This exercise is already assigned to this classroom as part of the course "${existing.courseAssignment.course.title}"` };
      }
      return { error: "This exercise is already assigned to this classroom" };
    }

    const assignment = await prisma.assignment.create({
      data: {
        classroomId,
        exerciseId,
        dueDate,
      },
      include: {
        exercise: true,
      },
    });

    // If teacher selected "Sync to Teams" and this class is linked to a Teams class
    if (syncToTeams && classroom.msGraphClassId) {
      try {
        const headersList = await headers();
        const host = headersList.get("host") || "localhost:3000";
        const protocol = host.startsWith("localhost") ? "http" : "https";
        const targetUrl = `${protocol}://${host}/assignments/${assignment.id}`;

        const msGraphAssignmentId = await createTeamsAssignment(
          teacher.userId,
          classroom.msGraphClassId,
          `AloysLearns: ${assignment.exercise.title}`,
          dueDate,
          targetUrl
        );

        await prisma.assignment.update({
          where: { id: assignment.id },
          data: { msGraphAssignmentId },
        });
      } catch (err) {
        console.error("Failed to sync assignment to Teams:", err);
        // Don't crash the assignment creation, but record or log it
      }
    }

    revalidatePath("/teacher");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign exercise:", error);
    return { error: "Failed to create assignment" };
  }
}

export async function unassignAssignment(assignmentId: string) {
  const teacher = await requireTeacher();

  if (!assignmentId || typeof assignmentId !== "string" || assignmentId.length > 128) {
    return { error: "Invalid assignment ID" };
  }

  try {
    // Verify assignment belongs to this teacher's classroom
    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { classroom: true },
    });
    if (!existing || existing.classroom.teacherId !== teacher.userId) {
      return { error: "Access denied" };
    }

    await prisma.assignment.delete({
      where: { id: assignmentId },
    });
    revalidatePath("/teacher");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to unassign assignment:", error);
    return { error: "Failed to unassign assignment" };
  }
}
