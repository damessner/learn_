import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import SyncButton from "./SyncButton";
import CreateClassroomForm from "./CreateClassroomForm";
import AssignExerciseForm from "./AssignExerciseForm";
import Link from "next/link";
import {
  ExternalLink,
  Users,
  BookOpen,
  Clock,
  Calendar,
  Sparkles,
  FileText,
  Crosshair,
  Compass,
  Plus,
} from "lucide-react";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";
import DragDropWrapper from "./DragDropWrapper";

export default async function TeacherDashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();

  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  const totalSubmissions = await prisma.submission.count({
    where: {
      assignment: {
        classroom: {
          teacherId: session.userId,
        },
      },
    },
  });

  const pageSize = 25;
  const totalPages = Math.ceil(totalSubmissions / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(totalPages, parseInt((await searchParams).page || "1", 10)));
  const skip = (currentPage - 1) * pageSize;

  // Fetch Classrooms taught by teacher
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: session.userId },
    include: {
      students: {
        include: {
          student: true,
        },
      },
      assignments: {
        include: {
          exercise: true,
          submissions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch Exercises from db
  const exercises = await prisma.exercise.findMany({
    where: { pendingDeletion: false },
    orderBy: { title: "asc" },
  });

  // Fetch Courses with their exercises
  const courses = await prisma.course.findMany({
    orderBy: { order: "asc" },
    include: { exercises: { where: { pendingDeletion: false }, orderBy: { order: "asc" } } },
  });

  // Fetch the paginated submissions for assignments belonging to the teacher's classrooms
  const submissions = await prisma.submission.findMany({
    where: {
      assignment: {
        classroom: {
          teacherId: session.userId,
        },
      },
    },
    skip,
    take: pageSize,
    include: {
      student: true,
      assignment: {
        include: {
          exercise: true,
          classroom: true,
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-mono uppercase">
              Teacher Dashboard
            </h1>
            <p className="text-sm text-neutral-500">
              Manage classrooms, assign exercises, and track student results.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SyncButton />
          </div>
        </div>

        {/* Create New Exercise Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
            <Plus className="w-5 h-5 text-neutral-500" />
            Create New Exercise
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Mixed Worksheet Card */}
            <Link
              href="/teacher/create?type=worksheet"
              className="group p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white hover:bg-blue-50/20 dark:bg-neutral-900 dark:hover:bg-blue-955/10 shadow-sm hover:shadow hover:border-blue-300 dark:hover:border-blue-900/60 transition duration-300 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-650 dark:text-blue-400 group-hover:scale-110 transition duration-300 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-450 transition">
                  Mixed Worksheet
                </h3>
                <p className="text-[11px] leading-relaxed text-neutral-450 dark:text-neutral-500">
                  Multiple choice, gap-fill, matching, ordering.
                </p>
              </div>
              <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-blue-650 dark:text-blue-400 group-hover:underline">
                Build Worksheet &rarr;
              </span>
            </Link>

            {/* AI Writing Coach Card */}
            <Link
              href="/teacher/create?type=writing-coach"
              className="group p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white hover:bg-purple-50/20 dark:bg-neutral-900 dark:hover:bg-purple-955/10 shadow-sm hover:shadow hover:border-purple-300 dark:hover:border-purple-900/60 transition duration-300 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-650 dark:text-purple-400 group-hover:scale-110 transition duration-300 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-450 transition">
                  AI Writing Coach
                </h3>
                <p className="text-[11px] leading-relaxed text-neutral-450 dark:text-neutral-500">
                  Gemini-powered formative Socratic writing loops.
                </p>
              </div>
              <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-purple-650 dark:text-purple-400 group-hover:underline">
                Create Coach &rarr;
              </span>
            </Link>

            {/* Vocabulary Card */}
            <Link
              href="/teacher/create?type=vocabulary"
              className="group p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white hover:bg-emerald-50/20 dark:bg-neutral-900 dark:hover:bg-emerald-955/10 shadow-sm hover:shadow hover:border-emerald-300 dark:hover:border-emerald-900/60 transition duration-300 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-650 dark:text-emerald-400 group-hover:scale-110 transition duration-300 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-450 transition">
                  Vocabulary Practice
                </h3>
                <p className="text-[11px] leading-relaxed text-neutral-450 dark:text-neutral-500">
                  Drills, spelling rounds, and AI cloze challenge.
                </p>
              </div>
              <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-emerald-650 dark:text-emerald-400 group-hover:underline">
                Create Practice &rarr;
              </span>
            </Link>

            {/* Image Hotspot Card */}
            <Link
              href="/teacher/create?type=image-hotspot-quiz"
              className="group p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white hover:bg-amber-50/20 dark:bg-neutral-900 dark:hover:bg-amber-955/10 shadow-sm hover:shadow hover:border-amber-300 dark:hover:border-amber-900/60 transition duration-300 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-650 dark:text-amber-400 group-hover:scale-110 transition duration-300 flex items-center justify-center">
                  <Crosshair className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-amber-600 dark:group-hover:text-amber-450 transition">
                  Image Hotspot Quiz
                </h3>
                <p className="text-[11px] leading-relaxed text-neutral-450 dark:text-neutral-500">
                  Interactive find-and-tap visual region quizzes.
                </p>
              </div>
              <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-amber-650 dark:text-amber-400 group-hover:underline">
                Create Quiz &rarr;
              </span>
            </Link>

            {/* Interactive Reading Card */}
            <Link
              href="/teacher/create?type=interactive-reading"
              className="group p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white hover:bg-rose-50/20 dark:bg-neutral-900 dark:hover:bg-rose-955/10 shadow-sm hover:shadow hover:border-rose-300 dark:hover:border-rose-900/60 transition duration-300 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-650 dark:text-rose-400 group-hover:scale-110 transition duration-300 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-rose-650 dark:group-hover:text-rose-400 transition">
                  Interactive Reading
                </h3>
                <p className="text-[11px] leading-relaxed text-neutral-450 dark:text-neutral-500">
                  Choose-your-own branching storytelling paths.
                </p>
              </div>
              <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-rose-650 dark:text-rose-400 group-hover:underline">
                Create Story &rarr;
              </span>
            </Link>
          </div>
        </div>

        {/* Configuration Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-6 border border-neutral-350 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900/50 shadow-sm">
            <CreateClassroomForm />
          </div>

          <div className="p-6 border border-neutral-350 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900/50 shadow-sm">
            <AssignExerciseForm
              classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))}
              exercises={exercises.map((e) => ({
                id: e.id,
                title: e.title,
                type: e.type,
              }))}
              courses={courses.map((c) => ({ id: c.id, title: c.title }))}
            />
          </div>
        </div>

        {/* Classrooms List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-500" />
            Classrooms ({classrooms.length})
          </h2>

          {classrooms.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded text-neutral-500">
              No classrooms created yet. Use the form above to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classrooms.map((classroom) => (
                <div
                  key={classroom.id}
                  className="border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm p-5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          {classroom.name}
                          <Link
                            href={`/teacher/classrooms/${classroom.id}`}
                            className="inline-flex items-center gap-0.5 text-[9px] uppercase font-mono tracking-wider bg-neutral-150 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-1.5 py-0.5 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-600 dark:text-neutral-300 transition"
                          >
                            Gradebook
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </h3>
                        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                          Join Code:{" "}
                          <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded font-mono font-bold text-neutral-800 dark:text-neutral-200">
                            {classroom.joinCode}
                          </code>
                        </p>
                      </div>
                      <span className="text-xs bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded font-mono font-bold">
                        {classroom.students.length} Student(s)
                      </span>
                    </div>

                    {/* Students list */}
                    {classroom.students.length > 0 && (
                      <div className="text-xs space-y-1 border-t pt-2">
                        <span className="font-semibold text-neutral-450 uppercase block tracking-wider">
                          Students:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {classroom.students.map((cs) => (
                            <span
                              key={cs.studentId}
                              className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded px-1.5 py-0.5 text-neutral-700 dark:text-neutral-300"
                            >
                              {cs.student.username}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Assignments */}
                    <div className="space-y-1.5 border-t pt-2">
                      <span className="text-xs font-semibold text-neutral-450 uppercase block tracking-wider">
                        Assigned Exercises:
                      </span>
                      {classroom.assignments.length === 0 ? (
                        <span className="text-xs text-neutral-400 italic block">
                          No exercises assigned yet.
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {classroom.assignments.map((as) => (
                            <Link
                              key={as.id}
                              href={`/teacher/assignments/${as.id}`}
                              className="text-xs flex items-center justify-between p-1.5 rounded bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-955/45 dark:hover:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-700 transition"
                            >
                              <span className="font-semibold text-neutral-850 dark:text-neutral-200 hover:underline">
                                {as.exercise.title}
                              </span>
                              <div className="flex items-center gap-2">
                                {as.dueDate && (
                                  <span className="text-[9px] text-neutral-500 flex items-center gap-0.5 font-mono">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(as.dueDate).toLocaleDateString(
                                      "en-GB"
                                    )}
                                  </span>
                                )}
                                <span className="text-[9px] bg-neutral-200 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-450 px-1 rounded font-bold font-mono">
                                  {as.submissions.length} sub(s)
                                </span>
                                <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Courses & Drag-and-Drop */}
        <DragDropWrapper
          courses={courses}
          allExercises={exercises}
        />

        {/* Student Submissions */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-neutral-500" />
            Recent Student Submissions
          </h2>

          {submissions.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded text-neutral-500">
              No submissions recorded yet. Once students complete assignments,
              their results will appear here.
            </div>
          ) : (
            <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-mono uppercase bg-neutral-50 dark:bg-neutral-955 border-b border-neutral-300 dark:border-neutral-800 text-neutral-500">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Student</th>
                      <th className="px-6 py-3 font-semibold">Classroom</th>
                      <th className="px-6 py-3 font-semibold">Exercise</th>
                      <th className="px-6 py-3 font-semibold text-center">
                        Effective Score
                      </th>
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {submissions.map((sub) => {
                      const isHigh = sub.effectiveScore >= 80;
                      const isLow = sub.effectiveScore < 50;

                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20"
                        >
                          <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-neutral-100">
                            {sub.student.username}
                          </td>
                          <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400">
                            {sub.assignment.classroom.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-neutral-900 dark:text-neutral-200">
                              {sub.assignment.exercise.title}
                            </span>
                            <span className="text-[10px] uppercase font-mono block text-neutral-500">
                              {getExerciseTypeLabel(
                                sub.assignment.exercise.type
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                  isHigh
                                    ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                    : isLow
                                    ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                                    : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {sub.effectiveScore.toFixed(0)}%
                              </span>
                              {sub.attemptNumber > 1 && (
                                <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400">
                                  Attempt #{sub.attemptNumber} · Raw{" "}
                                  {sub.score.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-neutral-500 font-mono flex items-center gap-1 mt-2.5">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(sub.completedAt).toLocaleString("en-GB", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/submissions/${sub.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold uppercase font-mono border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2.5 py-1 rounded transition text-neutral-700 dark:text-neutral-300"
                            >
                              Review
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                  <span className="text-xs font-mono text-neutral-500">
                    Showing {skip + 1}–{Math.min(skip + pageSize, totalSubmissions)} of {totalSubmissions} submissions
                  </span>
                  <div className="flex items-center gap-2">
                    {currentPage > 1 ? (
                      <Link
                        href={`/teacher?page=${currentPage - 1}`}
                        className="px-3 py-1.5 border border-neutral-350 dark:border-neutral-700 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-95 text-neutral-700 dark:text-neutral-300"
                      >
                        &larr; Prev
                      </Link>
                    ) : (
                      <span className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800/80 rounded text-xs font-mono text-neutral-400 dark:text-neutral-600 uppercase cursor-not-allowed select-none bg-neutral-100/50 dark:bg-neutral-900/20">
                        &larr; Prev
                      </span>
                    )}

                    <span className="text-xs font-mono font-bold px-2 py-1 bg-neutral-200 dark:bg-neutral-800 rounded text-neutral-850 dark:text-neutral-250">
                      Page {currentPage} of {totalPages}
                    </span>

                    {currentPage < totalPages ? (
                      <Link
                        href={`/teacher?page=${currentPage + 1}`}
                        className="px-3 py-1.5 border border-neutral-350 dark:border-neutral-700 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-95 text-neutral-700 dark:text-neutral-300"
                      >
                        Next &rarr;
                      </Link>
                    ) : (
                      <span className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800/80 rounded text-xs font-mono text-neutral-400 dark:text-neutral-600 uppercase cursor-not-allowed select-none bg-neutral-100/50 dark:bg-neutral-900/20">
                        Next &rarr;
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
