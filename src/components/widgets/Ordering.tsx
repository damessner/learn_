"use client";

import React, { useState, useEffect, useRef } from "react";
import { WidgetProps, OrderingConfig } from "./types";
import { RotateCcw, Check, X } from "lucide-react";

// Stable seeded Fisher-Yates shuffle — avoids Math.random() on every init
function seededShuffle(arr: string[], seed: number): string[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Deterministic seed derived from the element strings
function stringSeed(strs: string[]): number {
  return strs.reduce((acc, s) => {
    for (let i = 0; i < s.length; i++) acc = (acc * 31 + s.charCodeAt(i)) & 0xffffffff;
    return acc;
  }, 0x12345678);
}

export const Ordering: React.FC<WidgetProps<OrderingConfig>> = ({
  config,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  // Stable onChange ref — prevents stale closures causing infinite loops
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Shuffle once using lazy initializer so SSR and client agree.
  // If savedState has a prior shuffle, restore it; otherwise derive deterministically.
  const [shuffled] = useState<string[]>(() => {
    if (savedState?.shuffled && Array.isArray(savedState.shuffled)) {
      return savedState.shuffled as string[];
    }
    // Deterministic shuffle: same elements always produce the same order
    return seededShuffle(config.elements, stringSeed(config.elements));
  });

  const [placed, setPlaced] = useState<number[]>(savedState?.placed || []);

  useEffect(() => {
    if (shuffled.length === 0) return;

    const isComplete = placed.length === shuffled.length;

    // Partial credit: count words in correct position
    const correctPositions = placed.reduce((count, shuffledIdx, pos) => {
      return shuffled[shuffledIdx] === config.elements[pos] ? count + 1 : count;
    }, 0);

    const score = isComplete
      ? config.elements.length > 0
        ? (correctPositions / config.elements.length) * 100
        : 0
      : 0;

    onChangeRef.current({ placed, shuffled }, isComplete, score);
  }, [placed, shuffled, config.elements]);

  const handleWordClick = (shuffledIdx: number) => {
    if (isReadOnly) return;
    if (placed.includes(shuffledIdx)) {
      setPlaced((prev) => prev.filter((i) => i !== shuffledIdx));
    } else {
      setPlaced((prev) => [...prev, shuffledIdx]);
    }
  };

  const handleReset = () => {
    if (isReadOnly) return;
    setPlaced([]);
  };

  const studentText = placed.map((idx) => shuffled[idx]).join(" ").trim();
  const correctText = config.elements.join(" ").trim();
  const isCorrect = studentText === correctText;

  return (
    <div className="space-y-4">
      {config.description && (
        <p className="text-xs text-neutral-500 italic mb-2">{config.description}</p>
      )}

      <label className="block text-sm font-semibold text-neutral-850 dark:text-neutral-250">
        {config.question}
      </label>

      {/* Target Area */}
      <div
        className={`min-h-[56px] w-full border rounded p-4 flex flex-wrap gap-2 items-center bg-neutral-50/35 dark:bg-neutral-950/5 ${
          isReadOnly
            ? isCorrect
              ? "border-green-400 bg-green-50/10"
              : "border-red-400 bg-red-50/10"
            : "border-dashed border-neutral-350"
        }`}
      >
        {placed.length === 0 ? (
          <span className="text-xs text-neutral-450 italic">
            Click the words below to build your sentence...
          </span>
        ) : (
          placed.map((shuffledIdx, idx) => (
            <span
              key={idx}
              onClick={() => handleWordClick(shuffledIdx)}
              className={`px-3 py-2 rounded text-sm font-medium border shadow-xs select-none transition min-h-[40px] flex items-center ${
                isReadOnly
                  ? "border-transparent bg-neutral-200/50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                  : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 cursor-pointer hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20"
              }`}
            >
              {shuffled[shuffledIdx]}
            </span>
          ))
        )}
      </div>

      {/* Word Pool */}
      {!isReadOnly && (
        <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 dark:bg-neutral-950/10 border rounded border-neutral-250 dark:border-neutral-850">
          {shuffled.map((word, idx) => {
            const isPlaced = placed.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                disabled={isPlaced}
                onClick={() => handleWordClick(idx)}
                className={`px-3 py-2.5 rounded text-sm font-medium border transition select-none min-h-[44px] ${
                  isPlaced
                    ? "border-neutral-200 bg-neutral-100 text-neutral-350 opacity-40 cursor-default"
                    : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-black dark:hover:border-white cursor-pointer"
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>
      )}

      {/* Reset button */}
      {!isReadOnly && placed.length > 0 && (
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 text-[11px] font-bold font-mono uppercase text-neutral-500 hover:text-red-650 cursor-pointer transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear Layout
        </button>
      )}

      {/* Read-only feedback */}
      {isReadOnly && (
        <div
          className={`p-3 border rounded text-xs flex items-start gap-2 ${
            isCorrect
              ? "border-green-300 bg-green-50/20 text-green-700 dark:text-green-300"
              : "border-red-300 bg-red-50/20 text-red-700 dark:text-red-300"
          }`}
        >
          {isCorrect ? (
            <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
          ) : (
            <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">{isCorrect ? "Perfect alignment!" : "Incorrect alignment."}</p>
            {!isCorrect && placed.length > 0 && (
              <>
                <p className="mt-1 font-medium opacity-90">
                  Student answer:{" "}
                  <code className="font-mono bg-white/40 px-1 rounded">{studentText}</code>
                </p>
                <p className="mt-0.5 font-medium opacity-90">
                  Correct order:{" "}
                  <code className="font-mono bg-white/40 px-1 rounded">{correctText}</code>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Ordering;
