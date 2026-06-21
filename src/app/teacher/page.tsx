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
  Calendar,
  Sparkles,
  FileText,
  Crosshair,
  Compass,
  Plus,
  HelpCircle,
} from "lucide-react";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";
import DragDropWrapper from "./DragDropWrapper";
import { getOrGenerateWordOfTheDay } from "@/lib/gemini";
import { WordOfTheDayCard } from "@/components/WordOfTheDayCard";

export default async function TeacherDashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }
  if (session.role === "ADMIN") {
    redirect("/admin");
  }
  if (session.role === "STUDENT") {
    redirect("/student");
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const wordOfTheDay = await getOrGenerateWordOfTheDay(todayStr);

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
    include: {
      exercises: { where: { pendingDeletion: false }, orderBy: { order: "asc" } },
      courseAssignments: {
        include: { classroom: { select: { id: true, name: true } } },
      },
    },
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
            <Link
              href="/teacher/aloys"
              className="border border-neutral-300 dark:border-neutral-800 bg-transparent text-black dark:text-white font-mono text-xs uppercase tracking-wider py-1.5 px-4 rounded-none hover:border-black dark:hover:border-white transition"
            >
              🩺 Aloys Logs
            </Link>
            <SyncButton />
          </div>
        </div>

        {/* Word of the Day Card */}
        <WordOfTheDayCard data={wordOfTheDay} />

        {/* Create New Exercise Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
            <Plus className="w-5 h-5 text-neutral-500" />
            Create New Exercise
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Mixed Worksheet Card */}
            <Link
              href="/teacher/create?type=worksheet"
              className="group p-5 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:bg-neutral-50 dark:hover:bg-neutral-950/40 hover:border-black dark:hover:border-white transition duration-200 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-none bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-250 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-neutral-900 dark:text-neutral-100 group-hover:text-[#ff2a2e] transition">
                  Worksheet
                </h3>
                <p className="text-[10px] leading-relaxed text-neutral-500">
                  Multiple choice, gap-fill, matching, ordering formats.
                </p>
              </div>
              <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-neutral-500 group-hover:text-black dark:group-hover:text-white">
                BUILD &rarr;
              </span>
            </Link>

            {/* AI Writing Coach Card */}
            <Link
              href="/teacher/create?type=writing-coach"
              className="group p-5 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:bg-neutral-50 dark:hover:bg-neutral-950/40 hover:border-black dark:hover:border-white transition duration-200 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-none bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-250 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-neutral-900 dark:text-neutral-100 group-hover:text-[#ff2a2e] transition">
                  AI Coach
                </h3>
                <p className="text-[10px] leading-relaxed text-neutral-500">
                  Gemini-powered Socratic writing guidance loops.
                </p>
              </div>
              <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-neutral-500 group-hover:text-black dark:group-hover:text-white">
                CREATE &rarr;
              </span>
            </Link>

            {/* Vocabulary Card */}
            <Link
              href="/teacher/create?type=vocabulary"
              className="group p-5 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:bg-neutral-50 dark:hover:bg-neutral-950/40 hover:border-black dark:hover:border-white transition duration-200 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-none bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-250 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-neutral-900 dark:text-neutral-100 group-hover:text-[#ff2a2e] transition">
                  Vocabulary
                </h3>
                <p className="text-[10px] leading-relaxed text-neutral-500">
                  Spelling rounds, flashcards, and cloze tests.
                </p>
              </div>
              <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-neutral-500 group-hover:text-black dark:group-hover:text-white">
                CREATE &rarr;
              </span>
            </Link>

            {/* Image Hotspot Card */}
            <Link
              href="/teacher/create?type=image-hotspot-quiz"
              className="group p-5 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:bg-neutral-50 dark:hover:bg-neutral-950/40 hover:border-black dark:hover:border-white transition duration-200 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-none bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-250 flex items-center justify-center">
                  <Crosshair className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-neutral-900 dark:text-neutral-100 group-hover:text-[#ff2a2e] transition">
                  Hotspot
                </h3>
                <p className="text-[10px] leading-relaxed text-neutral-500">
                  Tap-target visual interactive quiz builder.
                </p>
              </div>
              <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-neutral-500 group-hover:text-black dark:group-hover:text-white">
                CREATE &rarr;
              </span>
            </Link>

            {/* Interactive Reading Card */}
            <Link
              href="/teacher/create?type=interactive-reading"
              className="group p-5 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:bg-neutral-50 dark:hover:bg-neutral-950/40 hover:border-black dark:hover:border-white transition duration-200 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-none bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-250 flex items-center justify-center">
                  <Compass className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-neutral-900 dark:text-neutral-100 group-hover:text-[#ff2a2e] transition">
                  Reading
                </h3>
                <p className="text-[10px] leading-relaxed text-neutral-500">
                  Choose-your-own branching narrative stories.
                </p>
              </div>
              <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-neutral-500 group-hover:text-black dark:group-hover:text-white">
                CREATE &rarr;
              </span>
            </Link>

            {/* Live Quiz Card */}
            <Link
              href="/teacher/create?type=live-quiz"
              className="group p-5 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm hover:bg-neutral-50 dark:hover:bg-neutral-950/40 hover:border-black dark:hover:border-white transition duration-200 flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="p-2 w-9 h-9 rounded-none bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-250 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-neutral-900 dark:text-neutral-100 group-hover:text-[#ff2a2e] transition">
                  Live Quiz
                </h3>
                <p className="text-[10px] leading-relaxed text-neutral-500">
                  Synchronous real-time classroom competition.
                </p>
              </div>
              <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-neutral-500 group-hover:text-black dark:group-hover:text-white">
                CREATE &rarr;
              </span>
            </Link>
          </div>
        </div>

        {/* Configuration Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-6 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm">
            <CreateClassroomForm />
          </div>

          <div className="p-6 border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm">
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
            <div className="text-center py-12 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-none text-neutral-500 font-mono text-xs uppercase">
              No classrooms created yet. Use the form above to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classrooms.map((classroom) => (
                <div
                  key={classroom.id}
                  className="border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm p-5 space-y-4 flex flex-col justify-between hover:border-black dark:hover:border-white transition duration-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          {classroom.name}
                          <Link
                            href={`/teacher/classrooms/${classroom.id}`}
                            className="inline-flex items-center gap-0.5 text-[9px] uppercase font-mono tracking-widest bg-transparent hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black px-2 py-0.5 border border-neutral-300 dark:border-neutral-800 rounded-none text-neutral-600 dark:text-neutral-300 transition duration-150"
                          >
                            Gradebook
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </h3>
                        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                          Join Code:{" "}
                          <code className="bg-transparent border border-neutral-250 dark:border-neutral-800 px-1.5 py-0.5 rounded-none font-mono font-bold text-neutral-800 dark:text-neutral-200">
                            {classroom.joinCode}
                          </code>
                        </p>
                      </div>
                      <span className="text-[10px] border border-neutral-300 dark:border-neutral-800 bg-transparent text-neutral-600 dark:text-neutral-350 px-2 py-0.5 rounded-none font-mono tracking-widest uppercase font-bold">
                        {classroom.students.length} Pupils
                      </span>
                    </div>

                    {/* Students list */}
                    {classroom.students.length > 0 && (
                      <div className="text-xs space-y-1 border-t border-neutral-200 dark:border-neutral-900 pt-2">
                        <span className="text-[10px] font-mono font-bold text-neutral-450 uppercase block tracking-wider">
                          Students:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {classroom.students.map((cs) => (
                            <span
                              key={cs.studentId}
                              className="bg-transparent border border-neutral-200 dark:border-neutral-850 rounded-none px-1.5 py-0.5 text-neutral-700 dark:text-neutral-300 font-mono text-[10px] uppercase"
                            >
                              {cs.student.username}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Assignments */}
                    <div className="space-y-1.5 border-t border-neutral-200 dark:border-neutral-900 pt-2">
                      <span className="text-[10px] font-mono font-bold text-neutral-450 uppercase block tracking-wider">
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
                              className="text-xs flex items-center justify-between p-2 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm border border-neutral-200 dark:border-neutral-900 hover:border-black dark:hover:border-white transition duration-150"
                            >
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
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
          courses={courses.map((c) => ({
            ...c,
            courseAssignments: c.courseAssignments.map((ca) => ({
              id: ca.id,
              classroom: ca.classroom,
            })),
          }))}
          allExercises={exercises}
          classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))}
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
            <div className="border border-neutral-200 dark:border-neutral-900 rounded-none overflow-hidden bg-white/40 dark:bg-black/20 backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-mono uppercase border-b border-neutral-200 dark:border-neutral-900 text-neutral-500">
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
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-900">
                    {submissions.map((sub) => {
                      const isHigh = sub.effectiveScore >= 80;
                      const isLow = sub.effectiveScore < 50;

                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-neutral-50/40 dark:hover:bg-neutral-950/20"
                        >
                          <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-neutral-100">
                            {sub.student.username}
                          </td>
                          <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400">
                            {sub.assignment.classroom.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-neutral-900 dark:text-neutral-200">
                              {sub.assignment.exercise.title}
                            </span>
                            <span className="text-[9px] uppercase font-mono block text-neutral-500 tracking-wider">
                              {getExerciseTypeLabel(
                                sub.assignment.exercise.type
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`px-2 py-0.5 rounded-none text-xs font-mono font-bold border ${
                                  isHigh
                                    ? "border-green-500 text-green-650 dark:text-green-400 bg-green-500/5"
                                    : isLow
                                    ? "border-red-500 text-red-650 dark:text-red-450 bg-red-500/5"
                                    : "border-neutral-300 dark:border-neutral-800 text-neutral-750 dark:text-neutral-350 bg-neutral-500/5"
                                }`}
                              >
                                {sub.effectiveScore.toFixed(0)}%
                              </span>
                              {sub.attemptNumber > 1 && (
                                <span className="text-[9px] font-mono text-neutral-450 uppercase tracking-wide">
                                  Try #{sub.attemptNumber} · Raw{" "}
                                  {sub.score.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[11px] text-neutral-500 font-mono">
                            {new Date(sub.completedAt).toLocaleString("en-GB", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/submissions/${sub.id}`}
                              className="inline-flex items-center gap-1 text-[9px] font-bold uppercase font-mono border border-neutral-300 dark:border-neutral-800 bg-transparent hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black px-2.5 py-1 rounded-none transition duration-150 text-neutral-700 dark:text-neutral-300"
                            >
                              Review
                              <ExternalLink className="w-2.5 h-2.5" />
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
                <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-900 bg-transparent">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                    Showing {skip + 1}–{Math.min(skip + pageSize, totalSubmissions)} of {totalSubmissions}
                  </span>
                  <div className="flex items-center gap-2">
                    {currentPage > 1 ? (
                      <Link
                        href={`/teacher?page=${currentPage - 1}`}
                        className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-800 rounded-none text-xs font-mono font-bold uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition text-neutral-700 dark:text-neutral-300"
                      >
                        &larr; Prev
                      </Link>
                    ) : (
                      <span className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800/80 rounded-none text-xs font-mono text-neutral-400 dark:text-neutral-600 uppercase cursor-not-allowed select-none bg-transparent">
                        &larr; Prev
                      </span>
                    )}

                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-transparent border border-neutral-250 dark:border-neutral-800 rounded-none text-neutral-850 dark:text-neutral-250">
                      Page {currentPage} of {totalPages}
                    </span>

                    {currentPage < totalPages ? (
                      <Link
                        href={`/teacher?page=${currentPage + 1}`}
                        className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-800 rounded-none text-xs font-mono font-bold uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition text-neutral-700 dark:text-neutral-300"
                      >
                        Next &rarr;
                      </Link>
                    ) : (
                      <span className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800/80 rounded-none text-xs font-mono text-neutral-400 dark:text-neutral-600 uppercase cursor-not-allowed select-none bg-transparent">
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
