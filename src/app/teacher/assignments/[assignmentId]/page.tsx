import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getExerciseFromDisk } from "@/lib/exercises";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { ArrowLeft, BookOpen, User, Check, X, Award, ExternalLink, Calendar } from "lucide-react";

// Helper function to get max points per task
function getTaskMaxPoints(q: any): number {
  if (q.type === "media" || q.type === "instruction") return 0;
  if (q.type === "multiple-choice") return 1;
  if (q.type === "gap-fill" || q.type === "drag-drop") {
    const gaps = (q.text || "").match(/<<(.*?)>>/g) || [];
    return gaps.length > 0 ? gaps.length : 1;
  }
  if (q.type === "categorization") return (q.items || []).length || 1;
  if (q.type === "clickable-choice") return (q.statements || []).length || 1;
  if (q.type === "matching") return (q.pairs || []).length || 1;
  if (q.type === "open-question") return 1;
  if (q.type === "ordering") return 1;
  return 1;
}

// Helper function to get max points for entire exercise
function getExerciseMaxPoints(exercise: any): number {
  if (exercise.type === "worksheet") {
    let totalMax = 0;
    (exercise.questions || []).forEach((q: any) => {
      totalMax += getTaskMaxPoints(q);
    });
    return totalMax;
  }
  if (exercise.type === "image-hotspot-quiz") {
    return (exercise.tasks || []).length || 1;
  }
  if (exercise.type === "interactive-reading") {
    let totalQuestions = 0;
    Object.values(exercise.pages || {}).forEach((page: any) => {
      totalQuestions += (page.questions || []).length;
    });
    return totalQuestions || 1;
  }
  if (exercise.type === "explore-image-map") {
    return 1;
  }
  if (exercise.type === "multiple-choice") {
    return (exercise.questions || []).length || 1;
  }
  if (exercise.type === "gap-fill" || exercise.type === "drag-drop") {
    const gaps = (exercise.text || "").match(/<<(.*?)>>/g) || [];
    return gaps.length > 0 ? gaps.length : 1;
  }
  if (exercise.type === "categorization") {
    return (exercise.items || []).length || 1;
  }
  if (exercise.type === "clickable-choice") {
    return (exercise.statements || []).length || 1;
  }
  if (exercise.type === "matching") {
    return (exercise.pairs || []).length || 1;
  }
  if (exercise.type === "vocabulary") {
    return (exercise.vocabList || []).length || 1;
  }
  if (exercise.type === "open-question") return 1;
  if (exercise.type === "ordering") return 1;
  return 1;
}

export default async function AssignmentSubmissionsPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  const { assignmentId } = await params;

  // Fetch assignment, classroom students, and submissions
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      classroom: {
        include: {
          students: {
            include: {
              student: true,
            },
          },
        },
      },
      exercise: true,
      submissions: {
        include: {
          student: true,
        },
      },
    },
  });

  if (!assignment) {
    notFound();
  }

  // Access check: must be teacher of the classroom
  if (assignment.classroom.teacherId !== session.userId) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold font-mono text-red-650 uppercase">Access Denied</h2>
          <p className="text-sm text-neutral-500">
            You do not own this classroom.
          </p>
        </main>
      </>
    );
  }

  // Load exercise configuration to calculate total points
  const exercise = getExerciseFromDisk(assignment.exerciseId);
  const maxPoints = exercise ? getExerciseMaxPoints(exercise) : 1;

  // Group ALL submissions by student. Each student can have multiple attempts.
  const studentsWithSubmissions = assignment.classroom.students.map((cs) => {
    const studentSubs = assignment.submissions
      .filter((s) => s.studentId === cs.studentId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    const bestSub = studentSubs.length > 0
      ? studentSubs.reduce((best, s) => s.effectiveScore > best.effectiveScore ? s : best, studentSubs[0])
      : null;
    return {
      student: cs.student,
      submissions: studentSubs,
      latestSubmission: studentSubs[0] || null,
      bestSubmission: bestSub,
      attemptCount: studentSubs.length,
    };
  });

  // Calculate some statistics
  const totalStudents = studentsWithSubmissions.length;
  const completedCount = studentsWithSubmissions.filter((s) => s.attemptCount > 0).length;

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between border-b pb-4">
          <Link
            href="/teacher"
            className="flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-750">
            Submissions Dashboard
          </span>
        </div>

        {/* Assignment Spec Header */}
        <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-450 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                Classroom: {assignment.classroom.name}
              </span>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight text-neutral-900 dark:text-neutral-100">
                {assignment.exercise.title}
              </h1>
              {assignment.dueDate && (
                <div className="flex items-center gap-1 text-xs text-neutral-500 font-mono">
                  <Calendar className="w-4 h-4" />
                  Due: {new Date(assignment.dueDate).toLocaleDateString("en-GB")}
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 divide-x divide-neutral-200 dark:divide-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 p-4 rounded border">
              <div className="px-2 text-center">
                <span className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider font-mono">
                  Pupils Completed
                </span>
                <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                  {completedCount} / {totalStudents}
                </span>
              </div>
              <div className="px-4 text-center">
                <span className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider font-mono">
                  Max points
                </span>
                <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                  {maxPoints} pts
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submissions List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-mono uppercase tracking-wide flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-neutral-500" />
            Pupil Performance Overview
          </h2>

          {totalStudents === 0 ? (
            <div className="text-center py-12 border border-dashed rounded text-neutral-500">
              No students enrolled in this classroom yet.
            </div>
          ) : (
            <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-mono uppercase bg-neutral-50 dark:bg-neutral-955 border-b border-neutral-300 dark:border-neutral-800 text-neutral-500">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Pupil Name</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-center">Attempts</th>
                      <th className="px-6 py-3 font-semibold text-center">Best Score</th>
                      <th className="px-6 py-3 font-semibold text-center">Points</th>
                      <th className="px-6 py-3 font-semibold text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {studentsWithSubmissions.map(({ student, latestSubmission, bestSubmission, attemptCount }) => {
                      const pointsEarned = bestSubmission
                        ? Math.round((bestSubmission.effectiveScore / 100) * maxPoints)
                        : 0;

                      return (
                        <tr
                          key={student.id}
                          className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20"
                        >
                          <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <User className="w-4 h-4 text-neutral-400" />
                            {student.username}
                          </td>
                          <td className="px-6 py-4">
                            {latestSubmission ? (
                              <span className="text-xs text-neutral-600 dark:text-neutral-450 flex items-center gap-1 font-mono">
                                <Check className="w-4 h-4 text-green-500" />
                                {new Date(latestSubmission.completedAt).toLocaleDateString("en-GB")}
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-450 italic flex items-center gap-1">
                                <X className="w-4 h-4 text-red-500" />
                                Not Submitted
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {attemptCount > 0 ? (
                              <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                                {attemptCount}×
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {bestSubmission ? (
                              <div className="flex flex-col items-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                    bestSubmission.effectiveScore >= 80
                                      ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                      : bestSubmission.effectiveScore < 50
                                      ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                                      : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                                  }`}
                                >
                                  {bestSubmission.effectiveScore.toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center font-mono font-bold text-neutral-700 dark:text-neutral-300">
                            {bestSubmission ? (
                              <span>{pointsEarned} / {maxPoints}</span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {latestSubmission ? (
                              <Link
                                href={`/submissions/${latestSubmission.id}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold uppercase font-mono border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2.5 py-1 rounded transition text-neutral-700 dark:text-neutral-300"
                              >
                                Review
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            ) : (
                              <span className="text-neutral-400 text-xs font-mono">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
