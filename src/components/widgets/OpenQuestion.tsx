"use client";

import React, { useState, useEffect, useRef } from "react";
import { WidgetProps, OpenQuestionConfig } from "./types";
import { CheckCircle, AlertTriangle } from "lucide-react";

export const OpenQuestion: React.FC<WidgetProps<OpenQuestionConfig>> = ({
  config,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  const [response, setResponse] = useState<string>(savedState?.response || "");

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const isComplete = response.trim().length > 0;
    
    // Check if input contains any of the target keywords (case-insensitive)
    const cleanedInput = response.toLowerCase().trim();
    let isCorrect = false;

    if (config.keywords && config.keywords.length > 0) {
      isCorrect = config.keywords.some((kw) =>
        cleanedInput.includes(kw.toLowerCase().trim())
      );
    } else {
      // If no keywords defined, treat any non-empty answer as correct
      isCorrect = isComplete;
    }

    const score = isCorrect ? 100 : 0;
    onChangeRef.current({ response }, isComplete, score);
  }, [response, config.keywords]);

  const isCorrect = config.keywords && config.keywords.length > 0
    ? config.keywords.some((kw) => response.toLowerCase().includes(kw.toLowerCase().trim()))
    : response.trim().length > 0;

  return (
    <div className="space-y-3">
      {config.description && (
        <p className="text-xs text-neutral-500 italic mb-2">{config.description}</p>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          {config.question}
        </label>
        <textarea
          disabled={isReadOnly}
          rows={3}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Type your answer here..."
          className={`w-full text-sm border rounded p-3 bg-transparent outline-none transition ${
            isReadOnly
              ? isCorrect
                ? "border-green-500 bg-green-50/10"
                : "border-red-500 bg-red-50/10"
              : "border-neutral-300 dark:border-neutral-700 focus:border-black dark:focus:border-white"
          }`}
        />
      </div>

      {isReadOnly && (
        <div className={`text-xs p-3 rounded border flex items-start gap-2 ${
          isCorrect
            ? "border-green-300 bg-green-50/20 text-green-700 dark:text-green-350"
            : "border-red-300 bg-red-50/20 text-red-700 dark:text-red-350"
        }`}>
          {isCorrect ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
          )}
          <div>
            <p className="font-semibold">{isCorrect ? "Correct answer!" : "Incorrect answer."}</p>
            {config.keywords && config.keywords.length > 0 && (
              <p className="mt-1 opacity-90">
                Target keywords: <code className="font-mono bg-white/40 px-1 rounded">{config.keywords.join(", ")}</code>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenQuestion;
