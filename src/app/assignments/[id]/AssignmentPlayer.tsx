"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { submitAssignment } from "@/app/actions";
import { WIDGET_REGISTRY } from "@/components/widgets";
import { ExerciseData } from "@/lib/exercises";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { MediaEmbed } from "@/components/widgets/MediaEmbed";
import Link from "next/link";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";

interface AssignmentPlayerProps {
  assignmentId: string;
  exercise: ExerciseData;
  assetsPath: string;
  savedAnswers?: any;
  role: "STUDENT" | "TEACHER";
  attemptNumber?: number;      // 1-indexed: what this submission will be recorded as
  multiplier?: number;         // score multiplier for this attempt (1.0, 0.75, 0.5, 0.25)
  priorAttemptCount?: number;  // how many submissions already exist
}

export function getTaskMaxPoints(q: any): number {
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

interface WorksheetQuestionRowProps {
  q: any;
  index: number;
  ChildWidget: any;
  assetsPath: string;
  savedAnswers: any;
  handleChildChange: (qId: string, state: any, complete: boolean, score: number) => void;
}

const WorksheetQuestionRow: React.FC<WorksheetQuestionRowProps> = ({
  q,
  index,
  ChildWidget,
  assetsPath,
  savedAnswers,
  handleChildChange,
}) => {
  const handleWidgetChange = useCallback((state: any, complete: boolean, score: number) => {
    handleChildChange(q.id, state, complete, score);
  }, [q.id, handleChildChange]);

  const adaptedConfig = useMemo(() => {
    const base: any = {
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
  exercise,
  assetsPath,
  savedAnswers,
  role,
  attemptNumber = 1,
  multiplier = 1.0,
  priorAttemptCount = 0,
}: AssignmentPlayerProps) {
  const router = useRouter();

  // Widget state variables
  const [widgetState, setWidgetState] = useState<any>(savedAnswers || (exercise.type === "worksheet" ? {} : null));
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState(0);

  const [childCompletions, setChildCompletions] = useState<Record<string, boolean>>({});
  const [childScores, setChildScores] = useState<Record<string, number>>({});

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

  const handleWidgetChange = useCallback((state: any, complete: boolean, currentScore: number) => {
    setWidgetState(state);
    setIsComplete(complete);
    setScore(currentScore);
  }, []);

  const handleChildChange = useCallback((qId: string, childState: any, childComplete: boolean, childScore: number) => {
    setWidgetState((prev: any) => ({ ...(prev || {}), [qId]: childState }));

    setChildCompletions((prev) => {
      const next = { ...prev, [qId]: childComplete };
      if (exercise.type === "worksheet") {
        const allComplete = exercise.questions.every((q: any) => {
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
        exercise.questions.forEach((q: any) => {
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
  }, [exercise]);

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
        setSubmitted(true);
        setSubmitScore(score);
        setSubmitEffectiveScore(res?.effectiveScore ?? score * multiplier);
        setSubmitAttemptNumber(res?.attemptNumber ?? attemptNumber);
        setSubmitMultiplier(res?.multiplier ?? multiplier);
        router.refresh();
      }
    } catch (err) {
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
        <div className="flex items-center gap-2">
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

      {/* Title block */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-150">
          {exercise.title}
        </h1>
        <span className="inline-block text-[10px] font-mono uppercase tracking-widest bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 px-2 py-0.5 rounded">
          {getExerciseTypeLabel(exercise.type)}
        </span>
      </div>

      {/* Widget Container */}
      {exercise.type === "worksheet" ? (
        <div className="space-y-8">
          {exercise.questions.map((q: any, index: number) => {
            const ChildWidget = WIDGET_REGISTRY[q.type as keyof typeof WIDGET_REGISTRY];
            if (!ChildWidget) return null;

            return (
              <WorksheetQuestionRow
                key={q.id}
                q={q}
                index={index}
                ChildWidget={ChildWidget}
                assetsPath={assetsPath}
                savedAnswers={savedAnswers}
                handleChildChange={handleChildChange}
              />
            );
          })}
        </div>
      ) : exercise.type === "image-hotspot-quiz" ? (
        <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
          {WIDGET_REGISTRY["image-hotspot-quiz"] ? (
            React.createElement(WIDGET_REGISTRY["image-hotspot-quiz"], {
              config: exercise,
              assetsPath,
              savedState: savedAnswers,
              onChange: handleWidgetChange,
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
              onChange: handleWidgetChange,
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
              onChange={handleWidgetChange}
            />
          ) : (
            <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-950/10 border-red-350 text-red-700">
              Widget type not registered.
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Submission Footer bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950/40">
        <div className="flex flex-col gap-1">
          {isComplete ? (
            <span className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-1 font-mono">
              <Check className="w-4 h-4 text-green-500" /> Ready to submit
            </span>
          ) : (
            <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Progress: Incomplete
            </span>
          )}
          {role === "STUDENT" && priorAttemptCount > 0 && (
            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
              Attempt #{attemptNumber}: score multiplied by ×{Math.round(multiplier * 100)}%
            </span>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow"
        >
          {loading ? "Saving..." : role === "TEACHER" ? "Done Previewing" : "Submit Assignment"}
        </button>
      </div>
    </div>
  );
}
