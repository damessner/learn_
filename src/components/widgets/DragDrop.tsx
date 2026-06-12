"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { WidgetProps, DragDropConfig } from "./types";

interface ParsedGap {
  index: number;
  correctAnswer: string;
}

export const DragDrop: React.FC<WidgetProps<DragDropConfig>> = ({
  config,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  // Parse text into segment strings and gap definitions
  const { parts, gaps } = useMemo(() => {
    const regex = /<<(.*?)>>/g;
    const partsList: string[] = [];
    const gapsList: ParsedGap[] = [];
    let lastIndex = 0;
    let match;
    let gapIndex = 0;

    while ((match = regex.exec(config.text)) !== null) {
      partsList.push(config.text.substring(lastIndex, match.index));
      // Support optional ##-delimited options; first part is always the correct answer
      const correctAnswer = match[1].split("##")[0];
      gapsList.push({ index: gapIndex, correctAnswer });
      gapIndex++;
      lastIndex = regex.lastIndex;
    }
    partsList.push(config.text.substring(lastIndex));
    return { parts: partsList, gaps: gapsList };
  }, [config.text]);

  // Combine correct answers with distractors to form initial pool
  const initialPool = useMemo(() => {
    const correctAnswers = gaps.map((g) => g.correctAnswer);
    const pool = [...correctAnswers, ...(config.distractors || [])];
    
    // Stable sort or shuffle. For deterministic behavior, sort alphabetically, 
    // or pseudo-randomize once. Let's do alphabetical sorting so it doesn't shift on hot-reload.
    return pool.sort();
  }, [gaps, config.distractors]);

  // State maps gap index -> placed word (string)
  const [placements, setPlacements] = useState<Record<number, string>>(
    savedState?.placements || {}
  );

  // Currently selected word for tap-to-place
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Calculate remaining word pool
  const pool = useMemo(() => {
    const placedWords = Object.values(placements);
    const tempPool = [...initialPool];
    
    // Remove exactly one instance of each placed word from the pool
    placedWords.forEach((word) => {
      const idx = tempPool.indexOf(word);
      if (idx !== -1) {
        tempPool.splice(idx, 1);
      }
    });
    
    return tempPool;
  }, [initialPool, placements]);

  // Report changes to parent runner
  useEffect(() => {
    const totalGaps = gaps.length;
    if (totalGaps === 0) return;

    const filledCount = Object.keys(placements).filter((k) => placements[Number(k)]).length;
    const isComplete = filledCount === totalGaps;

    let correctCount = 0;
    gaps.forEach((gap) => {
      if (placements[gap.index] === gap.correctAnswer) {
        correctCount++;
      }
    });

    const score = totalGaps > 0 ? (correctCount / totalGaps) * 100 : 0;
    onChangeRef.current({ placements }, isComplete, score);
  }, [placements, gaps]);

  // Interaction handlers
  const handleSelectWord = (word: string) => {
    if (isReadOnly) return;
    setSelectedWord(word === selectedWord ? null : word);
  };

  const handlePlaceWord = (gapIndex: number, word: string) => {
    if (isReadOnly) return;
    
    setPlacements((prev) => {
      const next = { ...prev };
      const previousWord = next[gapIndex];

      // Place new word in gap
      next[gapIndex] = word;
      return next;
    });

    // Clear selection
    setSelectedWord(null);
  };

  const handleRemoveWord = (gapIndex: number) => {
    if (isReadOnly) return;
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[gapIndex];
      return next;
    });
  };

  const handleGapClick = (gapIndex: number) => {
    if (isReadOnly) return;

    const currentWord = placements[gapIndex];

    if (selectedWord) {
      // Placing the selected word
      handlePlaceWord(gapIndex, selectedWord);
    } else if (currentWord) {
      // Removing the current word
      handleRemoveWord(gapIndex);
    }
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, word: string) => {
    if (isReadOnly) return;
    e.dataTransfer.setData("text/plain", word);
    setSelectedWord(word); // Sync with click system
  };

  const handleDrop = (e: React.DragEvent, gapIndex: number) => {
    e.preventDefault();
    if (isReadOnly) return;

    const word = e.dataTransfer.getData("text/plain") || selectedWord;
    if (word) {
      handlePlaceWord(gapIndex, word);
    }
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
                <span
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, gap.index)}
                  onClick={() => handleGapClick(gap.index)}
                  className={`inline-flex items-center justify-center min-w-[110px] h-9 mx-1.5 px-2.5 border-b-2 align-middle cursor-pointer transition rounded ${
                    placements[gap.index]
                      ? isReadOnly
                        ? placements[gap.index] === gap.correctAnswer
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300"
                          : "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                        : "border-black dark:border-white bg-neutral-200 dark:bg-neutral-800 font-semibold"
                      : "border-dashed border-neutral-400 hover:border-black dark:hover:border-white bg-neutral-100 dark:bg-neutral-800/50"
                  }`}
                >
                  {placements[gap.index] || (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {isReadOnly ? "empty" : "drop here"}
                    </span>
                  )}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Word Pool */}
      {!isReadOnly && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Word Bank
          </h4>
          <div className="flex flex-wrap gap-2 p-3 border rounded border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/10 min-h-[60px]">
            {pool.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">All words placed</p>
            ) : (
              pool.map((word, wIdx) => {
                const isSelected = selectedWord === word;
                return (
                  <button
                    key={`${word}-${wIdx}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, word)}
                    onClick={() => handleSelectWord(word)}
                    className={`px-3 py-1 rounded text-sm border cursor-grab select-none transition ${
                      isSelected
                        ? "border-black dark:border-white bg-black text-white dark:bg-white dark:text-black font-semibold"
                        : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {word}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-xs text-neutral-400 italic">
            Tip: Click a word then click a gap, or drag the word directly.
          </p>
        </div>
      )}
    </div>
  );
};
export default DragDrop;
