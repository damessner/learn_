import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getExerciseFromDisk } from "@/lib/exercises";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import SubmissionReviewPlayer from "./SubmissionReviewPlayer";

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id: submissionId } = await params;

  // Fetch submission from database
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: true,
      assignment: {
        include: {
          exercise: true,
          classroom: true,
        },
      },
    },
  });

  if (!submission) {
    notFound();
  }

  // Auth check: User must be either the student who submitted it, or the teacher of the classroom
  const isTeacher = submission.assignment.classroom.teacherId === session.userId;
  const isStudent = submission.studentId === session.userId;

  if (!isTeacher && !isStudent) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold font-mono text-red-650 uppercase">Access Denied</h2>
          <p className="text-sm text-neutral-500">
            You do not have access to view this submission.
          </p>
        </main>
      </>
    );
  }

  // Load configuration from disk
  const exercise = getExerciseFromDisk(submission.assignment.exerciseId);

  if (!exercise) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold font-mono text-red-650 uppercase">Error Loading Exercise</h2>
          <p className="text-sm text-neutral-500">
            The exercise file structure (<code>content/exercises/{submission.assignment.exerciseId}/</code>) was not found on the server.
          </p>
        </main>
      </>
    );
  }

  let savedAnswers: Record<string, unknown> = {};
  try {
    savedAnswers = JSON.parse(submission.answersJson) as Record<string, unknown>;
  } catch (e) {
    console.error("Failed to parse submission answers:", e);
  }

  const assetsPath = `/api/exercises/${submission.assignment.exerciseId}/assets/`;
  const backUrl = session.role === "TEACHER" ? "/teacher" : "/student";

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <SubmissionReviewPlayer
          exerciseJson={JSON.stringify(exercise)}
          savedAnswersJson={JSON.stringify(savedAnswers)}
          assetsPath={assetsPath}
          studentName={submission.student.username}
          completedAt={submission.completedAt.toISOString()}
          score={submission.score}
          effectiveScore={submission.effectiveScore}
          attemptNumber={submission.attemptNumber}
          backUrl={backUrl}
          isTeacher={isTeacher}
          submissionId={submissionId}
          teacherScore={submission.teacherScore ?? undefined}
          feedback={submission.feedback ?? undefined}
          reviewedAt={submission.reviewedAt ? submission.reviewedAt.toISOString() : undefined}
        />
      </main>
    </>
  );
}
