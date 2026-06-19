"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { submitAssignment } from "@/lib/actions/submission";
import { WIDGET_REGISTRY } from "@/components/widgets";
import type { ExerciseData } from "@/lib/exercises";
import { ArrowLeft, Check, AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import { MediaEmbed } from "@/components/widgets/MediaEmbed";
import Link from "next/link";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";
import WidgetErrorBoundary from "@/components/widgets/WidgetErrorBoundary";
import { getTaskMaxPoints } from "@/lib/points";
export { getTaskMaxPoints } from "@/lib/points";

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

interface AssignmentPlayerProps {
  assignmentId: string;
  exercise?: ExerciseData;
  exerciseJson?: string;
  assetsPath: string;
  savedAnswers?: Record<string, unknown> | null;
  savedAnswersJson?: string;
  role: "STUDENT" | "TEACHER";
  attemptNumber?: number;      // 1-indexed: what this submission will be recorded as
  multiplier?: number;         // score multiplier for this attempt (1.0, 0.75, 0.5, 0.25)
  priorAttemptCount?: number;  // how many submissions already exist
  dueDate?: string;
}

interface WorksheetQuestionRowProps {
  q: WorksheetQuestionData;
  index: number;
  ChildWidget: React.ComponentType<{
    config: Record<string, unknown>;
    assetsPath: string;
    savedState: unknown;
    onChange: (state: unknown, complete: boolean, score: number) => void;
  }>;
  assetsPath: string;
  savedAnswers: Record<string, unknown> | null | undefined;
  handleChildChange: (qId: string, state: unknown, complete: boolean, score: number) => void;
}

const WorksheetQuestionRow: React.FC<WorksheetQuestionRowProps> = ({
  q,
  index,
  ChildWidget,
  assetsPath,
  savedAnswers,
  handleChildChange,
}) => {
  const handleWidgetChange = useCallback((state: unknown, complete: boolean, score: number) => {
    handleChildChange(q.id, state, complete, score);
  }, [q.id, handleChildChange]);

  const adaptedConfig = useMemo(() => {
    const base: Record<string, unknown> = {
      ...q,
      id: q.id,
      title: q.question || `${q.type} task`,
      type: q.type,
    };

    if (q.type === "multiple-choice") {
      base.questions = [
        {
          id: q.id,
          question: q.question || "",
          options: q.options || [],
          correctOptionIndex: q.correctOptionIndex ?? 0,
        },
      ];
    } else if (q.type === "gap-fill" || q.type === "drag-drop") {
      base.text = q.text || "";
    } else if (q.type === "categorization") {
      base.categories = q.categories || [];
      base.items = q.items || [];
    } else if (q.type === "clickable-choice") {
      base.choices = q.choices || [];
      base.statements = q.statements || [];
    } else if (q.type === "matching") {
      base.pairs = q.pairs || [];
    } else if (q.type === "media") {
      base.media = q.media || "";
    } else if (q.type === "instruction") {
      base.text = q.text || "";
    } else if (q.type === "open-question") {
      base.question = q.question || "";
      base.keywords = q.keywords || [];
    } else if (q.type === "ordering") {
      base.question = q.question || "";
      base.elements = q.elements || [];
    }
    return base;
  }, [q]);

  return (
    <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-350">
            Question {index + 1}
          </span>
          <span className="text-[10px] font-mono uppercase text-neutral-450">
            {getExerciseTypeLabel(q.type)}
          </span>
        </div>

        {q.type !== "media" && q.type !== "instruction" && (
          <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
            Points: {getTaskMaxPoints(q)}
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
        onChange={handleWidgetChange}
      />

      {/* Hint disclosure */}
      {q.hint && (
        <div className="mt-2 text-xs pt-2 border-t border-neutral-100 dark:border-neutral-850">
          <details className="cursor-pointer text-neutral-550 hover:text-black dark:hover:text-white transition">
            <summary className="font-semibold select-none font-mono">💡 Need a hint?</summary>
            <div className="mt-1.5 p-2 bg-amber-50/20 dark:bg-amber-950/10 border border-amber-250/30 rounded font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
              {q.hint}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default function AssignmentPlayer({
  assignmentId,
  exercise: initialExercise,
  exerciseJson,
  assetsPath,
  savedAnswers: initialSavedAnswers,
  savedAnswersJson,
  role,
  attemptNumber = 1,
  multiplier = 1.0,
  priorAttemptCount = 0,
  dueDate,
}: AssignmentPlayerProps) {
  const router = useRouter();

  const exercise = useMemo(() => {
    if (exerciseJson) {
      try {
        return JSON.parse(exerciseJson);
      } catch (e) {
        console.error("Failed to parse exerciseJson:", e);
      }
    }
    return initialExercise!;
  }, [initialExercise, exerciseJson]);

  const savedAnswers = useMemo(() => {
    if (savedAnswersJson) {
      try {
        return JSON.parse(savedAnswersJson);
      } catch (e) {
        console.error("Failed to parse savedAnswersJson:", e);
      }
    }
    return initialSavedAnswers;
  }, [initialSavedAnswers, savedAnswersJson]);

  const isPastDue = useMemo(() => {
    if (!dueDate) return false;
    return new Date() > new Date(dueDate);
  }, [dueDate]);

  // Widget state variables
  const [widgetState, setWidgetState] = useState<Record<string, unknown> | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`draft_${assignmentId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore parse errors
        }
      }
    }
    return savedAnswers || (exercise.type === "worksheet" ? {} : null);
  });
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState(0);

  React.useEffect(() => {
    if (typeof window !== "undefined" && role === "STUDENT" && widgetState) {
      localStorage.setItem(`draft_${assignmentId}`, JSON.stringify(widgetState));
    }
  }, [widgetState, assignmentId, role]);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [submitEffectiveScore, setSubmitEffectiveScore] = useState<number | null>(null);
  const [submitAttemptNumber, setSubmitAttemptNumber] = useState<number>(attemptNumber);
  const [submitMultiplier, setSubmitMultiplier] = useState<number>(multiplier);
  const [error, setError] = useState<string | null>(null);

  const Widget = exercise.type !== "worksheet" && exercise.type !== "image-hotspot-quiz" && exercise.type !== "interactive-reading"
    ? WIDGET_REGISTRY[exercise.type as keyof typeof WIDGET_REGISTRY]
    : null;

  const handleWidgetChange = useCallback((state: unknown, complete: boolean, currentScore: number) => {
    setWidgetState(state as Record<string, unknown> | null);
    setIsComplete(complete);
    setScore(currentScore);
  }, []);

  const flatQuestions = useMemo(() => {
    if (exercise.type === "worksheet") {
      if (Array.isArray(exercise.pages)) {
        return exercise.pages.flatMap((p: { questions?: WorksheetQuestionData[] }) => p.questions || []);
      }
      return (exercise.questions as WorksheetQuestionData[]) || [];
    }
    return [];
  }, [exercise]);

  const pages = useMemo(() => {
    if (exercise.type === "worksheet" && Array.isArray(exercise.pages) && exercise.pages.length > 0) {
      return exercise.pages as Array<{ id: string; title?: string; questions: WorksheetQuestionData[] }>;
    }
    return [
      {
        id: "legacy-page-1",
        title: "Worksheet",
        questions: (exercise.questions as WorksheetQuestionData[]) || [],
      },
    ];
  }, [exercise]);

  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [gateAlertVisible, setGateAlertVisible] = useState(false);
  const currentPage = pages[currentPageIdx];

  const [childCompletions, setChildCompletions] = useState<Record<string, boolean>>({});
  const [childScores, setChildScores] = useState<Record<string, number>>({});

  const isCurrentPageComplete = useMemo(() => {
    if (!currentPage?.questions) return true;
    return currentPage.questions.every((q: WorksheetQuestionData) => {
      if (q.type === "media" || q.type === "instruction") return true;
      return childCompletions[q.id];
    });
  }, [currentPage, childCompletions]);

  const currentPageScore = useMemo(() => {
    if (!currentPage?.questions) return 0;
    let pageMax = 0;
    let pageEarned = 0;
    currentPage.questions.forEach((q: WorksheetQuestionData) => {
      const maxPts = getTaskMaxPoints(q);
      const childPct = childScores[q.id] ?? 0;
      pageMax += maxPts;
      pageEarned += (childPct / 100) * maxPts;
    });
    return pageMax > 0 ? (pageEarned / pageMax) * 100 : 0;
  }, [currentPage, childScores]);

  const handleNextPage = () => {
    if (!isCurrentPageComplete) {
      alert("Please complete all tasks on this page first.");
      return;
    }
    if (exercise.enforceGate && currentPageScore < (exercise.gateRequiredScore ?? 75)) {
      setGateAlertVisible(true);
      return;
    }
    setGateAlertVisible(false);
    setCurrentPageIdx((prev) => Math.min(pages.length - 1, prev + 1));
  };

  const handlePrevPage = () => {
    setGateAlertVisible(false);
    setCurrentPageIdx((prev) => Math.max(0, prev - 1));
  };

  const resetCurrentPage = () => {
    if (!currentPage?.questions) return;
    setWidgetState((prev: Record<string, unknown> | null) => {
      const next = { ...(prev || {}) };
      currentPage.questions.forEach((q: WorksheetQuestionData) => {
        delete next[q.id];
      });
      return next;
    });
    setChildCompletions((prev: Record<string, boolean>) => {
      const next = { ...prev };
      currentPage.questions.forEach((q: WorksheetQuestionData) => {
        next[q.id] = false;
      });
      return next;
    });
    setChildScores((prev: Record<string, number>) => {
      const next = { ...prev };
      currentPage.questions.forEach((q: WorksheetQuestionData) => {
        next[q.id] = 0;
      });
      return next;
    });
    setGateAlertVisible(false);
  };

  const handleChildChange = useCallback((qId: string, childState: unknown, childComplete: boolean, childScore: number) => {
    setGateAlertVisible(false);
    setWidgetState((prev: Record<string, unknown> | null) => ({ ...(prev || {}), [qId]: childState }));

    setChildCompletions((prev) => {
      const next = { ...prev, [qId]: childComplete };
      if (exercise.type === "worksheet") {
        const allComplete = flatQuestions.every((q: WorksheetQuestionData) => {
          if (q.type === "media" || q.type === "instruction") return true;
          return next[q.id];
        });
        setIsComplete(allComplete);
      }
      return next;
    });

    setChildScores((prev) => {
      const next = { ...prev, [qId]: childScore };
      if (exercise.type === "worksheet") {
        let totalMax = 0;
        let totalEarned = 0;
        flatQuestions.forEach((q: WorksheetQuestionData) => {
          const maxPts = getTaskMaxPoints(q);
          const childPct = next[q.id] ?? 0;
          totalMax += maxPts;
          totalEarned += (childPct / 100) * maxPts;
        });
        const avgScore = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
        setScore(avgScore);
      }
      return next;
    });
  }, [flatQuestions, exercise.type]);

  const handleSubmit = async () => {
    if (role === "TEACHER") {
      router.push("/teacher");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await submitAssignment(assignmentId, widgetState, score);
      if (res?.error) {
        setError(res.error);
      } else {
        if (typeof window !== "undefined") {
          localStorage.removeItem(`draft_${assignmentId}`);
        }
        setSubmitted(true);
        setSubmitScore(res?.score ?? score);
        setSubmitEffectiveScore(res?.effectiveScore ?? score * multiplier);
        setSubmitAttemptNumber(res?.attemptNumber ?? attemptNumber);
        setSubmitMultiplier(res?.multiplier ?? multiplier);
        router.refresh();
      }
    } catch {
      setError("An error occurred during submission.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    const effectivePct = submitEffectiveScore?.toFixed(0) ?? "0";
    const rawPct = submitScore?.toFixed(0) ?? "0";
    const pct = Math.round(submitMultiplier * 100);
    const isFullMarks = submitMultiplier === 1.0;

    return (
      <div className="max-w-md mx-auto border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 p-8 shadow text-center space-y-6">
        <div className="w-16 h-16 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-200">
          <Check className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold font-mono uppercase">Submitted!</h2>
          <p className="text-sm text-neutral-500">
            Attempt #{submitAttemptNumber} recorded.
          </p>
        </div>

        {/* Score card */}
        <div className="space-y-3">
          <div className="py-3 px-6 bg-neutral-50 dark:bg-neutral-950 rounded border inline-block">
            <span className="text-xs text-neutral-550 block font-semibold uppercase tracking-wider font-mono">
              Effective Score
            </span>
            <span className="text-3xl font-extrabold font-mono text-neutral-900 dark:text-neutral-100">
              {effectivePct}%
            </span>
          </div>

          {!isFullMarks && (
            <div className="text-xs font-mono text-neutral-500 space-y-1">
              <p>
                Raw score: <strong>{rawPct}%</strong> × {pct}% multiplier
                <span className="ml-1 text-amber-600 dark:text-amber-400">(Attempt #{submitAttemptNumber})</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/student"
            className="inline-block bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:opacity-90 transition shadow"
          >
            Back to Dashboard
          </Link>
          <Link
            href={`/assignments/${assignmentId}`}
            className="inline-block border border-neutral-350 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            Try Again (fewer points)
          </Link>
        </div>
      </div>
    );
  }

  if (!Widget && exercise.type !== "worksheet" && exercise.type !== "image-hotspot-quiz" && exercise.type !== "interactive-reading") {
    return (
      <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-950/10 border-red-350 text-red-700">
        Unknown exercise widget type: <strong>{exercise.type}</strong>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <Link
          href={role === "TEACHER" ? "/teacher" : "/student"}
          className="flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-3">
          {role === "STUDENT" && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-wider">
              ✓ Autosaved draft
            </span>
          )}
          {role === "TEACHER" ? (
            <span className="text-xs font-semibold uppercase tracking-widest font-mono bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded">
              Teacher Preview Mode
            </span>
          ) : priorAttemptCount > 0 ? (
            <span className="text-xs font-semibold font-mono uppercase tracking-widest bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
              Attempt #{attemptNumber} · Score ×{Math.round(multiplier * 100)}%
            </span>
          ) : null}
        </div>
      </div>

      {/* Title bl      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-150">
          {exercise.title}
        </h1>
        <span className="inline-block text-[10px] font-mono uppercase tracking-widest bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 px-2 py-0.5 rounded">
          {getExerciseTypeLabel(exercise.type)}
        </span>
      </div>

      {isPastDue && role === "STUDENT" && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-955/20 text-red-750 dark:text-red-350 border border-red-200 dark:border-red-900 rounded font-mono text-xs font-bold leading-normal">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
          <span>This assignment is locked because the due date ({new Date(dueDate!).toLocaleDateString("en-GB")}) has passed. You cannot modify your answers or submit attempts.</span>
        </div>
      )}

      {/* Widget Container */}
      <div className={isPastDue && role === "STUDENT" ? "pointer-events-none opacity-70" : ""}>
        {exercise.type === "worksheet" ? (
          <div className="space-y-8">
            {pages.length > 1 && (
              <div className="p-4 border rounded border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-955/10 flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                  {currentPage.title || `Page ${currentPageIdx + 1}`}
                </span>
                <span className="text-[11px] font-mono text-neutral-500">
                  Page {currentPageIdx + 1} of {pages.length}
                </span>
              </div>
            )}

            {(currentPage.questions as WorksheetQuestionData[]).map((q, index: number) => {
              const ChildWidget = WIDGET_REGISTRY[q.type as keyof typeof WIDGET_REGISTRY];
              if (!ChildWidget) return null;

              return (
                <WidgetErrorBoundary key={q.id}>
                  <WorksheetQuestionRow
                    q={q}
                    index={index}
                    ChildWidget={ChildWidget}
                    assetsPath={assetsPath}
                    savedAnswers={savedAnswers}
                    handleChildChange={handleChildChange}
                  />
                </WidgetErrorBoundary>
              );
            })}
          </div>
        ) : exercise.type === "image-hotspot-quiz" ? (
          <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
            <WidgetErrorBoundary>
              {WIDGET_REGISTRY["image-hotspot-quiz"] ? (
                React.createElement(WIDGET_REGISTRY["image-hotspot-quiz"], {
                  config: exercise,
                  assetsPath,
                  savedState: savedAnswers,
                  onChange: handleWidgetChange,
                })
              ) : (
                <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-955/10 border-red-350 text-red-700">
                  Hotspot Quiz widget not registered.
                </div>
              )}
            </WidgetErrorBoundary>
          </div>
        ) : exercise.type === "interactive-reading" ? (
          <div className="p-6 border border-neutral-350 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
            <WidgetErrorBoundary>
              {WIDGET_REGISTRY["interactive-reading"] ? (
                React.createElement(WIDGET_REGISTRY["interactive-reading"], {
                  config: exercise,
                  assetsPath,
                  savedState: savedAnswers,
                  onChange: handleWidgetChange,
                })
              ) : (
                <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-955/10 border-red-350 text-red-700">
                  Interactive Reading widget not registered.
                </div>
              )}
            </WidgetErrorBoundary>
          </div>
        ) : (
          <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
            <WidgetErrorBoundary>
              {Widget ? (
                <Widget
                  config={exercise}
                  assetsPath={assetsPath}
                  savedState={savedAnswers}
                  onChange={handleWidgetChange}
                />
              ) : (
                <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-955/10 border-red-350 text-red-700">
                  Widget type not registered.
                </div>
              )}
            </WidgetErrorBoundary>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-955/20 border border-red-300 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-350">
          {error}
        </div>
      )}

      {/* Gate Alert Warning Banner */}
      {exercise.type === "worksheet" && gateAlertVisible && (
        <div className="p-4 border rounded border-red-350 bg-red-50/20 text-red-750 dark:text-red-350 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="space-y-1">
            <p className="text-xs font-bold font-mono uppercase tracking-wider">⚠️ Score Threshold Not Reached</p>
            <p className="text-xs">
              You scored <strong>{currentPageScore.toFixed(0)}%</strong>, but you need at least{" "}
              <strong>{exercise.gateRequiredScore ?? 75}%</strong> to continue. Please review your answers or redo this page to try again.
            </p>
          </div>
          <button
            type="button"
            onClick={resetCurrentPage}
            className="bg-red-650 hover:bg-red-700 text-white font-mono font-bold text-[10px] uppercase px-3.5 py-2 rounded-lg cursor-pointer transition self-start sm:self-auto shrink-0 shadow-sm flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redo Page
          </button>
        </div>
      )}

      {/* Submission Footer bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-955/40">
        <div className="flex flex-col gap-1">
          {isPastDue && role === "STUDENT" ? (
            <span className="text-xs text-red-650 dark:text-red-400 flex items-center gap-1 font-mono font-bold">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Submission locked
            </span>
          ) : exercise.type === "worksheet" && pages.length > 1 ? (
            currentPageIdx === pages.length - 1 ? (
              isComplete ? (
                <span className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-1 font-mono">
                  <Check className="w-4 h-4 text-green-500" /> Ready to submit
                </span>
              ) : (
                <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Progress: Incomplete
                </span>
              )
            ) : (
              isCurrentPageComplete ? (
                <span className="text-xs text-neutral-650 dark:text-neutral-400 flex items-center gap-1 font-mono">
                  <Check className="w-4 h-4 text-green-500" /> Page complete {exercise.enforceGate && `(Score: ${currentPageScore.toFixed(0)}% / Target: ${exercise.gateRequiredScore ?? 75}%)`}
                </span>
              ) : (
                <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Page incomplete
                </span>
              )
            )
          ) : isComplete ? (
            <span className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-1 font-mono">
              <Check className="w-4 h-4 text-green-500" /> Ready to submit
            </span>
          ) : (
            <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Progress: Incomplete
            </span>
          )}
          {role === "STUDENT" && priorAttemptCount > 0 && !isPastDue && (
            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
              Attempt #{attemptNumber}: score multiplied by ×{Math.round(multiplier * 100)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {exercise.type === "worksheet" && pages.length > 1 && currentPageIdx > 0 && (
            <button
              onClick={handlePrevPage}
              disabled={loading}
              className="border border-neutral-350 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold font-mono text-xs px-5 py-3 rounded uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              Previous Page
            </button>
          )}

          {exercise.type === "worksheet" && pages.length > 1 && currentPageIdx < pages.length - 1 ? (
            <button
              onClick={handleNextPage}
              disabled={loading || (isPastDue && role === "STUDENT")}
              className="bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow flex items-center gap-1.5"
            >
              Next Page
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || (isPastDue && role === "STUDENT") || (exercise.type === "worksheet" && pages.length > 1 && currentPageIdx === pages.length - 1 && !isComplete)}
              className="bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow"
            >
              {loading ? "Saving..." : role === "TEACHER" ? "Done Previewing" : isPastDue && role === "STUDENT" ? "Locked" : "Submit Assignment"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
