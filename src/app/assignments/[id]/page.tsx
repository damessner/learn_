import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getExerciseFromDisk } from "@/lib/exercises";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import AssignmentPlayer from "./AssignmentPlayer";
import { getAttemptMultiplier } from "@/lib/scoring";

export default async function AssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id: assignmentId } = await params;
  const resolvedSearchParams = await searchParams;
  const isRedo = resolvedSearchParams.redo === "true";

  // Fetch assignment from database
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      classroom: {
        include: {
          students: {
            where: { studentId: session.userId },
          },
        },
      },
    },
  });

  if (!assignment) {
    notFound();
  }

  // Auth check: User must be either the classroom teacher or a student joined in the classroom
  const isTeacher = assignment.classroom.teacherId === session.userId;
  const isStudent = assignment.classroom.students.length > 0;

  if (!isTeacher && !isStudent) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold font-mono text-red-650 uppercase">Access Denied</h2>
          <p className="text-sm text-neutral-500">
            You do not have access to this assignment. Only enrolled students and the classroom teacher can access it.
          </p>
        </main>
      </>
    );
  }

  // Load configuration from disk
  const exercise = getExerciseFromDisk(assignment.exerciseId);

  if (!exercise) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold font-mono text-red-650 uppercase">Error Loading Exercise</h2>
          <p className="text-sm text-neutral-500">
            The exercise file structure (<code>content/exercises/{assignment.exerciseId}/</code>) was not found on the server filesystem.
          </p>
          {isTeacher && (
            <p className="text-xs text-neutral-450 italic">
              Teacher Tip: Check that the exercise folder exists and runs successfully. Trigger a manual sync on the dashboard to ensure the DB matches disk files.
            </p>
          )}
        </main>
      </>
    );
  }

  // Fetch the student's most recent submission (for restoring answers) and count all prior attempts
  const [pastSubmission, priorAttemptCount] = await Promise.all([
    prisma.submission.findFirst({
      where: { assignmentId, studentId: session.userId },
      orderBy: { completedAt: "desc" },
    }),
    prisma.submission.count({
      where: { assignmentId, studentId: session.userId },
    }),
  ]);

  let savedAnswers = undefined;
  if (pastSubmission && !isRedo) {
    try {
      savedAnswers = JSON.parse(pastSubmission.answersJson);
    } catch (e) {
      console.error("Failed to parse past submission answers:", e);
    }
  }

  // Next attempt number (what will be recorded when they submit)
  const nextAttemptNumber = priorAttemptCount + 1;
  const nextMultiplier = getAttemptMultiplier(nextAttemptNumber);

  const assetsPath = `/api/exercises/${assignment.exerciseId}/assets/`;

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <AssignmentPlayer
          assignmentId={assignmentId}
          exerciseJson={JSON.stringify(exercise)}
          assetsPath={assetsPath}
          savedAnswersJson={JSON.stringify(savedAnswers)}
          role={session.role === "ADMIN" ? "TEACHER" : session.role}
          attemptNumber={nextAttemptNumber}
          multiplier={nextMultiplier}
          priorAttemptCount={priorAttemptCount}
          dueDate={assignment.dueDate ? assignment.dueDate.toISOString() : undefined}
        />
      </main>
    </>
  );
}

