"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "./auth-helpers";

export async function assignExercise(classroomId: string, exerciseId: string, dueDateStr?: string) {
  await requireTeacher();

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

export async function unassignAssignment(assignmentId: string) {
  await requireTeacher();

  if (!assignmentId || typeof assignmentId !== "string" || assignmentId.length > 128) {
    return { error: "Invalid assignment ID" };
  }

  try {
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
