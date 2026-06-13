"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getAttemptMultiplier } from "@/lib/scoring";
import { requireAuth, requireTeacher } from "./auth-helpers";
import {
  validateAnswersPayload,
  validateScoreBounds,
  scoreExerciseSubmission,
} from "@/lib/submissionScoring";

export async function submitAssignment(assignmentId: string, answers: unknown, clientScore?: number) {
  const student = await requireAuth();

  try {
    // Validate assignmentId format (UUID length check + basic sanity)
    if (!assignmentId || typeof assignmentId !== "string" || assignmentId.length > 128) {
      return { error: "Invalid assignment ID" };
    }

    // Validate answers payload shape and size
    const answersError = validateAnswersPayload(answers);
    if (answersError) {
      console.warn(`Submission validation failed for student ${student.userId}: ${answersError}`);
      return { error: "Invalid submission data" };
    }

    // Validate client-supplied score is within reasonable bounds (for logging/display)
    // but DO NOT trust it for persistence
    const scoreError = validateScoreBounds(clientScore);
    if (scoreError) {
      return { error: "Invalid score value" };
    }

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
        exercise: true,
      },
    });

    if (!assignment || assignment.classroom.students.length === 0) {
      return { error: "Access denied or assignment not found" };
    }

    // Check if due date has passed
    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      return { error: "This assignment is locked because the due date has passed." };
    }

    // Simple rate-limiting: prevent submissions within 5 seconds of the last one
    const lastSubmission = await prisma.submission.findFirst({
      where: { assignmentId, studentId: student.userId },
      orderBy: { completedAt: "desc" },
    });
    if (lastSubmission && (new Date().getTime() - new Date(lastSubmission.completedAt).getTime()) < 5000) {
      return { error: "Please wait at least 5 seconds between submissions." };
    }

    // Count prior attempts to determine this attempt's number
    const priorCount = await prisma.submission.count({
      where: { assignmentId, studentId: student.userId },
    });

    const attemptNumber = priorCount + 1;
    const multiplier = getAttemptMultiplier(attemptNumber);

    // ---- SERVER-AUTHORITATIVE SCORING ----
    // Compute score from exercise definition and submitted answers.
    // The client-supplied `score` is NOT used for persistence.
    const exercise = assignment.exercise;
    let computedScore = 0;

    // Load the exercise data from disk to get full definition with answer keys
    const { getExerciseFromDisk } = await import("@/lib/exercises");
    const exerciseData = getExerciseFromDisk(exercise.id);

    if (!exerciseData) {
      console.warn(`Could not load exercise ${exercise.id} from disk for scoring`);
      return { error: "Unable to score submission at this time" };
    }

    computedScore = scoreExerciseSubmission(
      exerciseData,
      answers as Record<string, unknown>
    );

    const effectiveScore = computedScore * multiplier;

    // Always create a new submission row — never overwrite
    await prisma.submission.create({
      data: {
        assignmentId,
        studentId: student.userId,
        answersJson: JSON.stringify(answers),
        score: computedScore,
        effectiveScore,
        attemptNumber,
      },
    });

    revalidatePath("/student");
    return { success: true, attemptNumber, multiplier, effectiveScore, score: computedScore };
  } catch (error) {
    console.error("Failed to submit assignment:", error);
    return { error: "Failed to record submission" };
  }
}

export async function overrideSubmissionGrade(
  submissionId: string,
  teacherScore: number,
  feedback: string
) {
  const teacher = await requireTeacher();

  // Validate inputs
  if (!submissionId || typeof submissionId !== "string" || submissionId.length > 128) {
    return { error: "Invalid submission ID" };
  }
  if (typeof teacherScore !== "number" || isNaN(teacherScore) || teacherScore < 0 || teacherScore > 100) {
    return { error: "Score must be a number between 0 and 100" };
  }
  if (feedback !== undefined && feedback !== null && typeof feedback !== "string") {
    return { error: "Feedback must be a string" };
  }
  if (typeof feedback === "string" && feedback.length > 5000) {
    return { error: "Feedback must be 5000 characters or fewer" };
  }

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: { include: { classroom: true } } },
    });

    if (!submission || submission.assignment.classroom.teacherId !== teacher.userId) {
      return { error: "Access denied" };
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        teacherScore,
        feedback,
        reviewedAt: new Date(),
      },
    });

    revalidatePath(`/submissions/${submissionId}`);
    return { success: true };
  } catch (e: unknown) {
    console.error("Failed to override grade:", e);
    return { error: "Failed to override grade" };
  }
}
