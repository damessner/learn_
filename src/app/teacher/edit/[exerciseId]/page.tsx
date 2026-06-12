import React from "react";
import { getSession } from "@/lib/session";
import { getExerciseFromDisk } from "@/lib/exercises";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import WorksheetCreator from "@/app/teacher/create/WorksheetCreator";

export default async function EditWorksheetPage({
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

  const courses = await prisma.course.findMany({
    orderBy: { order: "asc" },
    select: { id: true, title: true },
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <WorksheetCreator initialDataJson={JSON.stringify(exercise)} courses={courses} />
      </main>
    </>
  );
}
