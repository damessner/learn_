"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { WidgetProps, MatchingConfig } from "./types";
import { MediaEmbed } from "./MediaEmbed";
import { Link2, X, Check, AlertTriangle } from "lucide-react";

export const Matching: React.FC<WidgetProps<MatchingConfig>> = ({
  config,
  savedState,
  onChange,
  isReadOnly = false,
  assetsPath,
}) => {
  // State: Record<pairId, matchedRightText>
  const [matches, setMatches] = useState<Record<string, string>>(
    savedState?.matches || {}
  );

  // Active highlighted left item
  const [activeLeftId, setActiveLeftId] = useState<string | null>(null);

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Shuffle right items once for display
  const shuffledRight = useMemo(() => {
    const list = config.pairs.map((p) => p.rightText);
    // Deterministic shuffle based on matching ID strings to avoid shifts on re-render
    return [...list].sort((a, b) => {
      const hashA = a.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const hashB = b.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return hashA - hashB;
    });
  }, [config.pairs]);

  useEffect(() => {
    const total = config.pairs.length;
    if (total === 0) return;

    const filledCount = Object.keys(matches).filter((k) => matches[k]).length;
    const isComplete = filledCount === total;

    let correctCount = 0;
    config.pairs.forEach((pair) => {
      if (matches[pair.id] === pair.rightText) {
        correctCount++;
      }
    });

    const score = (correctCount / total) * 100;
    onChangeRef.current({ matches }, isComplete, score);
  }, [matches, config.pairs]);

  const handleLeftClick = (id: string) => {
    if (isReadOnly) return;
    setActiveLeftId(id === activeLeftId ? null : id);
  };

  const handleRightClick = (rightText: string) => {
    if (isReadOnly || !activeLeftId) return;

    // Check if another left item is already matched to this right item (1-to-1 mapping)
    const existingLeftMatch = Object.keys(matches).find((key) => matches[key] === rightText);

    setMatches((prev) => {
      const next = { ...prev };
      if (existingLeftMatch) {
        delete next[existingLeftMatch];
      }
      next[activeLeftId] = rightText;
      return next;
    });

    setActiveLeftId(null);
  };

  const handleUnlink = (leftId: string) => {
    if (isReadOnly) return;
    setMatches((prev) => {
      const next = { ...prev };
      delete next[leftId];
      return next;
    });
  };

  // Check if a right text is already matched
  const isRightMatched = (rightText: string) => {
    return Object.values(matches).includes(rightText);
  };

  return (
    <div className="space-y-6">
      {config.description && (
        <p className="text-sm text-neutral-650 dark:text-neutral-450 border-b pb-2">
          {config.description}
        </p>
      )}

      {/* Matching Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Cards to connect */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-450 mb-2 border-b pb-1">
            Column A (Select item)
          </h4>
          {config.pairs.map((pair) => {
            const matchedValue = matches[pair.id];
            const isActive = activeLeftId === pair.id;
            const isCorrect = matchedValue === pair.rightText;

            let cardStyle = "border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900";
            if (isReadOnly) {
              cardStyle = isCorrect
                ? "border-green-500 bg-green-50/20 dark:bg-green-950/10 text-green-700 dark:text-green-300"
                : "border-red-500 bg-red-50/20 dark:bg-red-950/10 text-red-700 dark:text-red-300";
            } else if (isActive) {
              cardStyle = "border-black dark:border-white ring-2 ring-black dark:ring-white bg-neutral-50 dark:bg-neutral-850";
            }

            return (
              <div
                key={pair.id}
                onClick={() => handleLeftClick(pair.id)}
                className={`p-4 border rounded shadow-xs cursor-pointer transition select-none flex flex-col justify-between gap-3 ${cardStyle}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    {pair.leftText && (
                      <span className="text-sm font-semibold">{pair.leftText}</span>
                    )}
                    {pair.leftMedia && (
                      <div className="max-w-[180px]">
                        <MediaEmbed src={pair.leftMedia} assetsPath={assetsPath} />
                      </div>
                    )}
                  </div>

                  {!isReadOnly && matchedValue && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnlink(pair.id);
                      }}
                      className="text-neutral-400 hover:text-red-500 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Match indicator pill */}
                {matchedValue ? (
                  <div className="mt-2 text-xs flex items-center gap-1.5 font-mono text-neutral-550 border-t pt-2">
                    {isReadOnly ? (
                      isCorrect ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-500" />
                          <span>Matched to: <strong>{matchedValue}</strong></span>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <span className="flex items-center gap-1 text-red-650">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Matched: {matchedValue}
                          </span>
                          <span className="text-green-600 block">
                            Correct: {pair.rightText}
                          </span>
                        </div>
                      )
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5 text-neutral-450" />
                        <span>Matched: <strong>{matchedValue}</strong></span>
                      </>
                    )}
                  </div>
                ) : (
                  !isReadOnly && (
                    <div className="mt-2 text-[10px] font-mono text-neutral-400 border-t pt-2 italic">
                      {isActive ? "Select matching item in Column B..." : "Click to select"}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Targets to link to */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-450 mb-2 border-b pb-1">
            Column B (Match target)
          </h4>
          {shuffledRight.map((text) => {
            const isMatched = isRightMatched(text);
            let btnStyle = "border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-neutral-800 dark:text-neutral-200";

            if (isReadOnly) {
              btnStyle = "border-neutral-200 dark:border-neutral-850 opacity-60 text-neutral-450 cursor-default";
            } else if (isMatched) {
              btnStyle = "border-dashed border-neutral-300 bg-neutral-50 dark:bg-neutral-950/20 text-neutral-450 opacity-65 cursor-default";
            } else if (activeLeftId) {
              btnStyle = "border-black dark:border-white bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-900 dark:text-neutral-50 ring-1 ring-neutral-400";
            }

            return (
              <button
                key={text}
                type="button"
                disabled={isReadOnly || (isMatched && !isReadOnly)}
                onClick={() => handleRightClick(text)}
                className={`w-full p-4 border rounded shadow-xs text-left text-sm font-semibold transition cursor-pointer select-none ${btnStyle}`}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Matching;
