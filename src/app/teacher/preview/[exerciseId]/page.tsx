import React from "react";
import { getSession } from "@/lib/session";
import { getExerciseFromDisk } from "@/lib/exercises";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import AssignmentPlayer from "@/app/assignments/[id]/AssignmentPlayer";

export default async function TeacherPreviewPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  const { exerciseId } = await params;
  const exercise = getExerciseFromDisk(exerciseId);

  if (!exercise) {
    notFound();
  }

  const assetsPath = `/api/exercises/${exerciseId}/assets/`;

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <AssignmentPlayer
          assignmentId="preview"
          exerciseJson={JSON.stringify(exercise)}
          assetsPath={assetsPath}
          role="TEACHER"
        />
      </main>
    </>
  );
}
