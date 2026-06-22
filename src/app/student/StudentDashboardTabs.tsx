"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  AlertCircle,
  Play,
  RotateCcw,
  Trophy,
  Award,
  Brain,
  Users,
  FolderOpen,
  Image as ImageIcon,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";

export interface AssignmentData {
  id: string;
  dueDate: string | null;
  createdAt: string;
  exercise: {
    id: string;
    title: string;
    type: string;
    badgeName: string | null;
    badgeEmoji: string | null;
  };
}

export interface SubmissionData {
  id: string;
  score: number;
  effectiveScore: number;
  attemptNumber: number;
  completedAt: string;
  teacherScore: number | null;
  memeText?: string | null;
  memeImageUrl?: string | null;
}

export interface TodoItem {
  assignment: AssignmentData;
  classroomName: string;
}

export interface CompletedItem {
  assignment: AssignmentData;
  classroomName: string;
  submissions: SubmissionData[];
  attemptCount: number;
  bestEffective: number;
  isSpacedReviewReady: boolean;
}

export interface BadgeItem {
  exerciseId: string;
  assignmentId: string;
  worksheetTitle: string;
  badgeName: string;
  badgeEmoji: string;
  completedAt: string;
  score: number;
}

export interface MemeSubmission {
  id: string;
  completedAt: string;
  memeText: string | null;
  memeImageUrl: string | null;
  assignment: {
    exercise: {
      title: string;
    };
  };
}

export interface ClassroomAssignmentSubmission {
  id: string;
  score: number;
  effectiveScore: number;
  attemptNumber: number;
  completedAt: string | Date;
  teacherScore: number | null;
  memeText?: string | null;
  memeImageUrl?: string | null;
}

export interface ClassroomExercise {
  id: string;
  title: string;
  type: string;
  badgeName: string | null;
  badgeEmoji: string | null;
}

export interface ClassroomAssignment {
  id: string;
  dueDate: string | Date | null;
  createdAt: string | Date;
  exerciseId: string;
  courseAssignmentId: string | null;
  exercise: ClassroomExercise;
  submissions: ClassroomAssignmentSubmission[];
}

export interface ClassroomCourse {
  id: string;
  title: string;
}

export interface ClassroomCourseAssignment {
  id: string;
  courseId: string;
  dueDate: string | Date | null;
  course: ClassroomCourse;
  assignments: ClassroomAssignment[];
}

export interface ClassroomTeacher {
  username: string;
}

export interface ClassroomData {
  id: string;
  name: string;
  teacherId: string;
  joinCode: string;
  teacher: ClassroomTeacher;
  assignments: ClassroomAssignment[];
  courseAssignments: ClassroomCourseAssignment[];
}

export interface ClassroomStudentRelation {
  classroom: ClassroomData;
}

export interface StudentDashboardTabsProps {
  todoAssignments: TodoItem[];
  completedAssignments: CompletedItem[];
  earnedBadges: BadgeItem[];
  memeSubmissions: MemeSubmission[];
  classroomsJoined: ClassroomStudentRelation[]; // Raw classrooms data for fallback Tab
  statistics: {
    streak: number;
    completedThisWeek: number;
    bestScore: number;
    totalAttempts: number;
  };
}

