"use client";

import React, { useState } from "react";
import { WIDGET_REGISTRY } from "@/components/widgets";
import { MediaEmbed } from "@/components/widgets/MediaEmbed";
import { getTaskMaxPoints } from "@/lib/points";
import { ArrowLeft, Clock, Award, User } from "lucide-react";
import Link from "next/link";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";
import { getAttemptMultiplier } from "@/lib/scoring";
import { overrideSubmissionGrade } from "@/lib/actions/submission";

interface WorksheetQuestionData {
  id: string;
  type: string;
  question?: string;
  options?: string[];
  correctOptionIndex?: number;
  text?: string;
  categories?: string[];
  items?: Array<{ id?: string; name: string; category: string }>;
  choices?: string[];
  statements?: Array<{ text: string; correctChoice: string }>;
  pairs?: Array<{ id: string; leftText?: string; leftMedia?: string; rightText: string }>;
  media?: string;
  hint?: string;
  keywords?: string[];
  elements?: string[];
  [key: string]: unknown;
}

interface WorksheetPageData {
  id: string;
  title?: string;
  questions: WorksheetQuestionData[];
}

interface SubmissionReviewPlayerProps {
  exercise?: Record<string, unknown>;
  exerciseJson?: string;
  savedAnswers?: Record<string, unknown> | null;
  savedAnswersJson?: string;
  assetsPath: string;
  studentName: string;
  completedAt: string;
  score: number;
  effectiveScore: number;
  attemptNumber: number;
  backUrl: string;
  isTeacher?: boolean;
  submissionId?: string;
  teacherScore?: number;
  feedback?: string;
  reviewedAt?: string;
}

