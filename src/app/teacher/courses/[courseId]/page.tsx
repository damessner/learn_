import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import CourseDetailClient from "./CourseDetailClient";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await getSession();

  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      exercises: {
        where: { pendingDeletion: false },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!course) {
    notFound();
  }

  const standaloneExercises = await prisma.exercise.findMany({
    where: { courseId: null, pendingDeletion: false },
    orderBy: { title: "asc" },
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        <CourseDetailClient
          course={course}
          standaloneExercises={standaloneExercises}
        />
      </main>
    </>
  );
}
