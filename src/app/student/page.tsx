import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { Play, AlertCircle, BookOpen, Users, RotateCcw, Trophy, FolderOpen } from "lucide-react";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";
import JoinClassroomForm from "./JoinClassroomForm";

function renderDueDateBadge(dueDate: Date | null, isCompleted: boolean) {
  if (isCompleted || !dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();
  
  // Set times to midnight for date-only comparison
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const timeDiff = dueMidnight.getTime() - nowMidnight.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  if (timeDiff < 0) {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200/50 dark:border-red-900/50">
        Overdue
      </span>
    );
  } else if (daysDiff <= 1) {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50 animate-pulse">
        Due Soon
      </span>
    );
  } else {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50">
        Due in {daysDiff} day{daysDiff !== 1 ? "s" : ""}
      </span>
    );
  }
}

export default async function StudentDashboard() {
  const session = await getSession();

  if (!session || session.role !== "STUDENT") {
    redirect("/login");
  }

  // Fetch classrooms the student has joined, with all submissions per assignment
  const classroomsJoined = await prisma.classroomStudent.findMany({
    where: { studentId: session.userId },
    include: {
      classroom: {
        include: {
          teacher: true,
          assignments: {
            include: {
              exercise: true,
              submissions: {
                where: { studentId: session.userId },
                orderBy: { completedAt: "desc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          courseAssignments: {
            include: {
              course: true,
              assignments: {
                include: {
                  exercise: true,
                  submissions: {
                    where: { studentId: session.userId },
                    orderBy: { completedAt: "desc" },
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  // Fetch active live sessions from teachers of classrooms the student has joined
  const teacherIds = classroomsJoined.map((cs) => cs.classroom.teacherId);
  const activeLiveSessions = await prisma.liveQuizSession.findMany({
    where: {
      status: { not: "FINISHED" },
      hostId: { in: teacherIds },
    },
    include: {
      exercise: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate student in-app notifications
  const notifications: { id: string; type: "DUE_SOON" | "NEW"; message: string; link: string }[] = [];

  classroomsJoined.forEach((cs) => {
    // Check standalone assignments
    cs.classroom.assignments.forEach((as) => {
      const isCompleted = as.submissions.length > 0;
      if (!isCompleted) {
        // 1. Due soon check (due in less than 24 hours)
        if (as.dueDate) {
          const due = new Date(as.dueDate);
          const now = new Date();
          const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 3600);
          if (hoursLeft > 0 && hoursLeft <= 24) {
            notifications.push({
              id: `due-${as.id}`,
              type: "DUE_SOON",
              message: `"${as.exercise.title}" is due in less than 24 hours!`,
              link: `/assignments/${as.id}`,
            });
          }
        }
        // 2. New assignment check (assigned in past 48 hours)
        const ageInHours = (new Date().getTime() - new Date(as.createdAt).getTime()) / (1000 * 3600);
        if (ageInHours <= 48) {
          notifications.push({
            id: `new-${as.id}`,
            type: "NEW",
            message: `New assignment in ${cs.classroom.name}: "${as.exercise.title}"`,
            link: `/assignments/${as.id}`,
          });
        }
      }
    });

    // Check course assignments
    cs.classroom.courseAssignments.forEach((ca) => {
      ca.assignments.forEach((as) => {
        const isCompleted = as.submissions.length > 0;
        if (!isCompleted) {
          // New assignment check (assigned in past 48 hours)
          const ageInHours = (new Date().getTime() - new Date(as.createdAt).getTime()) / (1000 * 3600);
          if (ageInHours <= 48) {
            notifications.push({
              id: `new-${as.id}`,
              type: "NEW",
              message: `New assignment in course "${ca.course.title}": "${as.exercise.title}"`,
              link: `/assignments/${as.id}`,
            });
          }
        }
      });
    });
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-3xl font-extrabold tracking-tight font-mono uppercase">
            Student Dashboard
          </h1>
          <p className="text-sm text-neutral-500">
            View your classrooms, active assignments, and review your scores.
          </p>
        </div>

        {/* Notifications Alert Center */}
        {notifications.length > 0 && (
          <div className="border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900/30 p-5 space-y-3">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-550 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Inbox Alerts ({notifications.length})
            </h2>
            <div className="space-y-2">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link}
                  className="flex items-center justify-between p-3 rounded bg-white dark:bg-neutral-900 border border-neutral-250 dark:border-neutral-800 hover:border-neutral-350 dark:hover:border-neutral-700 transition"
                >
                  <span className="text-xs font-semibold text-neutral-850 dark:text-neutral-250">
                    {n.message}
                  </span>
                  <span className="text-[10px] font-mono uppercase font-bold text-neutral-450 hover:text-black dark:hover:text-white flex items-center gap-1 shrink-0 ml-4">
                    Open Task →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active Live Sessions */}
        {activeLiveSessions.length > 0 && (
          <div className="border border-purple-300 dark:border-purple-900 rounded-2xl bg-purple-50/10 dark:bg-purple-955/5 p-6 space-y-4 shadow-sm animate-pulse">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-purple-650 dark:text-purple-400 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              Active Live Quiz sessions ({activeLiveSessions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeLiveSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-5 border border-purple-200 dark:border-purple-950 bg-white dark:bg-neutral-900 rounded-xl shadow-sm flex items-center justify-between gap-4 hover:scale-[1.005] transition duration-200"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600">
                      PIN: {session.pin}
                    </span>
                    <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                      {session.exercise.title}
                    </h3>
                    <p className="text-[10px] text-neutral-450">
                      Status: <span className="font-semibold uppercase">{session.status}</span>
                    </p>
                  </div>
                  <Link
                    href={`/student/live-quiz/join?pin=${session.pin}`}
                    className="bg-purple-650 hover:bg-purple-700 text-white font-mono font-bold text-xs px-4 py-2.5 rounded-xl uppercase tracking-wider hover:opacity-90 transition shadow-sm shrink-0"
                  >
                    Join Quiz 🚀
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Join Classroom Form */}
        <JoinClassroomForm />

        {/* Classrooms & Assignments */}
        {classroomsJoined.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded text-neutral-500 space-y-4">
            <p>You have not joined any classrooms yet.</p>
            <p className="text-xs">
              Enter a join code above or register a new student account using a classroom Join Code provided by your teacher.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {classroomsJoined.map(({ classroom }) => (
              <div
                key={classroom.id}
                className="border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold font-mono uppercase text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Users className="w-5 h-5 text-neutral-500" />
                      {classroom.name}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Teacher: <span className="font-semibold">{classroom.teacher.username}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-300 self-start sm:self-center">
                    Join Code: {classroom.joinCode}
                  </span>
                </div>

                {/* Course Sections */}
                {classroom.courseAssignments.length > 0 && (
                  <div className="space-y-3">
                    {classroom.courseAssignments.map((courseAssignment) => {
                      const totalCount = courseAssignment.assignments.length;
                      const completedCount = courseAssignment.assignments.filter(
                        (a) => a.submissions.length > 0
                      ).length;

                      return (
                        <details
                          key={courseAssignment.id}
                          className="group border border-neutral-200 dark:border-neutral-800 rounded overflow-hidden"
                        >
                          <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-sm font-mono uppercase list-none [&::-webkit-details-marker]:hidden">
                            <div className="flex items-center gap-2 min-w-0">
                              <FolderOpen className="w-4 h-4 shrink-0 text-neutral-500" />
                              <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                {courseAssignment.course.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                                {completedCount}/{totalCount} completed
                              </span>
                              {courseAssignment.dueDate && (
                                <span className="text-[10px] text-neutral-500 font-mono whitespace-nowrap">
                                  Due: {new Date(courseAssignment.dueDate).toLocaleDateString("en-GB")}
                                </span>
                              )}
                            </div>
                          </summary>

                          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                            {courseAssignment.assignments.map((assignment) => {
                              const submissions = assignment.submissions;
                              const attemptCount = submissions.length;
                              const isCompleted = attemptCount > 0;

                              const bestEffective = isCompleted
                                ? Math.max(...submissions.map((s) => s.effectiveScore))
                                : null;

                              return (
                                <div
                                  key={assignment.id}
                                  className="py-3 px-4 first:pt-3 last:pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                  <div className="space-y-1">
                                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-200">
                                      {assignment.exercise.title}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                                      <span className="font-mono uppercase text-[10px] bg-neutral-100 dark:bg-neutral-850 px-1.5 py-0.5 rounded">
                                        {getExerciseTypeLabel(assignment.exercise.type)}
                                      </span>
                                      {assignment.dueDate && (
                                        <span className="font-mono">
                                          Due: {new Date(assignment.dueDate).toLocaleDateString("en-GB")}
                                        </span>
                                      )}
                                      {renderDueDateBadge(assignment.dueDate, isCompleted)}
                                      {isCompleted && attemptCount > 0 && (
                                        <details className="text-xs text-neutral-500 mt-2 select-none w-full">
                                          <summary className="cursor-pointer hover:text-black dark:hover:text-white transition font-mono font-semibold flex items-center gap-1">
                                            History ({attemptCount} attempt{attemptCount !== 1 ? "s" : ""})
                                          </summary>
                                          <ul className="mt-1.5 space-y-1.5 pl-3 border-l border-neutral-200 dark:border-neutral-800">
                                            {submissions.map((sub, sIdx) => {
                                              const subNum = attemptCount - sIdx;
                                              const subScore = sub.teacherScore !== null ? sub.teacherScore : sub.effectiveScore;
                                              return (
                                                <li key={sub.id} className="flex items-center justify-between text-[11px] font-mono py-0.5">
                                                  <span>
                                                    Attempt #{subNum} · {new Date(sub.completedAt).toLocaleDateString("en-GB")}
                                                  </span>
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-bold">{subScore}%</span>
                                                    <Link
                                                      href={`/submissions/${sub.id}`}
                                                      className="text-neutral-450 hover:text-black dark:hover:text-white underline"
                                                    >
                                                      Review
                                                    </Link>
                                                  </div>
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </details>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                                    {isCompleted ? (
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-900/50 px-2.5 py-1.5 rounded">
                                          <Trophy className="w-3.5 h-3.5 shrink-0" />
                                          <div className="flex flex-col leading-tight">
                                            <span className="font-bold">
                                              {bestEffective?.toFixed(0)}%
                                            </span>
                                            <span className="text-[9px] font-mono opacity-80">
                                              Best score
                                            </span>
                                          </div>
                                        </div>

                                        <Link
                                          href={`/assignments/${assignment.id}`}
                                          className="flex items-center gap-1.5 text-xs font-semibold uppercase font-mono border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-2 rounded transition text-neutral-700 dark:text-neutral-300"
                                          title={`Attempt #${attemptCount + 1} — score ×${attemptCount === 1 ? "75" : attemptCount === 2 ? "50" : "25"}%`}
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                          Redo
                                        </Link>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded">
                                          <AlertCircle className="w-3.5 h-3.5" />
                                          <span>Not Started</span>
                                        </div>
                                        <Link
                                          href={`/assignments/${assignment.id}`}
                                          className="flex items-center gap-1 bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded text-xs font-semibold font-mono uppercase hover:opacity-90 transition shadow cursor-pointer"
                                        >
                                          <Play className="w-3 h-3 fill-current" />
                                          Start
                                        </Link>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}

                {/* Standalone Assignments (no courseAssignmentId) */}
                {(() => {
                  const standaloneAssignments = classroom.assignments.filter(
                    (a) => !a.courseAssignmentId
                  );
                  return standaloneAssignments.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        Assignments
                      </h3>

                      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {standaloneAssignments.map((assignment) => {
                          const submissions = assignment.submissions;
                          const attemptCount = submissions.length;
                          const isCompleted = attemptCount > 0;

                          // Best effective score across all attempts
                          const bestEffective = isCompleted
                            ? Math.max(...submissions.map((s) => s.effectiveScore))
                            : null;

                          return (
                            <div
                              key={assignment.id}
                              className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="space-y-1.5">
                                <h4 className="font-bold text-base text-neutral-900 dark:text-neutral-200">
                                  {assignment.exercise.title}
                                </h4>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                                  <span className="font-mono uppercase text-[10px] bg-neutral-100 dark:bg-neutral-850 px-1.5 py-0.5 rounded">
                                    {getExerciseTypeLabel(assignment.exercise.type)}
                                  </span>
                                  {assignment.dueDate && (
                                    <span className="font-mono">
                                      Due: {new Date(assignment.dueDate).toLocaleDateString("en-GB")}
                                    </span>
                                  )}
                                  {renderDueDateBadge(assignment.dueDate, isCompleted)}
                                  {isCompleted && attemptCount > 0 && (
                                    <details className="text-xs text-neutral-500 mt-2 select-none w-full">
                                      <summary className="cursor-pointer hover:text-black dark:hover:text-white transition font-mono font-semibold flex items-center gap-1">
                                        History ({attemptCount} attempt{attemptCount !== 1 ? "s" : ""})
                                      </summary>
                                      <ul className="mt-1.5 space-y-1.5 pl-3 border-l border-neutral-200 dark:border-neutral-800">
                                        {submissions.map((sub, sIdx) => {
                                          const subNum = attemptCount - sIdx;
                                          const subScore = sub.teacherScore !== null ? sub.teacherScore : sub.effectiveScore;
                                          return (
                                            <li key={sub.id} className="flex items-center justify-between text-[11px] font-mono py-0.5">
                                              <span>
                                                Attempt #{subNum} · {new Date(sub.completedAt).toLocaleDateString("en-GB")}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <span className="font-bold">{subScore}%</span>
                                                <Link
                                                  href={`/submissions/${sub.id}`}
                                                  className="text-neutral-455 hover:text-black dark:hover:text-white underline"
                                                >
                                                  Review
                                                </Link>
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </details>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                                {isCompleted ? (
                                  <div className="flex items-center gap-3">
                                    {/* Best effective score badge */}
                                    <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-900/50 px-2.5 py-1.5 rounded">
                                      <Trophy className="w-3.5 h-3.5 shrink-0" />
                                      <div className="flex flex-col leading-tight">
                                        <span className="font-bold">
                                          {bestEffective?.toFixed(0)}%
                                        </span>
                                        <span className="text-[9px] font-mono opacity-80">
                                          Best score
                                        </span>
                                      </div>
                                    </div>

                                    {/* Redo button */}
                                    <Link
                                      href={`/assignments/${assignment.id}`}
                                      className="flex items-center gap-1.5 text-xs font-semibold uppercase font-mono border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-2 rounded transition text-neutral-700 dark:text-neutral-300"
                                      title={`Attempt #${attemptCount + 1} — score ×${attemptCount === 1 ? "75" : attemptCount === 2 ? "50" : "25"}%`}
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Redo
                                    </Link>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      <span>Not Started</span>
                                    </div>
                                    <Link
                                      href={`/assignments/${assignment.id}`}
                                      className="flex items-center gap-1 bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded text-xs font-semibold font-mono uppercase hover:opacity-90 transition shadow cursor-pointer"
                                    >
                                      <Play className="w-3 h-3 fill-current" />
                                      Start
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Empty state when there are neither course nor standalone assignments */}
                {classroom.courseAssignments.length === 0 &&
                  classroom.assignments.filter((a) => !a.courseAssignmentId).length === 0 && (
                    <p className="text-xs text-neutral-450 italic">
                      No exercises assigned yet. Check back later!
                    </p>
                  )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
