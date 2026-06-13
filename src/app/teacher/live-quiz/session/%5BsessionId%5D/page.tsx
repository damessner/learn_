import React from "react";
import { requireTeacher } from "@/lib/actions/auth-helpers";
import { prisma } from "@/lib/db";
import { getExerciseFromDisk } from "@/lib/exercises";
import { Navbar } from "@/components/Navbar";
import LiveQuizSessionHostClient from "./LiveQuizSessionHostClient";

export default async function LiveQuizSessionHostPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const teacher = await requireTeacher();
  const { sessionId } = await params;

  const session = await prisma.liveQuizSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.hostId !== teacher.userId) {
    return (
      <>
        <Navbar />
        <main className="max-w-md mx-auto py-12 px-4 text-center">
          <div className="p-6 border border-red-200 rounded-xl bg-red-50 text-red-700">
            Session not found or unauthorized access.
          </div>
        </main>
      </>
    );
  }

  // Load exercise from disk
  const exercise = getExerciseFromDisk(session.exerciseId);
  if (!exercise || exercise.type !== "live-quiz") {
    return (
      <>
        <Navbar />
        <main className="max-w-md mx-auto py-12 px-4 text-center">
          <div className="p-6 border border-red-200 rounded-xl bg-red-50 text-red-700">
            Quiz exercise configuration not found.
          </div>
        </main>
      </>
    );
  }

  // Fetch teacher classrooms to allow linking submissions
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: teacher.userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Navbar />
      <LiveQuizSessionHostClient
        sessionId={sessionId}
        exercise={exercise}
        classrooms={classrooms}
      />
    </>
  );
}
