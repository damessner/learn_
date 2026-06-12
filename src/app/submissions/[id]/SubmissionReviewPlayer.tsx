"use client";

import React from "react";
import { WIDGET_REGISTRY } from "@/components/widgets";
import { MediaEmbed } from "@/components/widgets/MediaEmbed";
import { getTaskMaxPoints } from "@/app/assignments/[id]/AssignmentPlayer";
import { ArrowLeft, Clock, Award, User, Check, X } from "lucide-react";
import Link from "next/link";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";
import { getAttemptMultiplier } from "@/lib/scoring";

interface SubmissionReviewPlayerProps {
  exercise: any;
  savedAnswers: any;
  assetsPath: string;
  studentName: string;
  completedAt: string;
  score: number;
  effectiveScore: number;
  attemptNumber: number;
  backUrl: string;
}

export default function SubmissionReviewPlayer({
  exercise,
  savedAnswers,
  assetsPath,
  studentName,
  completedAt,
  score,
  effectiveScore,
  attemptNumber,
  backUrl,
}: SubmissionReviewPlayerProps) {
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
            <span className="text-lg font-black font-mono text-neutral-900 dark:text-neutral-100">
              {effectiveScore.toFixed(0)}%
            </span>
            {attemptNumber > 1 && (
              <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 block leading-tight">
                Attempt #{attemptNumber} · Raw {score.toFixed(0)}% × {Math.round(getAttemptMultiplier(attemptNumber) * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Read-Only Widget rendering */}
      {exercise.type === "worksheet" ? (
        <div className="space-y-8">
          {exercise.questions.map((q: any, index: number) => {
            const ChildWidget = WIDGET_REGISTRY[q.type as keyof typeof WIDGET_REGISTRY];
            if (!ChildWidget) return null;

            // Adapt on the fly
            const adaptedConfig: any = {
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
                className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-350">
                      Question {index + 1}
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
                    <details className="cursor-pointer text-neutral-555 hover:text-black dark:hover:text-white transition">
                      <summary className="font-semibold select-none font-mono">💡 View Hint</summary>
                      <div className="mt-1.5 p-2 bg-amber-50/20 dark:bg-amber-950/10 border border-amber-250/30 rounded font-medium text-amber-800 dark:text-amber-305 leading-relaxed">
                        {q.hint}
                      </div>
                    </details>
                  </div>
                )}
              </div>
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
