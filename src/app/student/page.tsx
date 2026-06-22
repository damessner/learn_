import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import JoinClassroomForm from "./JoinClassroomForm";
import { getExerciseFromDisk } from "@/lib/exercises";
import { getOrGenerateWordOfTheDay } from "@/lib/gemini";
import { WordOfTheDayCard } from "@/components/WordOfTheDayCard";
import StudentDashboardTabs, { TodoItem, CompletedItem, BadgeItem } from "./StudentDashboardTabs";

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role === "ADMIN") {
    redirect("/admin");
  }
  if (session.role === "TEACHER") {
    redirect("/teacher");
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const wordOfTheDay = await getOrGenerateWordOfTheDay(todayStr);

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

  // Fetch submissions that have generated memes
  const memeSubmissions = await prisma.submission.findMany({
    where: {
      studentId: session.userId,
      memeText: { not: null },
      memeImageUrl: { not: null },
    },
    include: {
      assignment: {
        include: {
          exercise: true,
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  const mappedMemeSubmissions = memeSubmissions.map((s) => ({
    id: s.id,
    completedAt: s.completedAt.toISOString(),
    memeText: s.memeText,
    memeImageUrl: s.memeImageUrl,
    assignment: {
      exercise: {
        title: s.assignment.exercise.title,
      },
    },
  }));

  // Fetch all submissions for streak and stats calculation
  const allSubmissions = await prisma.submission.findMany({
    where: { studentId: session.userId },
    orderBy: { completedAt: "desc" },
  });

  // Calculate active streak
  const calculateStreak = (submissions: { completedAt: Date }[]): number => {
    if (submissions.length === 0) return 0;
    
    // Format dates to local YYYY-MM-DD
    const uniqueDates = Array.from(
      new Set(
        submissions.map((s) => {
          const d = new Date(s.completedAt);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })
      )
    ).sort((a, b) => b.localeCompare(a));

    if (uniqueDates.length === 0) return 0;

    const getLocalDateStr = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };

    const todayStr = getLocalDateStr(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);

    const newestDate = uniqueDates[0];
    if (newestDate !== todayStr && newestDate !== yesterdayStr) {
      return 0;
    }

    let currentStreak = 0;
    const currentDate = new Date(newestDate);

    for (let i = 0; i < uniqueDates.length; i++) {
      const expectedStr = getLocalDateStr(currentDate);
      if (uniqueDates.includes(expectedStr)) {
        currentStreak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    return currentStreak;
  };

  const streak = calculateStreak(allSubmissions);

  // Calculate completed past 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const completedThisWeek = allSubmissions.filter((s) => s.completedAt >= sevenDaysAgo).length;

  // Best score
  const bestScore = allSubmissions.length > 0 ? Math.max(...allSubmissions.map((s) => s.effectiveScore)) : 0;

  // Total attempts
  const totalAttempts = allSubmissions.length;

  const statistics = {
    streak,
    completedThisWeek,
    bestScore,
    totalAttempts,
  };

  const earnedBadges: BadgeItem[] = [];

  const todoAssignments: TodoItem[] = [];
  const completedAssignments: CompletedItem[] = [];

  classroomsJoined.forEach((cs) => {
    const classroomName = cs.classroom.name;

    // Standalone assignments
    cs.classroom.assignments.forEach((as) => {
      const submissions = as.submissions;
      const attemptCount = submissions.length;
      const isCompleted = attemptCount > 0;

      const assignmentData = {
        id: as.id,
        dueDate: as.dueDate ? as.dueDate.toISOString() : null,
        createdAt: as.createdAt.toISOString(),
        exercise: {
          id: as.exercise.id,
          title: as.exercise.title,
          type: as.exercise.type,
          badgeName: as.exercise.badgeName,
          badgeEmoji: as.exercise.badgeEmoji,
        },
      };

      if (!isCompleted) {
        todoAssignments.push({
          assignment: assignmentData,
          classroomName,
        });
      } else {
        const exerciseContent = getExerciseFromDisk(as.exercise.id);
        const isSpacedRetrieval = !!(exerciseContent?.type === "worksheet" && exerciseContent.enhancements?.spacedRetrieval);
        let isSpacedReviewReady = false;
        if (isSpacedRetrieval && submissions.length > 0) {
          const latestCompleted = new Date(submissions[0].completedAt);
          const diffDays = (Date.now() - latestCompleted.getTime()) / (1000 * 60 * 60 * 24);
          isSpacedReviewReady = diffDays >= 3;
        }

        completedAssignments.push({
          assignment: assignmentData,
          classroomName,
          submissions: submissions.map((s) => ({
            id: s.id,
            score: s.score,
            effectiveScore: s.effectiveScore,
            attemptNumber: s.attemptNumber,
            completedAt: s.completedAt.toISOString(),
            teacherScore: s.teacherScore,
            memeText: s.memeText,
            memeImageUrl: s.memeImageUrl,
          })),
          attemptCount,
          bestEffective: Math.max(...submissions.map((s) => s.effectiveScore)),
          isSpacedReviewReady,
        });

        // Add badge if completed
        const name = as.exercise.badgeName || as.exercise.title;
        const emoji = as.exercise.badgeEmoji || "🏆";
        if (!earnedBadges.some((b) => b.exerciseId === as.exercise.id)) {
          earnedBadges.push({
            exerciseId: as.exercise.id,
            assignmentId: as.id,
            worksheetTitle: as.exercise.title,
            badgeName: name,
            badgeEmoji: emoji,
            completedAt: submissions[0].completedAt.toISOString(),
            score: Math.max(...submissions.map((s) => s.effectiveScore)),
          });
        }
      }
    });

    // Course assignments
    cs.classroom.courseAssignments.forEach((ca) => {
      ca.assignments.forEach((as) => {
        const submissions = as.submissions;
        const attemptCount = submissions.length;
        const isCompleted = attemptCount > 0;

        const assignmentData = {
          id: as.id,
          dueDate: as.dueDate ? as.dueDate.toISOString() : null,
          createdAt: as.createdAt.toISOString(),
          exercise: {
            id: as.exercise.id,
            title: as.exercise.title,
            type: as.exercise.type,
            badgeName: as.exercise.badgeName,
            badgeEmoji: as.exercise.badgeEmoji,
          },
        };

        if (!isCompleted) {
          todoAssignments.push({
            assignment: assignmentData,
            classroomName,
          });
        } else {
          const exerciseContent = getExerciseFromDisk(as.exercise.id);
          const isSpacedRetrieval = !!(exerciseContent?.type === "worksheet" && exerciseContent.enhancements?.spacedRetrieval);
          let isSpacedReviewReady = false;
          if (isSpacedRetrieval && submissions.length > 0) {
            const latestCompleted = new Date(submissions[0].completedAt);
            const diffDays = (Date.now() - latestCompleted.getTime()) / (1000 * 60 * 60 * 24);
            isSpacedReviewReady = diffDays >= 3;
          }

          completedAssignments.push({
            assignment: assignmentData,
            classroomName,
            submissions: submissions.map((s) => ({
              id: s.id,
              score: s.score,
              effectiveScore: s.effectiveScore,
              attemptNumber: s.attemptNumber,
              completedAt: s.completedAt.toISOString(),
              teacherScore: s.teacherScore,
              memeText: s.memeText,
              memeImageUrl: s.memeImageUrl,
            })),
            attemptCount,
            bestEffective: Math.max(...submissions.map((s) => s.effectiveScore)),
            isSpacedReviewReady,
          });

          // Add badge if completed
          const name = as.exercise.badgeName || as.exercise.title;
          const emoji = as.exercise.badgeEmoji || "🏆";
          if (!earnedBadges.some((b) => b.exerciseId === as.exercise.id)) {
            earnedBadges.push({
              exerciseId: as.exercise.id,
              assignmentId: as.id,
              worksheetTitle: as.exercise.title,
              badgeName: name,
              badgeEmoji: emoji,
              completedAt: submissions[0].completedAt.toISOString(),
              score: Math.max(...submissions.map((s) => s.effectiveScore)),
            });
          }
        }
      });
    });
  });

  // Sort todoAssignments by due date (items with null due dates can go last)
  todoAssignments.sort((a, b) => {
    if (!a.assignment.dueDate) return 1;
    if (!b.assignment.dueDate) return -1;
    return new Date(a.assignment.dueDate).getTime() - new Date(b.assignment.dueDate).getTime();
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

        {/* Aloys Socratic AI Assistant Callout */}
        <div className="border border-black dark:border-white p-6 bg-white dark:bg-black/20 rounded-none flex flex-col md:flex-row md:items-center md:justify-between gap-4 select-none">
          <div className="space-y-1">
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-[#ff2a2e] flex items-center">
              <span className="inline-block w-2 h-2 bg-[#ff2a2e] mr-2 animate-pulse" />
              Socratic Assistant: Dr. Aloys
            </h2>
            <p className="text-xs text-neutral-500 max-w-xl">
              Stuck on a concept? Consult Dr. Aloys, our school founder, for Socratic guidance. Ask questions, explore topic areas in Learning Mode, and solve interactive assessments.
            </p>
          </div>
          <Link
            href="/student/aloys"
            className="border border-black dark:border-white bg-black dark:bg-white text-white dark:text-black font-mono text-xs uppercase tracking-wider py-2.5 px-6 rounded-none text-center hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition duration-200 shrink-0"
          >
            Consult Aloys
          </Link>
        </div>

        {/* Word of the Day Card */}
        <WordOfTheDayCard data={wordOfTheDay} />

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
        )}        {/* Active Live Sessions */}
        {activeLiveSessions.length > 0 && (
          <div className="border border-neutral-200 dark:border-neutral-900 rounded-none bg-white/40 dark:bg-black/20 backdrop-blur-sm p-6 space-y-4">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff2a2e]"></span>
              </span>
              Active Live Quiz sessions ({activeLiveSessions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeLiveSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-5 border border-neutral-200 dark:border-neutral-900 bg-white/40 dark:bg-black/25 rounded-none shadow-sm flex items-center justify-between gap-4 hover:border-black dark:hover:border-white transition duration-200"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ff2a2e]">
                      PIN: {session.pin}
                    </span>
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {session.exercise.title}
                    </h3>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wide font-mono">
                      Status: <span className="font-semibold">{session.status}</span>
                    </p>
                  </div>
                  <Link
                    href={`/student/live-quiz/join?pin=${session.pin}`}
                    className="bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-mono font-bold text-xs px-4 py-2.5 rounded-none uppercase tracking-widest hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition duration-200 shrink-0"
                  >
                    Join Quiz &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Join Classroom Form */}
        <JoinClassroomForm />
        <StudentDashboardTabs
          todoAssignments={todoAssignments}
          completedAssignments={completedAssignments}
          earnedBadges={earnedBadges}
          memeSubmissions={mappedMemeSubmissions}
          classroomsJoined={classroomsJoined}
          statistics={statistics}
        />
      </main>
    </>
  );
}