function TeacherOverrideForm({
  submissionId,
  initialScore,
  initialFeedback,
}: {
  submissionId: string;
  initialScore: number;
  initialFeedback: string;
}) {
  const [score, setScore] = useState(initialScore);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await overrideSubmissionGrade(submissionId, score, feedback);
      if (res?.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Grade override and feedback saved!" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "An error occurred." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-1/4 space-y-1">
          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">
            Override Score (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            required
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white font-mono"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">
            Written Feedback / Comments
          </label>
          <input
            type="text"
            placeholder="e.g. Excellent work! Keep practicing spelling."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-1">
        {message && (
          <span className={`text-xs font-semibold ${
            message.type === "success" ? "text-green-600" : "text-red-650"
          }`}>
            {message.text}
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="ml-auto px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-black text-xs font-bold uppercase tracking-wider rounded transition disabled:opacity-50 font-mono"
        >
          {saving ? "Saving..." : "Save Assessment"}
        </button>
      </div>
    </form>
  );
}

export default function SubmissionReviewPlayer({
  exercise: initialExercise,
  exerciseJson,
  savedAnswers: initialSavedAnswers,
  savedAnswersJson,
  assetsPath,
  studentName,
  completedAt,
  score,
  effectiveScore,
  attemptNumber,
  backUrl,
  isTeacher = false,
  submissionId,
  teacherScore,
  feedback,
  reviewedAt,
}: SubmissionReviewPlayerProps) {
  const exercise = React.useMemo(() => {
    if (exerciseJson) {
      try {
        return JSON.parse(exerciseJson);
      } catch (e) {
        console.error("Failed to parse exerciseJson:", e);
      }
    }
    return initialExercise;
  }, [initialExercise, exerciseJson]);

  const savedAnswers = React.useMemo(() => {
    if (savedAnswersJson) {
      try {
        return JSON.parse(savedAnswersJson);
      } catch (e) {
        console.error("Failed to parse savedAnswersJson:", e);
      }
    }
    return initialSavedAnswers;
  }, [initialSavedAnswers, savedAnswersJson]);

  const Widget = exercise.type !== "worksheet" && exercise.type !== "image-hotspot-quiz" && exercise.type !== "interactive-reading"
    ? WIDGET_REGISTRY[exercise.type as keyof typeof WIDGET_REGISTRY]
    : null;

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between border-b pb-4">
        <Link
          href={backUrl}
          className="flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <span className="text-xs font-semibold uppercase tracking-widest font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-700">
          Read-Only Review
        </span>
      </div>

      {/* Submission Meta Details */}
      <div className="p-5 border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl font-extrabold font-mono uppercase text-neutral-800 dark:text-neutral-200">
            Review: {exercise.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              Student: <strong>{studentName}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Submitted: {new Date(completedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border px-4 py-2.5 rounded shadow-sm self-start md:self-center shrink-0">
          <Award className="w-5 h-5 text-neutral-400" />
          <div>
            <span className="text-[10px] text-neutral-555 font-semibold uppercase tracking-wider block font-mono">
              Effective Score
            </span>
            <span className="text-lg font-black font-mono text-neutral-900 dark:text-neutral-100 font-mono">
              {teacherScore !== undefined ? `${teacherScore}%` : `${effectiveScore.toFixed(0)}%`}
            </span>
            {teacherScore !== undefined && (
              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 block leading-tight font-bold">
                ✓ Overridden (Auto: {effectiveScore.toFixed(0)}%)
              </span>
            )}
            {attemptNumber > 1 && teacherScore === undefined && (
              <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 block leading-tight">
                Attempt #{attemptNumber} · Raw {score.toFixed(0)}% × {Math.round(getAttemptMultiplier(attemptNumber) * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Teacher Override & Feedback Panel */}
      {(isTeacher || feedback || teacherScore !== undefined) && (
        <div className="p-5 border border-amber-300 dark:border-neutral-800 rounded bg-amber-500/5 dark:bg-amber-950/5 space-y-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <Award className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-xs uppercase font-mono tracking-wider">
              {isTeacher ? "Teacher Assessment & Override" : "Teacher Feedback"}
            </h3>
          </div>

          {isTeacher ? (
            <TeacherOverrideForm
              submissionId={submissionId!}
              initialScore={teacherScore ?? Math.round(effectiveScore)}
              initialFeedback={feedback ?? ""}
            />
          ) : (
            <div className="space-y-2 text-sm">
              {teacherScore !== undefined && (
                <p className="text-neutral-700 dark:text-neutral-300">
                  <strong>Graded Score:</strong>{" "}
                  <span className="font-mono bg-white dark:bg-neutral-900 px-2 py-0.5 border rounded">
                    {teacherScore}%
                  </span>{" "}
                  (auto-graded: {effectiveScore.toFixed(0)}%)
                </p>
              )}
              {feedback && (
                <div className="text-neutral-700 dark:text-neutral-300">
                  <strong>Comments:</strong>
                  <p className="mt-1 p-3 bg-white dark:bg-neutral-900 border rounded italic">
                    &ldquo;{feedback}&rdquo;
                  </p>
                </div>
              )}
              {reviewedAt && (
                <p className="text-[10px] text-neutral-500 font-mono">
                  Reviewed: {new Date(reviewedAt).toLocaleString("en-GB")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Read-Only Widget rendering */}
      {exercise.type === "worksheet" ? (
        <div className="space-y-8">
          {(() => {
            const pages: WorksheetPageData[] = exercise.pages && exercise.pages.length > 0
              ? (exercise.pages as WorksheetPageData[])
              : [
                  {
                    id: "legacy",
                    title: "",
                    questions: (exercise.questions as WorksheetQuestionData[]) || [],
                  },
                ];

            let globalQIdx = 0;

            return pages.map((page, pIdx: number) => (
              <div key={page.id || pIdx} className="space-y-6">
                {page.title && pages.length > 1 && (
                  <div className="p-4 border rounded border-neutral-350 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-955/10">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-655 dark:text-neutral-300">
                      {page.title}
                    </h3>
                  </div>
                )}
                <div className={pages.length > 1 ? "space-y-6 pl-4 border-l-2 border-dashed border-neutral-200 dark:border-neutral-800" : "space-y-6"}>
                  {page.questions.map((q) => {
                    const ChildWidget = WIDGET_REGISTRY[q.type as keyof typeof WIDGET_REGISTRY];
                    if (!ChildWidget) return null;

                    const currentQIdx = globalQIdx;
                    globalQIdx++;

                    // Adapt on the fly
                    const adaptedConfig: Record<string, unknown> = {
                      ...q,
                      id: q.id,
                      title: q.question || `${q.type} task`,
                      type: q.type,
                    };

                    if (q.type === "multiple-choice") {
                      adaptedConfig.questions = [
                        {
                          id: q.id,
                          question: q.question || "",
                          options: q.options || [],
                          correctOptionIndex: q.correctOptionIndex ?? 0,
                        },
                      ];
                    } else if (q.type === "gap-fill" || q.type === "drag-drop") {
                      adaptedConfig.text = q.text || "";
                    } else if (q.type === "categorization") {
                      adaptedConfig.categories = q.categories || [];
                      adaptedConfig.items = q.items || [];
                    } else if (q.type === "clickable-choice") {
                      adaptedConfig.choices = q.choices || [];
                      adaptedConfig.statements = q.statements || [];
                    } else if (q.type === "matching") {
                      adaptedConfig.pairs = q.pairs || [];
                    } else if (q.type === "media") {
                      adaptedConfig.media = q.media || "";
                    } else if (q.type === "instruction") {
                      adaptedConfig.text = q.text || "";
                    } else if (q.type === "open-question") {
                      adaptedConfig.question = q.question || "";
                      adaptedConfig.keywords = q.keywords || [];
                    } else if (q.type === "ordering") {
                      adaptedConfig.question = q.question || "";
                      adaptedConfig.elements = q.elements || [];
                    }

                    return (
                      <div
                        key={q.id}
                        className="p-6 border border-neutral-350 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm space-y-4"
                      >
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-350">
                              Question {currentQIdx + 1}
                            </span>
                            <span className="text-[10px] font-mono uppercase text-neutral-450">
                              {getExerciseTypeLabel(q.type)}
                            </span>
                          </div>

                          {/* Task Points Display */}
                          {q.type !== "media" && q.type !== "instruction" && (
                            <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
                              Max Points: {getTaskMaxPoints(q)}
                            </span>
                          )}
                        </div>

                        {q.media && q.type !== "media" && (
                          <div className="max-w-md my-2">
                            <MediaEmbed src={q.media} assetsPath={assetsPath} />
                          </div>
                        )}

                        <ChildWidget
                          config={adaptedConfig}
                          assetsPath={assetsPath}
                          savedState={savedAnswers?.[q.id]}
                          onChange={() => {}}
                          isReadOnly={true}
                        />

                        {/* Hint disclosure */}
                        {q.hint && (
                          <div className="mt-2 text-xs pt-2 border-t border-neutral-100 dark:border-neutral-850">
                            <details className="cursor-pointer text-neutral-550 hover:text-black dark:hover:text-white transition">
                              <summary className="font-semibold select-none font-mono">💡 View Hint</summary>
                              <div className="mt-1.5 p-2 bg-amber-50/20 dark:bg-amber-955/10 border border-amber-250/30 rounded font-medium text-amber-800 dark:text-amber-305 leading-relaxed">
                                {q.hint}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      ) : exercise.type === "image-hotspot-quiz" ? (
        <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
          {WIDGET_REGISTRY["image-hotspot-quiz"] ? (
            React.createElement(WIDGET_REGISTRY["image-hotspot-quiz"], {
              config: exercise,
              assetsPath,
              savedState: savedAnswers,
              onChange: () => {},
              isReadOnly: true,
            })
          ) : (
            <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-950/10 border-red-350 text-red-700">
              Hotspot Quiz widget not registered.
            </div>
          )}
        </div>
      ) : exercise.type === "interactive-reading" ? (
        <div className="p-6 border border-neutral-350 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
          {WIDGET_REGISTRY["interactive-reading"] ? (
            React.createElement(WIDGET_REGISTRY["interactive-reading"], {
              config: exercise,
              assetsPath,
              savedState: savedAnswers,
              onChange: () => {},
              isReadOnly: true,
            })
          ) : (
            <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-950/10 border-red-350 text-red-700">
              Interactive Reading widget not registered.
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
          {Widget ? (
            <Widget
              config={exercise}
              assetsPath={assetsPath}
              savedState={savedAnswers}
              onChange={() => {}} // No-op in read-only mode
              isReadOnly={true}
            />
          ) : (
            <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-950/10 border-red-350 text-red-700">
              Widget type not registered.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
