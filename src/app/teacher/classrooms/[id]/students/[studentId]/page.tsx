import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getExerciseFromDisk } from "@/lib/exercises";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { ArrowLeft, BookOpen, Calendar, Check, X, ExternalLink, Award } from "lucide-react";
import ResetPasswordButton from "../../ResetPasswordButton";
import { getExerciseMaxPoints } from "@/lib/points";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  const { id: classroomId, studentId } = await params;

  // Fetch student and check enrollment in the classroom
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: {
      classroomsJoined: {
        where: { classroomId },
        include: {
          classroom: {
            include: {
              assignments: {
                include: {
                  exercise: true,
                  submissions: {
                    where: { studentId },
                    orderBy: { completedAt: "desc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!student || student.role !== "STUDENT" || student.classroomsJoined.length === 0) {
    notFound();
  }

  const enrollment = student.classroomsJoined[0];
  const classroom = enrollment.classroom;

  // Check access permission: caller must be classroom's teacher
  if (classroom.teacherId !== session.userId) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold font-mono text-red-650 uppercase">Access Denied</h2>
          <p className="text-sm text-neutral-500">You do not own this classroom.</p>
        </main>
      </>
    );
  }

  // Pre-calculate statistics
  const assignmentDetails = classroom.assignments.map((as) => {
    const diskEx = getExerciseFromDisk(as.exerciseId);
    const maxPoints = diskEx ? getExerciseMaxPoints(diskEx) : 1;

    const studentSubs = as.submissions;
    const hasSubmitted = studentSubs.length > 0;

    let bestSub = null;
    if (hasSubmitted) {
      bestSub = studentSubs.reduce((best, current) => {
        const currentScore = current.teacherScore !== null ? current.teacherScore : current.effectiveScore;
        const bestScore = best.teacherScore !== null ? best.teacherScore : best.effectiveScore;
        return currentScore > bestScore ? current : best;
      }, studentSubs[0]);
    }

    return {
      assignmentId: as.id,
      title: as.exercise.title,
      dueDate: as.dueDate,
      hasSubmitted,
      bestSubmission: bestSub,
      attemptsCount: studentSubs.length,
      allSubmissions: studentSubs,
      maxPoints,
    };
  });

  const solvedCount = assignmentDetails.filter((d) => d.hasSubmitted).length;
  const totalScoreCount = assignmentDetails.filter((d) => d.bestSubmission).length;
  const totalScoreSum = assignmentDetails.reduce((sum, d) => {
    if (d.bestSubmission) {
      const bestScore = d.bestSubmission.teacherScore !== null ? d.bestSubmission.teacherScore : d.bestSubmission.effectiveScore;
      return sum + bestScore;
    }
    return sum;
  }, 0);
  const averageScore = totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount) : null;

  // Extract all earned badges from completed assignments
  const earnedBadges: Array<{
    exerciseId: string;
    worksheetTitle: string;
    badgeName: string;
    badgeEmoji: string;
    completedAt: Date;
    score: number;
  }> = [];

  classroom.assignments.forEach((as) => {
    if (as.submissions.length > 0) {
      const latestSub = as.submissions[0];
      const exercise = as.exercise;
      const name = exercise.badgeName || exercise.title;
      const emoji = exercise.badgeEmoji || "🏆";

      if (!earnedBadges.some((b) => b.exerciseId === exercise.id)) {
        earnedBadges.push({
          exerciseId: exercise.id,
          worksheetTitle: exercise.title,
          badgeName: name,
          badgeEmoji: emoji,
          completedAt: latestSub.completedAt,
          score: Math.max(...as.submissions.map((s) => s.teacherScore !== null ? s.teacherScore : s.effectiveScore)),
        });
      }
    }
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between border-b pb-4">
          <Link
            href={`/teacher/classrooms/${classroomId}`}
            className="flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Gradebook
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-750">
            Pupil Profile
          </span>
        </div>

        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-450 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
              Class: {classroom.name}
            </span>
            <h1 className="text-2xl font-black font-mono uppercase tracking-tight text-neutral-900 dark:text-neutral-100">
              {student.username}
            </h1>
            <p className="text-xs text-neutral-500">
              Joined classroom on {new Date(enrollment.joinedAt).toLocaleDateString("en-GB")}
            </p>
          </div>

          <div className="flex items-center gap-6 divide-x divide-neutral-200 dark:divide-neutral-800 bg-neutral-50 dark:bg-neutral-950/45 p-4 rounded border">
            <div className="px-2 text-center">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider font-mono">
                Completion Rate
              </span>
              <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                {classroom.assignments.length > 0
                  ? `${Math.round((solvedCount / classroom.assignments.length) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="px-4 text-center">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider font-mono">
                Average Score
              </span>
              <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                {averageScore !== null ? `${averageScore}%` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Badges Earned Section */}
        {earnedBadges.length > 0 && (
          <div className="border border-purple-200 dark:border-purple-900 rounded bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/10 dark:to-indigo-950/10 p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <Award className="w-4 h-4 shrink-0" />
              Badges Earned ({earnedBadges.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {earnedBadges.map((badge) => (
                <div
                  key={badge.exerciseId}
                  className="p-4 border border-purple-200/60 dark:border-purple-900/30 bg-white/60 dark:bg-black/35 rounded shadow-sm flex flex-col items-center text-center justify-between gap-3 hover:scale-[1.02] hover:border-purple-400 transition-all duration-200"
                >
                  <div className="w-12 h-12 flex items-center justify-center text-3xl bg-purple-100 dark:bg-purple-950/50 rounded-full border border-purple-200 dark:border-purple-900 shadow-inner">
                    {badge.badgeEmoji || "🏆"}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs text-neutral-900 dark:text-neutral-100 line-clamp-1" title={badge.badgeName}>
                      {badge.badgeName}
                    </h3>
                    <p className="text-[9px] text-neutral-500 uppercase tracking-wide font-mono line-clamp-1" title={badge.worksheetTitle}>
                      {badge.worksheetTitle}
                    </p>
                  </div>
                  <span className="text-[9px] font-mono bg-purple-100/50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Score: {badge.score.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Password Reset */}
        <div className="p-5 border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900/30 space-y-3">
          <h3 className="font-bold font-mono text-xs uppercase tracking-wide text-neutral-800 dark:text-neutral-250">
            Account Security Management
          </h3>
          <p className="text-xs text-neutral-500 max-w-xl">
            If this pupil forgot their password, you can reset it instantly below. The student does not require an email address.
          </p>
          <div className="pt-1">
            <ResetPasswordButton studentId={student.id} studentName={student.username} />
          </div>
        </div>

        {/* Assignment Performance Summary */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-mono uppercase tracking-wide flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-neutral-500" />
            Performance by Assignment
          </h2>

          {assignmentDetails.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded text-neutral-500">
              No assignments assigned to this class yet.
            </div>
          ) : (
            <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs font-mono uppercase bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-300 dark:border-neutral-800 text-neutral-550">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Assignment Title</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-center">Attempts</th>
                      <th className="px-6 py-3 font-semibold text-center">Best Score</th>
                      <th className="px-6 py-3 font-semibold text-center">Points Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {assignmentDetails.map((item) => {
                      const bestScoreVal = item.bestSubmission
                        ? (item.bestSubmission.teacherScore !== null ? item.bestSubmission.teacherScore : item.bestSubmission.effectiveScore)
                        : 0;
                      const pointsEarned = item.bestSubmission
                        ? Math.round((bestScoreVal / 100) * item.maxPoints)
                        : 0;

                      return (
                        <tr key={item.assignmentId} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20">
                          <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-neutral-100">
                            {item.title}
                          </td>
                          <td className="px-6 py-4">
                            {item.bestSubmission ? (
                              <span className="text-xs text-neutral-600 dark:text-neutral-450 flex items-center gap-1 font-mono">
                                <Check className="w-4 h-4 text-green-500" />
                                Completed
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-450 italic flex items-center gap-1">
                                <X className="w-4 h-4 text-red-500" />
                                Not Attempted
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center font-mono">
                            {item.attemptsCount > 0 ? `${item.attemptsCount}×` : "—"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.bestSubmission ? (
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                  bestScoreVal >= 80
                                    ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                    : bestScoreVal < 50
                                    ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                                    : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {bestScoreVal}%
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                            {item.bestSubmission ? `${pointsEarned} / ${item.maxPoints}` : "—"}
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

        {/* Detailed Submission Timeline/History */}
        {solvedCount > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold font-mono uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-5 h-5 text-neutral-500" />
              Submission Attempt Log
            </h2>

            <div className="space-y-3">
              {assignmentDetails
                .filter((item) => item.hasSubmitted)
                .flatMap((item) =>
                  item.allSubmissions.map((sub) => {
                    const scoreVal = sub.teacherScore !== null ? sub.teacherScore : sub.effectiveScore;
                    return {
                      submissionId: sub.id,
                      assignmentTitle: item.title,
                      completedAt: sub.completedAt,
                      score: scoreVal,
                      points: Math.round((scoreVal / 100) * item.maxPoints),
                      maxPoints: item.maxPoints,
                    };
                  })
                )
                .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                .map((log) => (
                  <div
                    key={log.submissionId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-neutral-250 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm gap-4 hover:border-neutral-350 dark:hover:border-neutral-700 transition"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">
                        {log.assignmentTitle}
                      </h4>
                      <p className="text-[10px] text-neutral-450 font-mono">
                        Submitted: {new Date(log.completedAt).toLocaleString("en-GB")}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            log.score >= 80
                              ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                              : log.score < 50
                              ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                              : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {log.score}%
                        </span>
                        <span className="block text-[10px] text-neutral-450 font-mono mt-0.5">
                          {log.points} / {log.maxPoints} pts
                        </span>
                      </div>

                      <Link
                        href={`/submissions/${log.submissionId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase font-mono border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2.5 py-1.5 rounded transition text-neutral-700 dark:text-neutral-300"
                      >
                        Review
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
