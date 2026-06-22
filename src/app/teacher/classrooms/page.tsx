import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { ArrowLeft, Users, BarChart2, ExternalLink, Key } from "lucide-react";
import SyncRosterButton from "../SyncRosterButton";
import CreateClassroomForm from "../CreateClassroomForm";
import ClassroomDiagnosticCard from "./[id]/ClassroomDiagnosticCard";
import { getExerciseFromDisk } from "@/lib/exercises";
import { getExerciseMaxPoints } from "@/lib/points";

export default async function ClassroomsInsightsPage() {
  const session = await getSession();

  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  // Fetch Classrooms taught by teacher with all submissions
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
          submissions: {
            orderBy: {
              completedAt: "desc",
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Pre-calculate data for each classroom
  const classroomsData = classrooms.map((classroom) => {
    // 1. Pre-calculate max points for each assignment's exercise to avoid repetitive disk calls
    const assignmentMaxPoints: Record<string, number> = {};
    classroom.assignments.forEach((assignment) => {
      const exercise = getExerciseFromDisk(assignment.exerciseId);
      assignmentMaxPoints[assignment.id] = exercise ? getExerciseMaxPoints(exercise) : 1;
    });

    // 2. Build student roster calculations
    const studentInsights = classroom.students.map((cs) => {
      const grades: Record<string, { score: number; points: number; maxPoints: number } | null> = {};

      classroom.assignments.forEach((assignment) => {
        const studentSubs = assignment.submissions.filter((s) => s.studentId === cs.studentId);
        
        if (studentSubs.length > 0) {
          // Find best attempt
          const bestSub = studentSubs.reduce((best, s) => {
            const sVal = s.teacherScore !== null ? s.teacherScore : s.effectiveScore;
            const bestVal = best.teacherScore !== null ? best.teacherScore : best.effectiveScore;
            return sVal > bestVal ? s : best;
          }, studentSubs[0]);

          const maxPts = assignmentMaxPoints[assignment.id];
          const scoreVal = bestSub.teacherScore !== null ? bestSub.teacherScore : bestSub.effectiveScore;
          const pts = Math.round((scoreVal / 100) * maxPts);

          grades[assignment.id] = {
            score: Math.round(scoreVal),
            points: pts,
            maxPoints: maxPts,
          };
        } else {
          grades[assignment.id] = null;
        }
      });

      // Categories and struggles
      const categoryStats: Record<string, { sum: number; count: number }> = {};
      let passedCount = 0;
      let developingCount = 0;
      let strugglingCount = 0;
      let incompleteCount = 0;

      classroom.assignments.forEach((assignment) => {
        const grade = grades[assignment.id];
        if (grade) {
          if (grade.score >= 75) passedCount++;
          else if (grade.score >= 50) developingCount++;
          else strugglingCount++;

          const exType = assignment.exercise.type || "worksheet";
          if (!categoryStats[exType]) categoryStats[exType] = { sum: 0, count: 0 };
          categoryStats[exType].sum += grade.score;
          categoryStats[exType].count++;
        } else {
          incompleteCount++;
        }
      });

      const struggles: string[] = [];
      Object.entries(categoryStats).forEach(([cat, stats]) => {
        const avg = stats.sum / stats.count;
        if (avg < 75) {
          let label = "Grammar";
          if (cat === "vocabulary") label = "Vocabulary";
          else if (cat === "writing-coach") label = "Writing Coach";
          else if (cat === "interactive-reading") label = "Reading Comprehension";
          struggles.push(`${label} (avg ${Math.round(avg)}%)`);
        }
      });

      return {
        id: cs.studentId,
        username: cs.student.username,
        struggles,
        incompleteCount,
        completedCount: passedCount + developingCount + strugglingCount,
        hasStruggles: struggles.length > 0,
      };
    });

    // 3. Class-wide averages
    let classAverageSum = 0;
    let classAverageCount = 0;
    studentInsights.forEach((s) => {
      // Extract student's submissions for average
      const studentSubs = classroom.assignments.flatMap(a => a.submissions.filter(sub => sub.studentId === s.id));
      if (studentSubs.length > 0) {
        const bestScores = classroom.assignments.map(a => {
          const subs = a.submissions.filter(sub => sub.studentId === s.id);
          if (subs.length === 0) return null;
          return Math.max(...subs.map(sub => sub.teacherScore !== null ? sub.teacherScore : sub.effectiveScore));
        }).filter((score): score is number => score !== null);

        if (bestScores.length > 0) {
          classAverageSum += bestScores.reduce((sum, score) => sum + score, 0) / bestScores.length;
          classAverageCount++;
        }
      }
    });
    const overallClassAverage = classAverageCount > 0 ? Math.round(classAverageSum / classAverageCount) : null;

    // 4. Hardest Exercises
    const assignmentDifficulty = classroom.assignments.map((assignment) => {
      const scores = assignment.submissions.map((sub) => sub.teacherScore !== null ? sub.teacherScore : sub.effectiveScore);
      const average = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return {
        id: assignment.id,
        title: assignment.exercise.title,
        average,
        submissionsCount: scores.length,
      };
    }).filter(ad => ad.average !== null)
      .sort((a, b) => (a.average || 0) - (b.average || 0));

    return {
      ...classroom,
      studentInsights,
      overallClassAverage,
      hardestExercises: assignmentDifficulty.slice(0, 3), // Top 3 hardest
    };
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Navigation / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1">
            <Link
              href="/teacher"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight font-mono uppercase">
              Classrooms & Pupil Insights
            </h1>
            <p className="text-sm text-neutral-500">
              In-depth view of student learning patterns, struggles, and diagnostics.
            </p>
          </div>
          <div className="p-4 border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm shrink-0 md:w-80">
            <CreateClassroomForm />
          </div>
        </div>

        {/* Global Classroom Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">Total Classrooms</span>
            <span className="text-3xl font-black font-mono text-neutral-900 dark:text-neutral-100 mt-2">{classrooms.length}</span>
          </div>
          <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">Total Pupils</span>
            <span className="text-3xl font-black font-mono text-neutral-900 dark:text-neutral-100 mt-2">
              {classrooms.reduce((sum, c) => sum + c.students.length, 0)}
            </span>
          </div>
          <div className="p-5 border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm flex flex-col justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">Classrooms Average</span>
            <span className="text-3xl font-black font-mono text-neutral-900 dark:text-neutral-100 mt-2">
              {classroomsData.filter(c => c.overallClassAverage !== null).length > 0
                ? `${Math.round(classroomsData.filter(c => c.overallClassAverage !== null).reduce((sum, c) => sum + (c.overallClassAverage || 0), 0) / classroomsData.filter(c => c.overallClassAverage !== null).length)}%`
                : "—"}
            </span>
          </div>
        </div>

        {/* Detailed Classroom insights */}
        {classroomsData.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-neutral-300 dark:border-neutral-800 rounded text-neutral-500 font-mono text-xs uppercase">
            No classrooms created yet. Use the form above to create one.
          </div>
        ) : (
          <div className="space-y-12">
            {classroomsData.map((cls) => (
              <div key={cls.id} className="border border-neutral-200 dark:border-neutral-900 rounded bg-white/30 dark:bg-black/10 backdrop-blur-sm overflow-hidden p-6 space-y-6 hover:border-neutral-400 dark:hover:border-neutral-750 transition duration-200">
                {/* Classroom Title and Basic Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-900 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 font-mono uppercase tracking-wide flex items-center gap-2">
                      <span>{cls.name}</span>
                      <Link
                        href={`/teacher/classrooms/${cls.id}`}
                        className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 border border-neutral-300 dark:border-neutral-800 rounded bg-transparent hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition"
                      >
                        Gradebook <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs font-mono text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Key className="w-3.5 h-3.5" /> Join Code: <strong>{cls.joinCode}</strong>
                      </span>
                      {cls.msGraphClassId && (
                        <span>Linked with MS Teams</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {cls.msGraphClassId && (
                      <SyncRosterButton classroomId={cls.id} />
                    )}
                    <div className="px-4 py-2 border border-neutral-250 dark:border-neutral-800 rounded font-mono text-center">
                      <span className="text-[9px] uppercase tracking-wider text-neutral-500 block">Class Average</span>
                      <span className="text-base font-black text-neutral-900 dark:text-neutral-100">
                        {cls.overallClassAverage !== null ? `${cls.overallClassAverage}%` : "—"}
                      </span>
                    </div>
                    <div className="px-4 py-2 border border-neutral-250 dark:border-neutral-800 rounded font-mono text-center">
                      <span className="text-[9px] uppercase tracking-wider text-neutral-500 block">Pupils</span>
                      <span className="text-base font-black text-neutral-900 dark:text-neutral-100">{cls.students.length}</span>
                    </div>
                  </div>
                </div>

                {/* Sub-grid of detailed struggles and AI diagnostic */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Student struggles roster */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-neutral-450" />
                      Pupil Progress & Struggles
                    </h3>

                    {cls.studentInsights.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic font-mono uppercase">No students enrolled in this classroom.</p>
                    ) : (
                      <div className="border border-neutral-200 dark:border-neutral-850 rounded overflow-hidden max-h-[350px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[10px] font-mono uppercase bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500">
                            <tr>
                              <th className="px-4 py-2.5 font-semibold">Student</th>
                              <th className="px-4 py-2.5 font-semibold text-center">Done</th>
                              <th className="px-4 py-2.5 font-semibold">Struggling Category</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-250 dark:divide-neutral-850 font-mono">
                            {cls.studentInsights.map((student) => (
                              <tr key={student.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20">
                                <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">
                                  <Link
                                    href={`/teacher/classrooms/${cls.id}/students/${student.id}`}
                                    className="hover:underline flex items-center gap-1"
                                  >
                                    {student.username}
                                    <ExternalLink className="w-2.5 h-2.5 text-neutral-450" />
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-center text-neutral-600 dark:text-neutral-400">
                                  {student.completedCount}
                                  {student.incompleteCount > 0 && (
                                    <span className="text-red-500 ml-1" title={`${student.incompleteCount} incomplete assignments`}>
                                      ({student.incompleteCount} pending)
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {student.hasStruggles ? (
                                    <div className="flex flex-wrap gap-1">
                                      {student.struggles.map((st, i) => (
                                        <span
                                          key={i}
                                          className="text-[9px] font-mono px-1.5 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded font-bold"
                                        >
                                          {st}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900/50 rounded font-bold">
                                      Stable Progress
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right column: AI Diagnostic Report & Hardest Worksheets */}
                  <div className="space-y-6 flex flex-col justify-between">
                    {/* Hardest exercises */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4 text-neutral-450" />
                        Hardest Worksheets (Low Class Scores)
                      </h3>

                      {cls.hardestExercises.length === 0 ? (
                        <p className="text-xs text-neutral-400 italic font-mono">No submissions recorded to calculate worksheet difficulty.</p>
                      ) : (
                        <div className="space-y-2">
                          {cls.hardestExercises.map((ex) => (
                            <div key={ex.id} className="p-3 border border-neutral-200 dark:border-neutral-850 rounded flex justify-between items-center text-xs">
                              <div className="space-y-0.5">
                                <span className="font-semibold text-neutral-900 dark:text-neutral-100">{ex.title}</span>
                                <span className="block text-[10px] text-neutral-500 font-mono">
                                  Based on {ex.submissionsCount} submissions
                                </span>
                              </div>
                              <span className="px-2 py-1 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 font-bold font-mono border border-red-200 dark:border-red-900/40">
                                Avg {ex.average}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI Classroom Diagnostic Card */}
                    <div className="flex-1 mt-4">
                      <ClassroomDiagnosticCard
                        classroomId={cls.id}
                        initialDiagnostic={cls.aiDiagnostic}
                        initialDiagnosticDate={cls.aiDiagnosticDate}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