function renderDueDateBadge(dueDateStr: string | null) {
  if (!dueDateStr) return null;

  const due = new Date(dueDateStr);
  const now = new Date();
  
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const timeDiff = dueMidnight.getTime() - nowMidnight.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  if (timeDiff < 0) {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-red-50 text-red-755 dark:bg-red-950/20 dark:text-red-400 border border-red-200/50 dark:border-red-900/50">
        Overdue
      </span>
    );
  } else if (daysDiff <= 1) {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400 border border-amber-250/50 dark:border-amber-900/50 animate-pulse">
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
export default function StudentDashboardTabs({
  todoAssignments,
  completedAssignments,
  earnedBadges,
  memeSubmissions,
  classroomsJoined,
  statistics,
}: StudentDashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"todo" | "completed" | "memes" | "badges" | "classrooms">("todo");

  const handleBadgeClick = (badge: BadgeItem) => {
    if (
      confirm(
        `Do you want to redo the quiz "${badge.worksheetTitle}"? This will start a new, fresh attempt.`
      )
    ) {
      window.location.assign(`/assignments/${badge.assignmentId}?redo=true`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Statistics Dashboard Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Streak Card */}
        <div className="p-4 border border-neutral-250 dark:border-neutral-800 bg-white/40 dark:bg-black/25 rounded-md flex items-center justify-between gap-3 shadow-sm hover:scale-[1.02] transition duration-200">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold">
              Daily Streak
            </p>
            <p className="text-lg font-black font-mono">
              {statistics.streak} {statistics.streak === 1 ? "day" : "days"}
            </p>
          </div>
          <span className={`text-xl p-2 rounded-full ${statistics.streak > 0 ? "bg-amber-100 dark:bg-amber-955/40" : "bg-neutral-100 dark:bg-neutral-900"}`}>
            🔥
          </span>
        </div>

        {/* Weekly Progress Card */}
        <div className="p-4 border border-neutral-250 dark:border-neutral-800 bg-white/40 dark:bg-black/25 rounded-md flex items-center justify-between gap-3 shadow-sm hover:scale-[1.02] transition duration-200">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold">
              Completed (7d)
            </p>
            <p className="text-lg font-black font-mono">
              {statistics.completedThisWeek} {statistics.completedThisWeek === 1 ? "task" : "tasks"}
            </p>
          </div>
          <span className="text-xl p-2 bg-green-105 dark:bg-green-955/40 rounded-full">
            ✅
          </span>
        </div>

        {/* Best Score Card */}
        <div className="p-4 border border-neutral-250 dark:border-neutral-800 bg-white/40 dark:bg-black/25 rounded-md flex items-center justify-between gap-3 shadow-sm hover:scale-[1.02] transition duration-200">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold">
              Best Score
            </p>
            <p className="text-lg font-black font-mono">
              {statistics.bestScore.toFixed(0)}%
            </p>
          </div>
          <span className="text-xl p-2 bg-purple-100 dark:bg-purple-955/40 rounded-full">
            🏆
          </span>
        </div>

        {/* Total Attempts Card */}
        <div className="p-4 border border-neutral-250 dark:border-neutral-800 bg-white/40 dark:bg-black/25 rounded-md flex items-center justify-between gap-3 shadow-sm hover:scale-[1.02] transition duration-200">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 font-bold">
              Total Attempts
            </p>
            <p className="text-lg font-black font-mono">
              {statistics.totalAttempts} {statistics.totalAttempts === 1 ? "try" : "tries"}
            </p>
          </div>
          <span className="text-xl p-2 bg-blue-100 dark:bg-blue-955/40 rounded-full">
            🔁
          </span>
        </div>
      </div>
      {/* Premium Tabbed Navigation */}
      <div className="flex flex-wrap border border-neutral-350 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-955/20 p-1.5 gap-1.5 select-none rounded">
        <button
          onClick={() => setActiveTab("todo")}
          className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider transition rounded cursor-pointer ${
            activeTab === "todo"
              ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
              : "text-neutral-550 hover:text-black dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-900/35"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          To-Do ({todoAssignments.length})
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider transition rounded cursor-pointer ${
            activeTab === "completed"
              ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
              : "text-neutral-555 hover:text-black dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-900/35"
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          Completed ({completedAssignments.length})
        </button>

        <button
          onClick={() => setActiveTab("memes")}
          className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider transition rounded cursor-pointer ${
            activeTab === "memes"
              ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
              : "text-neutral-555 hover:text-black dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-900/35"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Memes ({memeSubmissions.length})
        </button>

        <button
          onClick={() => setActiveTab("badges")}
          className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider transition rounded cursor-pointer ${
            activeTab === "badges"
              ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
              : "text-neutral-555 hover:text-black dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-900/35"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          Badges ({earnedBadges.length})
        </button>

        <button
          onClick={() => setActiveTab("classrooms")}
          className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider transition rounded cursor-pointer ${
            activeTab === "classrooms"
              ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
              : "text-neutral-555 hover:text-black dark:hover:text-white hover:bg-neutral-200/50 dark:hover:bg-neutral-900/35"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Classrooms
        </button>
      </div>

      {/* Tab content area */}
      <div className="space-y-6">
        {/* TAB 1: TO-DO TASKS */}
        {activeTab === "todo" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-[#ff2a2e] flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-[#ff2a2e] rounded-none animate-pulse" />
              Pending Assignments ({todoAssignments.length})
            </h2>

            {todoAssignments.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-neutral-300 dark:border-neutral-800 rounded font-mono text-xs text-neutral-500 uppercase">
                🎉 No pending assignments! You are all caught up.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-900 border border-neutral-250 dark:border-neutral-850 rounded overflow-hidden">
                {todoAssignments.map(({ assignment, classroomName }) => (
                  <div
                    key={assignment.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 dark:bg-black/5 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono uppercase text-[9px] border border-neutral-250 dark:border-neutral-800 px-1.5 py-0.5 rounded text-neutral-500">
                          {getExerciseTypeLabel(assignment.exercise.type)}
                        </span>
                        <span className="font-mono text-[9px] uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 px-1.5 py-0.5 rounded">
                          {classroomName}
                        </span>
                        {renderDueDateBadge(assignment.dueDate)}
                      </div>
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-150">
                        {assignment.exercise.title}
                      </h3>
                      {assignment.dueDate && (
                        <p className="text-[10px] text-neutral-500 font-mono">
                          Due Date: {new Date(assignment.dueDate).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/assignments/${assignment.id}`}
                      className="inline-flex items-center justify-center gap-1.5 bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white px-5 py-2.5 rounded text-xs font-bold font-mono uppercase hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition duration-200 cursor-pointer self-start sm:self-center shrink-0"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Start Quiz
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMPLETED TASKS */}
        {activeTab === "completed" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-green-700 dark:text-green-400 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-none" />
              Completed Quizzes ({completedAssignments.length})
            </h2>

            {completedAssignments.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-neutral-300 dark:border-neutral-800 rounded font-mono text-xs text-neutral-500 uppercase">
                You haven&apos;t completed any quizzes yet.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-900 border border-neutral-250 dark:border-neutral-850 rounded overflow-hidden">
                {completedAssignments.map(({ assignment, classroomName, submissions, attemptCount, bestEffective, isSpacedReviewReady }) => (
                  <div
                    key={assignment.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 dark:bg-black/5"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono uppercase text-[9px] border border-neutral-250 dark:border-neutral-800 px-1.5 py-0.5 rounded text-neutral-500">
                          {getExerciseTypeLabel(assignment.exercise.type)}
                        </span>
                        <span className="font-mono text-[9px] uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 px-1.5 py-0.5 rounded">
                          {classroomName}
                        </span>
                        {isSpacedReviewReady && (
                          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50 animate-pulse">
                            <Brain className="w-3.5 h-3.5 shrink-0" />
                            Spaced Review Ready
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-150">
                        {assignment.exercise.title}
                      </h3>
                      
                      {/* Attempt History Accordion */}
                      <details className="text-xs text-neutral-500 mt-2 select-none w-full max-w-md">
                        <summary className="cursor-pointer hover:text-black dark:hover:text-white transition font-mono font-semibold flex items-center gap-1">
                          History ({attemptCount} attempt{attemptCount !== 1 ? "s" : ""})
                        </summary>
                        <ul className="mt-1.5 space-y-1.5 pl-3 border-l border-neutral-250 dark:border-neutral-800">
                          {submissions.map((sub, sIdx) => {
                            const subNum = attemptCount - sIdx;
                            const subScore = sub.teacherScore !== null ? sub.teacherScore : sub.effectiveScore;
                            return (
                              <li key={sub.id} className="flex items-center justify-between text-[11px] font-mono py-0.5">
                                <span>
                                  Attempt #{subNum} · {new Date(sub.completedAt).toLocaleDateString("en-GB")}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{subScore.toFixed(0)}%</span>
                                  <Link
                                    href={`/submissions/${sub.id}`}
                                    className="text-neutral-400 hover:text-black dark:hover:text-white underline inline-flex items-center gap-0.5"
                                  >
                                    Review
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </Link>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 border border-green-500 bg-green-500/5 px-3 py-2 rounded font-mono">
                        <Trophy className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col leading-tight">
                          <span className="font-bold text-sm">
                            {bestEffective.toFixed(0)}%
                          </span>
                          <span className="text-[9px] font-mono opacity-80 uppercase tracking-wider">
                            Best Score
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/assignments/${assignment.id}?redo=true`}
                        className={`flex items-center gap-1.5 text-[11px] font-bold uppercase font-mono border px-4 py-3 rounded transition duration-150 cursor-pointer ${
                          isSpacedReviewReady
                            ? "border-indigo-500 bg-indigo-500 hover:bg-indigo-600 text-white dark:border-indigo-555 dark:bg-indigo-650 dark:hover:bg-indigo-700"
                            : "border-neutral-350 dark:border-neutral-800 bg-transparent hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-neutral-700 dark:text-neutral-300"
                        }`}
                        title={`Attempt #${attemptCount + 1}`}
                      >
                        {isSpacedReviewReady ? (
                          <>
                            <Brain className="w-3.5 h-3.5" />
                            Review
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            Redo
                          </>
                        )}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MEME ACHIEVEMENTS */}
        {activeTab === "memes" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-indigo-500 rounded-none" />
              Meme achievements gallery ({memeSubmissions.length})
            </h2>

            {memeSubmissions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-neutral-300 dark:border-neutral-800 rounded font-mono text-xs text-neutral-500 uppercase">
                🏆 Score 75% or higher on worksheets to generate and unlock memes here!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {memeSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="border border-neutral-250 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900/50 shadow-sm flex flex-col hover:shadow-md transition duration-200 group"
                  >
                    {/* Real Meme Block (Image with Comic Text Overlay) */}
                    <div className="relative aspect-[4/3] w-full bg-neutral-100 dark:bg-neutral-950 overflow-hidden border-b border-neutral-200 dark:border-neutral-850">
                      <img
                        src={sub.memeImageUrl || "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop"}
                        alt="Achievement Meme Background"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
                        loading="lazy"
                      />
                      {/* Real Meme Impact-style Font Overlay */}
                      <div
                        className="absolute inset-0 bg-black/35 flex items-center justify-center p-4 text-center font-sans font-black text-white uppercase text-xs sm:text-sm tracking-wide leading-tight"
                        style={{
                          textShadow: "1.5px 1.5px 0 #000, -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 2px 2px 3px rgba(0,0,0,0.8)",
                        }}
                      >
                        {sub.memeText}
                      </div>
                    </div>

                    {/* Meme Info Footer */}
                    <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-neutral-850 dark:text-neutral-200 line-clamp-1">
                          {sub.assignment.exercise.title}
                        </h4>
                        <p className="text-[9px] font-mono text-neutral-455 uppercase">
                          Earned: {new Date(sub.completedAt).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                      <a
                        href={sub.memeImageUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-650 hover:underline flex items-center gap-0.5 self-end pt-1"
                      >
                        Open Image
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MY BADGES */}
        {activeTab === "badges" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-500" />
              My Earned Badges ({earnedBadges.length})
            </h2>

            {earnedBadges.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-neutral-300 dark:border-neutral-800 rounded font-mono text-xs text-neutral-500 uppercase">
                No badges earned yet. Complete quizzes to win badges!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {earnedBadges.map((badge) => (
                  <div
                    key={badge.exerciseId}
                    onClick={() => handleBadgeClick(badge)}
                    className="p-4 border border-purple-200/60 dark:border-purple-900/30 bg-purple-50/15 dark:bg-black/35 rounded shadow-sm flex flex-col items-center text-center justify-between gap-3 hover:scale-[1.02] hover:border-purple-400 dark:hover:border-purple-750 transition-all duration-200 cursor-pointer select-none group"
                    title="Click badge to redo this quiz"
                  >
                    <div className="w-12 h-12 flex items-center justify-center text-3xl bg-purple-100 dark:bg-purple-950/50 rounded-full border border-purple-200 dark:border-purple-900 shadow-inner group-hover:rotate-12 transition-transform duration-350">
                      {badge.badgeEmoji || "🏆"}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-xs text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-purple-700 dark:group-hover:text-purple-450 transition" title={badge.badgeName}>
                        {badge.badgeName}
                      </h3>
                      <p className="text-[9px] text-neutral-500 uppercase tracking-wide font-mono line-clamp-1" title={badge.worksheetTitle}>
                        {badge.worksheetTitle}
                      </p>
                    </div>
                    <span className="text-[9px] font-mono bg-purple-100/50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      Score: {badge.score.toFixed(0)}%
                    </span>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-450 group-hover:text-purple-650 opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Redo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CLASSROOMS (Grouped fallback browsing) */}
        {activeTab === "classrooms" && (
          <div className="space-y-8">
            {classroomsJoined.map(({ classroom }) => (
              <div
                key={classroom.id}
                className="border border-neutral-200 dark:border-neutral-900 rounded bg-white/40 dark:bg-black/20 backdrop-blur-sm p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-900 pb-3">
                  <div>
                    <h2 className="text-lg font-bold font-mono uppercase text-neutral-900 dark:text-neutral-150 flex items-center gap-2">
                      <Users className="w-4.5 h-4.5 text-neutral-500" />
                      {classroom.name}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Teacher: <span className="font-semibold">{classroom.teacher.username}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-mono uppercase border border-neutral-300 dark:border-neutral-800 px-2.5 py-0.5 rounded text-neutral-600 dark:text-neutral-400 self-start sm:self-center">
                    Join Code: {classroom.joinCode}
                  </span>
                </div>

                {/* Courses inside classroom */}
                {classroom.courseAssignments.length > 0 && (
                  <div className="space-y-3">
                    {classroom.courseAssignments.map((ca: ClassroomCourseAssignment) => (
                      <div
                        key={ca.id}
                        className="border border-neutral-200 dark:border-neutral-850 p-4 rounded bg-neutral-50/20 dark:bg-neutral-950/5 space-y-3"
                      >
                        <h3 className="text-xs font-bold uppercase font-mono tracking-wider flex items-center gap-2 text-neutral-800 dark:text-neutral-250">
                          <FolderOpen className="w-4 h-4 text-neutral-500" />
                          {ca.course.title}
                        </h3>
                        <div className="divide-y divide-neutral-200 dark:divide-neutral-900 border border-neutral-200 dark:border-neutral-900 rounded overflow-hidden">
                          {ca.assignments.map((assignment: ClassroomAssignment) => {
                            const isCompleted = assignment.submissions.length > 0;
                            const bestSub = isCompleted
                              ? Math.max(...assignment.submissions.map((s: ClassroomAssignmentSubmission) => s.effectiveScore))
                              : 0;
                            return (
                              <div
                                key={assignment.id}
                                className="py-2.5 px-3 flex items-center justify-between text-xs bg-white/10 dark:bg-black/10"
                              >
                                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                  {assignment.exercise.title}
                                </span>
                                <div className="flex items-center gap-3">
                                  {isCompleted ? (
                                    <span className="font-mono text-green-650 font-bold">
                                      ✓ {bestSub.toFixed(0)}%
                                    </span>
                                  ) : (
                                    <span className="font-mono text-amber-600 font-bold uppercase text-[9px] tracking-wider">
                                      Pending
                                    </span>
                                  )}
                                  <Link
                                    href={`/assignments/${assignment.id}${isCompleted ? "?redo=true" : ""}`}
                                    className="text-neutral-550 hover:underline flex items-center gap-0.5 font-bold uppercase font-mono text-[9px]"
                                  >
                                    {isCompleted ? "Redo" : "Start"}
                                    <ChevronRight className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Standalone assignments inside classroom */}
                {classroom.assignments.filter((a: ClassroomAssignment) => !a.courseAssignmentId).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                      Standalone Assignments
                    </h3>
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-900 border border-neutral-200 dark:border-neutral-900 rounded overflow-hidden">
                      {classroom.assignments
                        .filter((a: ClassroomAssignment) => !a.courseAssignmentId)
                        .map((assignment: ClassroomAssignment) => {
                          const isCompleted = assignment.submissions.length > 0;
                          const bestSub = isCompleted
                            ? Math.max(...assignment.submissions.map((s: ClassroomAssignmentSubmission) => s.effectiveScore))
                            : 0;
                          return (
                            <div
                              key={assignment.id}
                              className="py-2.5 px-3 flex items-center justify-between text-xs bg-white/10 dark:bg-black/10"
                            >
                              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                {assignment.exercise.title}
                              </span>
                              <div className="flex items-center gap-3">
                                {isCompleted ? (
                                  <span className="font-mono text-green-655 font-bold">
                                    ✓ {bestSub.toFixed(0)}%
                                  </span>
                                ) : (
                                  <span className="font-mono text-amber-600 font-bold uppercase text-[9px] tracking-wider">
                                    Pending
                                  </span>
                                )}
                                <Link
                                  href={`/assignments/${assignment.id}${isCompleted ? "?redo=true" : ""}`}
                                  className="text-neutral-550 hover:underline flex items-center gap-0.5 font-bold uppercase font-mono text-[9px]"
                                >
                                  {isCompleted ? "Redo" : "Start"}
                                  <ChevronRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
