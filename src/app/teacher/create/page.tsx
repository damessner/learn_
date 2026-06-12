import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import WorksheetCreator from "./WorksheetCreator";

export default async function CreateWorksheetPage() {
  const session = await getSession();

  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  const courses = await prisma.course.findMany({
    orderBy: { order: "asc" },
    select: { id: true, title: true },
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <WorksheetCreator courses={courses} />
      </main>
    </>
  );
}
