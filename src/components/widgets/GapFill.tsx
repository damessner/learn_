"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { WidgetProps, GapFillConfig } from "./types";

interface ParsedGap {
  index: number;
  correctAnswer: string;
  isDropdown: boolean;
  options: string[];
}

export const GapFill: React.FC<WidgetProps<GapFillConfig>> = ({
  config,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  // Parse text into segment strings and gap definitions
  const { parts, gaps } = useMemo(() => {
    const regex = /<<(.*?)>>|\[(.*?)\]/g;
    const partsList: string[] = [];
    const gapsList: ParsedGap[] = [];
    let lastIndex = 0;
    let match;
    let gapIndex = 0;

    while ((match = regex.exec(config.text)) !== null) {
      partsList.push(config.text.substring(lastIndex, match.index));

      let rawContent = match[1] || match[2] || "";
      let isDropdown = false;
      let parts: string[] = [];

      if (rawContent.startsWith("select:")) {
        isDropdown = true;
        rawContent = rawContent.substring("select:".length);
        parts = rawContent.split(/##|\|/).map(p => p.trim());
      } else {
        parts = rawContent.split(/##|\|/).map(p => p.trim());
        isDropdown = parts.length > 1 && parts[0] !== "";
      }

      if (isDropdown) {
        // Dropdown selection
        const correctAnswer = parts[0];
        // Deterministic shuffle using the gap index as seed so order is stable
        const seed = rawContent.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffffff, gapIndex + 0x9e3779b9);
        const shuffled = [...parts];
        let s = seed;
        for (let i = shuffled.length - 1; i > 0; i--) {
          s = (s * 1664525 + 1013904223) & 0xffffffff;
          const j = Math.abs(s) % (i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        gapsList.push({
          index: gapIndex,
          correctAnswer,
          isDropdown: true,
          options: shuffled,
        });
      } else {
        // Plain text input
        gapsList.push({
          index: gapIndex,
          correctAnswer: parts[0] || "",
          isDropdown: false,
          options: [],
        });
      }

      gapIndex++;
      lastIndex = regex.lastIndex;
    }
    partsList.push(config.text.substring(lastIndex));
    return { parts: partsList, gaps: gapsList };
  }, [config.text]);

  // State maps gap index -> student response (string)
  const [answers, setAnswers] = useState<Record<number, string>>(
    savedState?.answers || {}
  );

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Report changes to parent runner
  useEffect(() => {
    const totalGaps = gaps.length;
    if (totalGaps === 0) return;

    // A gap is considered filled if there's any non-whitespace response
    const filledCount = Object.keys(answers).filter((k) => answers[Number(k)]?.trim()).length;
    const isComplete = filledCount === totalGaps;

    let correctCount = 0;
    gaps.forEach((gap) => {
      const studentAnswer = (answers[gap.index] || "").trim().toLowerCase();
      const correctAnswer = gap.correctAnswer.trim().toLowerCase();
      if (studentAnswer === correctAnswer) {
        correctCount++;
      }
    });

    const score = totalGaps > 0 ? (correctCount / totalGaps) * 100 : 0;
    onChangeRef.current({ answers }, isComplete, score);
  }, [answers, gaps]);

  const handleChange = (gapIndex: number, val: string) => {
    if (isReadOnly) return;
    setAnswers((prev) => ({
      ...prev,
      [gapIndex]: val,
    }));
  };

  return (
    <div className="space-y-6">
      {config.description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 border-b pb-2">
          {config.description}
        </p>
      )}

      {/* Paragraph display with gaps */}
      <div className="leading-10 text-neutral-800 dark:text-neutral-200 border p-4 rounded bg-neutral-50 dark:bg-neutral-900/30 border-neutral-300 dark:border-neutral-700">
        {parts.map((part, idx) => {
          const gap = gaps.find((g) => g.index === idx);
          return (
            <React.Fragment key={idx}>
              <span>{part}</span>
              {gap && (
                <span className="inline-block mx-1.5 align-middle">
                  {gap.isDropdown ? (
                    <select
                      disabled={isReadOnly}
                      value={answers[gap.index] || ""}
                      onChange={(e) => handleChange(gap.index, e.target.value)}
                      className={`text-base md:text-sm rounded border px-2.5 py-1 outline-none transition ${
                        isReadOnly
                          ? (answers[gap.index] || "").trim().toLowerCase() === gap.correctAnswer.toLowerCase()
                            ? "bg-green-50 dark:bg-green-950/20 border-green-500 text-green-700 dark:text-green-300 font-semibold"
                            : "bg-red-50 dark:bg-red-955/20 border-red-500 text-red-700 dark:text-red-300 font-semibold"
                          : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:border-black dark:focus:border-white"
                      }`}
                    >
                      <option value="">-- select --</option>
                      {gap.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled={isReadOnly}
                      placeholder={isReadOnly ? "" : "write..."}
                      value={answers[gap.index] || ""}
                      onChange={(e) => handleChange(gap.index, e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck="false"
                      className={`text-base md:text-sm px-2.5 py-1 border-b outline-none transition w-32 ${
                        isReadOnly
                          ? (answers[gap.index] || "").trim().toLowerCase() === gap.correctAnswer.toLowerCase()
                            ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 font-semibold"
                            : "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 font-semibold"
                          : "border-neutral-300 dark:border-neutral-700 bg-transparent focus:border-black dark:focus:border-white text-center font-medium"
                      }`}
                    />
                  )}
                  {isReadOnly &&
                    (answers[gap.index] || "").trim().toLowerCase() !== gap.correctAnswer.toLowerCase() && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-mono ml-1">
                        ({gap.correctAnswer})
                      </span>
                    )}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
export default GapFill;
