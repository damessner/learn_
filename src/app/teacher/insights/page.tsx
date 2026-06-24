import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { ArrowLeft, BookOpen, AlertTriangle, HelpCircle, TrendingUp, Users, Award } from "lucide-react";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";

export default async function CourseInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; classroomId?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  const { courseId, classroomId } = await searchParams;
  if (!courseId || !classroomId) {
    notFound();
  }

  // Fetch classroom details
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: {
      students: {
        include: { student: true }
      }
    }
  });

  if (!classroom) {
    notFound();
  }

  // Verify ownership
  if (session.role !== "ADMIN" && classroom.teacherId !== session.userId) {
    return (
      <>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200 rounded">
            Access denied: You do not teach this classroom.
          </div>
        </main>
      </>
    );
  }

  // Fetch course details
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      exercises: {
        where: { pendingDeletion: false },
        orderBy: { order: "asc" }
      }
    }
  });

  if (!course) {
    notFound();
  }

  // Find the CourseAssignment record
  const courseAssignment = await prisma.courseAssignment.findFirst({
    where: { classroomId, courseId }
  });

  if (!courseAssignment) {
    return (
      <>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="p-4 bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-300 border border-amber-200 rounded">
            This course is not assigned to this classroom.
          </div>
        </main>
      </>
    );
  }

  // Fetch assignments for this course assignment
  const assignments = await prisma.assignment.findMany({
    where: { courseAssignmentId: courseAssignment.id },
    include: {
      exercise: true,
      submissions: {
        orderBy: { completedAt: "desc" }
      }
    }
  });

  const students = classroom.students.map(cs => cs.student);

  // Compute metrics per student
  const studentMetrics = students.map(student => {
    let completedCount = 0;
    let scoreSum = 0;
    let scoresCount = 0;

    const grades: Record<string, number | null> = {};

    course.exercises.forEach(ex => {
      // Find assignments for this exercise
      const exAssignment = assignments.find(a => a.exerciseId === ex.id);
      if (exAssignment) {
        const studentSubs = exAssignment.submissions.filter(s => s.studentId === student.id);
        if (studentSubs.length > 0) {
          completedCount++;
          // Best attempt score
          const bestScore = Math.max(...studentSubs.map(s => s.teacherScore !== null ? s.teacherScore : s.effectiveScore));
          grades[ex.id] = bestScore;
          scoreSum += bestScore;
          scoresCount++;
        } else {
          grades[ex.id] = null;
        }
      } else {
        grades[ex.id] = null;
      }
    });

    const completionRate = course.exercises.length > 0 ? (completedCount / course.exercises.length) * 100 : 0;
    const averageScore = scoresCount > 0 ? scoreSum / scoresCount : null;

    return {
      id: student.id,
      username: student.username,
      completedCount,
      completionRate,
      averageScore,
      grades
    };
  });

  // Compute global course-wide averages
  let totalCompletionsSum = 0;
  let totalAverageScoresSum = 0;
  let studentsWithScoresCount = 0;

  studentMetrics.forEach(sm => {
    totalCompletionsSum += sm.completionRate;
    if (sm.averageScore !== null) {
      totalAverageScoresSum += sm.averageScore;
      studentsWithScoresCount++;
    }
  });

  const classAvgCompletionRate = students.length > 0 ? Math.round(totalCompletionsSum / students.length) : 0;
  const classAvgScore = studentsWithScoresCount > 0 ? Math.round(totalAverageScoresSum / studentsWithScoresCount) : null;

  // Spotlights
  const topAchievers = studentMetrics.filter(sm => sm.averageScore !== null && sm.averageScore >= 85);
  const strugglingStudents = studentMetrics.filter(sm => sm.averageScore !== null && sm.averageScore < 70);
  const inactiveStudents = studentMetrics.filter(sm => sm.completedCount === 0 || sm.completionRate < 30);

  // Compute worksheet difficulties
  const worksheetStats = course.exercises.map(ex => {
    const exAssignment = assignments.find(a => a.exerciseId === ex.id);
    const scores: number[] = [];

    students.forEach(student => {
      if (exAssignment) {
        const studentSubs = exAssignment.submissions.filter(s => s.studentId === student.id);
        if (studentSubs.length > 0) {
          const bestScore = Math.max(...studentSubs.map(s => s.teacherScore !== null ? s.teacherScore : s.effectiveScore));
          scores.push(bestScore);
        }
      }
    });

    const average = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return {
      id: ex.id,
      title: ex.title,
      type: ex.type,
      average,
      submissionsCount: scores.length
    };
  });

  const activeWorksheetStats = worksheetStats.filter(ws => ws.average !== null);
  const sortedWorksheets = [...activeWorksheetStats].sort((a, b) => (a.average || 0) - (b.average || 0));

  const toughestWorksheet = sortedWorksheets.length > 0 ? sortedWorksheets[0] : null;
  const easiestWorksheet = sortedWorksheets.length > 0 ? sortedWorksheets[sortedWorksheets.length - 1] : null;

  return (
    <>
      <Navbar />
      <main className="max-w-6xl w-full mx-auto px-4 py-8 space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1">
            <Link
              href="/teacher"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight font-mono uppercase">
              Course Insights
            </h1>
            <p className="text-sm text-neutral-500 font-mono">
              Course: <strong className="text-neutral-850 dark:text-neutral-200">{course.title}</strong> &bull; Class: <strong className="text-neutral-850 dark:text-neutral-200">{classroom.name}</strong>
            </p>
          </div>
        </div>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">Class Average Score</span>
            <span className="text-3xl font-black font-mono text-neutral-900 dark:text-neutral-100 mt-2">
              {classAvgScore !== null ? `${classAvgScore}%` : "—"}
            </span>
          </div>
          <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">Average Completion Rate</span>
            <span className="text-3xl font-black font-mono text-neutral-900 dark:text-neutral-100 mt-2">
              {classAvgCompletionRate}%
            </span>
          </div>
          <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">Pupils Enrolled</span>
            <span className="text-3xl font-black font-mono text-neutral-900 dark:text-neutral-100 mt-2">{students.length}</span>
          </div>
          <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">Course Worksheets</span>
            <span className="text-3xl font-black font-mono text-neutral-900 dark:text-neutral-100 mt-2">{course.exercises.length}</span>
          </div>
        </div>

        {/* Spotlights Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-500" />
            Student Spotlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Achievers */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-green-50/20 dark:bg-green-950/5 space-y-3">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                Top Achievers (&ge;85%)
              </h3>
              {topAchievers.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">No students in this range yet.</p>
              ) : (
                <ul className="space-y-2 text-xs font-mono">
                  {topAchievers.map(sa => (
                    <li key={sa.id} className="flex justify-between border-b border-green-200/30 pb-1.5">
                      <span>{sa.username}</span>
                      <strong className="text-green-700 dark:text-green-400">{Math.round(sa.averageScore!)}% avg</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Struggling Students */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-red-50/20 dark:bg-red-955/5 space-y-3">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Struggling Spotlights (&lt;70%)
              </h3>
              {strugglingStudents.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">No students in this range yet.</p>
              ) : (
                <ul className="space-y-2 text-xs font-mono">
                  {strugglingStudents.map(ss => (
                    <li key={ss.id} className="flex justify-between border-b border-red-200/30 pb-1.5">
                      <span>{ss.username}</span>
                      <strong className="text-red-700 dark:text-red-400">{Math.round(ss.averageScore!)}% avg</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Inactive Students */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-amber-50/20 dark:bg-amber-955/5 space-y-3">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                Inactive Pupils (&lt;30% done)
              </h3>
              {inactiveStudents.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">No inactive students detected.</p>
              ) : (
                <ul className="space-y-2 text-xs font-mono">
                  {inactiveStudents.map(ia => (
                    <li key={ia.id} className="flex justify-between border-b border-amber-200/30 pb-1.5">
                      <span>{ia.username}</span>
                      <strong className="text-amber-700 dark:text-amber-400">{ia.completedCount} / {course.exercises.length} done</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Worksheet Difficulty Highlighting */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-neutral-500" />
            Worksheet Difficulty Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {toughestWorksheet && (
              <div className="p-4 border border-red-200 dark:border-red-950/40 rounded bg-red-50/5 dark:bg-red-950/2 flex justify-between items-center text-sm">
                <div>
                  <span className="text-[10px] font-bold font-mono uppercase text-red-650 tracking-wider block">Toughest Worksheet</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">{toughestWorksheet.title}</span>
                  <span className="block text-[10px] text-neutral-500 font-mono">Based on {toughestWorksheet.submissionsCount} student scores</span>
                </div>
                <span className="px-3 py-1.5 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 font-black font-mono border border-red-200 dark:border-red-900/40 rounded">
                  Avg {toughestWorksheet.average}%
                </span>
              </div>
            )}
            {easiestWorksheet && (
              <div className="p-4 border border-green-200 dark:border-green-950/40 rounded bg-green-50/5 dark:bg-green-950/2 flex justify-between items-center text-sm">
                <div>
                  <span className="text-[10px] font-bold font-mono uppercase text-green-650 tracking-wider block">Easiest Worksheet</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">{easiestWorksheet.title}</span>
                  <span className="block text-[10px] text-neutral-500 font-mono">Based on {easiestWorksheet.submissionsCount} student scores</span>
                </div>
                <span className="px-3 py-1.5 bg-green-50 dark:bg-green-950/20 text-green-650 dark:text-green-400 font-black font-mono border border-green-200 dark:border-green-900/40 rounded">
                  Avg {easiestWorksheet.average}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Student Progression Table Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-neutral-500" />
            Worksheet Progression Grid
          </h2>
          {students.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded text-neutral-500 font-mono">
              No students enrolled in this classroom.
            </div>
          ) : (
            <div className="border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="text-[10px] font-mono uppercase bg-neutral-150 dark:bg-neutral-900 border-b border-neutral-350 dark:border-neutral-800 text-neutral-500">
                    <tr>
                      <th className="px-4 py-3 font-bold border-r border-neutral-250 dark:border-neutral-850">Student</th>
                      <th className="px-4 py-3 font-bold border-r border-neutral-250 dark:border-neutral-850 text-center">% Done</th>
                      <th className="px-4 py-3 font-bold border-r border-neutral-250 dark:border-neutral-850 text-center">Avg %</th>
                      {course.exercises.map((ex, idx) => (
                        <th
                          key={ex.id}
                          className="px-4 py-3 font-semibold text-center min-w-32"
                          title={ex.title}
                        >
                          <span className="block truncate max-w-36">{idx + 1}. {ex.title}</span>
                          <span className="block text-[8px] font-mono text-neutral-450 normal-case font-medium">{getExerciseTypeLabel(ex.type)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-850 font-mono">
                    {studentMetrics.map(sm => (
                      <tr key={sm.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20">
                        <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100 border-r border-neutral-250 dark:border-neutral-850">
                          {sm.username}
                        </td>
                        <td className="px-4 py-3 text-center border-r border-neutral-250 dark:border-neutral-850">
                          {Math.round(sm.completionRate)}%
                        </td>
                        <td className="px-4 py-3 text-center border-r border-neutral-250 dark:border-neutral-850 font-extrabold text-neutral-950 dark:text-neutral-250">
                          {sm.averageScore !== null ? `${Math.round(sm.averageScore)}%` : "—"}
                        </td>
                        {course.exercises.map(ex => {
                          const grade = sm.grades[ex.id];
                          const scoreText = grade !== null ? `${Math.round(grade)}%` : "—";
                          const isHigh = grade !== null && grade >= 80;
                          const isLow = grade !== null && grade < 50;

                          return (
                            <td key={ex.id} className="px-4 py-3 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded-sm font-bold border ${
                                  grade === null
                                    ? "text-neutral-400 border-transparent bg-transparent"
                                    : isHigh
                                    ? "border-green-400 text-green-700 bg-green-50/30"
                                    : isLow
                                    ? "border-red-400 text-red-750 bg-red-50/30"
                                    : "border-neutral-350 text-neutral-800 bg-neutral-100/50"
                                }`}
                              >
                                {scoreText}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
