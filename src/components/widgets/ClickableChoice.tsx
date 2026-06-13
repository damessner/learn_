"use client";

import React, { useState, useEffect, useRef } from "react";
import { WidgetProps, ClickableChoiceConfig } from "./types";
import { MediaEmbed } from "./MediaEmbed";

export const ClickableChoice: React.FC<WidgetProps<ClickableChoiceConfig>> = ({
  config,
  savedState,
  onChange,
  isReadOnly = false,
  assetsPath,
}) => {
  // State: Record<statementId, selectedChoiceString>
  const [selections, setSelections] = useState<Record<string, string>>(
    savedState?.selections || {}
  );

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const total = config.statements.length;
    if (total === 0) return;

    const filledCount = Object.keys(selections).filter((k) => selections[k]).length;
    const isComplete = filledCount === total;

    let correctCount = 0;
    config.statements.forEach((stmt) => {
      if (selections[stmt.id] === stmt.correctChoice) {
        correctCount++;
      }
    });

    const score = (correctCount / total) * 100;
    onChangeRef.current({ selections }, isComplete, score);
  }, [selections, config.statements]);

  const handleSelect = (stmtId: string, choice: string) => {
    if (isReadOnly) return;
    setSelections((prev) => ({
      ...prev,
      [stmtId]: choice,
    }));
  };

  return (
    <div className="space-y-6">
      {config.description && (
        <p className="text-sm text-neutral-650 dark:text-neutral-450 border-b pb-2">
          {config.description}
        </p>
      )}

      <div className="space-y-6 divide-y divide-neutral-200 dark:divide-neutral-800">
        {config.statements.map((stmt) => {
          const selected = selections[stmt.id];

          return (
            <div
              key={stmt.id}
              className={`pt-4 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4`}
            >
              {/* Left Column: Statement & Media */}
              <div className="space-y-2 flex-1">
                <span className="text-sm font-semibold text-neutral-850 dark:text-neutral-200">
                  {stmt.text}
                </span>
                {stmt.media && (
                  <div className="max-w-[240px]">
                    <MediaEmbed src={stmt.media} assetsPath={assetsPath} />
                  </div>
                )}
              </div>

              {/* Right Column: Clickable buttons */}
              <div className="flex flex-wrap gap-2 shrink-0">
                {config.choices.map((choice) => {
                  const isSelected = selected === choice;
                  const isCorrectChoice = stmt.correctChoice === choice;

                  let btnStyle = "border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-250 hover:bg-neutral-50 dark:hover:bg-neutral-850";

                  if (isReadOnly) {
                    if (isSelected && isCorrectChoice) {
                      btnStyle = "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 font-semibold";
                    } else if (isSelected && !isCorrectChoice) {
                      btnStyle = "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 font-semibold";
                    } else if (isCorrectChoice) {
                      btnStyle = "border-green-500/50 bg-green-50/10 text-green-500/80 font-semibold";
                    } else {
                      btnStyle = "border-neutral-250 dark:border-neutral-850 bg-transparent text-neutral-450 opacity-60";
                    }
                  } else if (isSelected) {
                    btnStyle = "border-black dark:border-white bg-black text-white dark:bg-white dark:text-black font-semibold";
                  }

                  return (
                    <button
                      key={choice}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => handleSelect(stmt.id, choice)}
                      className={`px-4 py-3 rounded text-xs font-mono font-bold uppercase transition border cursor-pointer min-h-[44px] ${btnStyle}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClickableChoice;
