"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { WidgetProps, MultipleChoiceConfig } from "./types";
import { MediaEmbed } from "./MediaEmbed";

// Deterministic seeded Fisher-Yates shuffle.
// Returns a new array that is a stable permutation of `arr` for the given seed.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Derive a stable numeric seed from a question's text + options
function questionSeed(q: { question: string; options: string[] }): number {
  const str = q.question + q.options.join("");
  return str.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffffff, 0x9e3779b9);
}

export const MultipleChoice: React.FC<WidgetProps<MultipleChoiceConfig>> = ({
  config,
  assetsPath,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  // State maps question index to chosen ORIGINAL option index (from config)
  const [answers, setAnswers] = useState<Record<number, number>>(
    savedState?.answers || {}
  );

  // Stable onChange ref — prevents re-running the effect when parent re-renders
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // For each question, compute a stable shuffled display order.
  // Each entry in `shuffledOrders` is an array of original indices, e.g. [2, 0, 3, 1].
  const shuffledOrders = useMemo(() => {
    return config.questions.map((q) => {
      const originalIndices = q.options.map((_, idx) => idx);
      return seededShuffle(originalIndices, questionSeed(q));
    });
  }, [config.questions]);

  useEffect(() => {
    const totalQuestions = config.questions.length;
    if (totalQuestions === 0) return;

    const answeredCount = Object.keys(answers).length;
    const isComplete = answeredCount === totalQuestions;

    let correctCount = 0;
    config.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    onChangeRef.current({ answers }, isComplete, score);
  }, [answers, config.questions]);

  // Select by original option index
  const handleSelect = (qIdx: number, originalIdx: number) => {
    if (isReadOnly) return;
    setAnswers((prev) => ({
      ...prev,
      [qIdx]: originalIdx,
    }));
  };

  return (
    <div className="space-y-8">
      {config.description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 border-b pb-2">
          {config.description}
        </p>
      )}

      {config.questions.map((q, qIdx) => {
        const selectedOriginalIdx = answers[qIdx];
        const displayOrder = shuffledOrders[qIdx]; // array of original indices in shuffled display order

        return (
          <div
            key={q.id || qIdx}
            className="p-4 border rounded border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 space-y-4"
          >
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-400 shrink-0">
                Q{qIdx + 1}
              </span>
              <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                {q.question}
              </h3>
            </div>

            {q.media && (
              <div className="my-2 max-w-full">
                <MediaEmbed src={q.media} assetsPath={assetsPath} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {displayOrder.map((originalIdx, displayIdx) => {
                const opt = q.options[originalIdx];
                const isSelected = selectedOriginalIdx === originalIdx;
                const isCorrect = q.correctOptionIndex === originalIdx;

                let btnClass =
                  "border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left p-3.5 rounded text-sm transition min-h-[52px] w-full";

                if (isSelected) {
                  if (isReadOnly) {
                    btnClass = isCorrect
                      ? "border border-green-500 bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-200 text-left p-3.5 rounded text-sm font-medium min-h-[52px] w-full"
                      : "border border-red-500 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200 text-left p-3.5 rounded text-sm font-medium min-h-[52px] w-full";
                  } else {
                    btnClass =
                      "border-2 border-black dark:border-white bg-neutral-200 dark:bg-neutral-800 text-left p-3.5 rounded text-sm font-semibold min-h-[52px] w-full";
                  }
                } else if (isReadOnly && isCorrect) {
                  btnClass =
                    "border border-green-500 bg-green-50/50 dark:bg-green-950/10 text-green-700 dark:text-green-300 text-left p-3.5 rounded text-sm min-h-[52px] w-full";
                }

                return (
                  <button
                    key={originalIdx}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleSelect(qIdx, originalIdx)}
                    className={btnClass}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full border border-neutral-400 flex items-center justify-center text-xs font-mono shrink-0">
                        {String.fromCharCode(65 + displayIdx)}
                      </span>
                      <span>{opt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default MultipleChoice;
