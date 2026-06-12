"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { WidgetProps, VocabularyConfig } from "./types";
import { Check, X, Award, Volume2, ArrowRight, BookOpen, HelpCircle, FileText } from "lucide-react";

// Human-readable level labels
const LEVEL_LABELS = ["Flashcard", "Choice", "Spelling", "Mastered"];

// Deterministic seeded "shuffle" — given a seed, returns a stable permutation of the array.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    // Simple LCG pseudo-random with seed
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const Vocabulary: React.FC<WidgetProps<VocabularyConfig>> = ({
  config,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  const vocabList = config.vocabList || [];

  // Stable onChange ref to avoid infinite loops
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // State: maps word index to level (0: Flashcard, 1: Multiple Choice, 2: Spelling, 3: Mastered)
  const [levels, setLevels] = useState<Record<number, number>>(() => {
    if (savedState?.levels) return savedState.levels;
    const initial: Record<number, number> = {};
    vocabList.forEach((_, idx) => { initial[idx] = 0; });
    return initial;
  });

  // Track if they answered correctly on first attempt at each level
  const [firstTryCorrect, setFirstTryCorrect] = useState<Record<number, boolean>>(() => {
    if (savedState?.firstTryCorrect) return savedState.firstTryCorrect;
    const initial: Record<number, boolean> = {};
    vocabList.forEach((_, idx) => { initial[idx] = true; });
    return initial;
  });

  // Flip state for Level 0 (Flashcard)
  const [flipped, setFlipped] = useState(false);

  // Active word index
  const [activeIdx, setActiveIdx] = useState<number>(0);

  // Feedback state: "idle" | "correct" | "incorrect"
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [spellingInput, setSpellingInput] = useState("");

  // Unmastered indices
  const unmasteredIndices = useMemo(() => {
    const indices: number[] = [];
    vocabList.forEach((_, idx) => {
      if ((levels[idx] ?? 0) < 3) indices.push(idx);
    });
    return indices;
  }, [levels, vocabList]);

  // Adjust active index if current word becomes mastered
  useEffect(() => {
    if (unmasteredIndices.length > 0 && !unmasteredIndices.includes(activeIdx)) {
      setActiveIdx(unmasteredIndices[0]);
      setFeedback("idle");
      setFlipped(false);
      setSelectedOptionIdx(null);
      setSpellingInput("");
    }
  }, [unmasteredIndices, activeIdx]);

  // Deterministic MC options using the word index as seed — no Math.random() to avoid hydration mismatch
  const mcOptions = useMemo(() => {
    if (vocabList.length === 0 || activeIdx >= vocabList.length) return [];
    const correctTranslation = vocabList[activeIdx].translation;
    const otherTranslations = vocabList
      .filter((_, idx) => idx !== activeIdx)
      .map((item) => item.translation);

    const shuffledDistractors = seededShuffle(otherTranslations, activeIdx * 31 + levels[activeIdx] * 7);
    const distractors = shuffledDistractors.slice(0, Math.min(3, shuffledDistractors.length));

    // Sort final options alphabetically for determinism
    return [correctTranslation, ...distractors].sort();
  }, [vocabList, activeIdx, levels]);

  // Report changes to parent using ref to avoid dependency loop
  useEffect(() => {
    if (vocabList.length === 0) return;

    const totalCount = vocabList.length;
    const masteredCount = vocabList.filter((_, idx) => (levels[idx] ?? 0) === 3).length;
    const isComplete = masteredCount === totalCount;

    let firstTryCount = 0;
    vocabList.forEach((_, idx) => {
      if (firstTryCorrect[idx]) firstTryCount++;
    });

    const score = totalCount > 0 ? (firstTryCount / totalCount) * 100 : 0;
    onChangeRef.current({ levels, firstTryCorrect }, isComplete, score);
  }, [levels, firstTryCorrect, vocabList]);

  if (vocabList.length === 0) {
    return (
      <div className="text-center py-6 text-neutral-500 italic">
        No vocabulary words configured.
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // READ-ONLY mode: display table of words with actual study status
  // -----------------------------------------------------------------------
  if (isReadOnly) {
    const savedLevels: Record<number, number> = savedState?.levels || {};
    const savedFirstTry: Record<number, boolean> = savedState?.firstTryCorrect || {};
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <BookOpen className="w-5 h-5 text-neutral-500" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
            Vocabulary Study Results ({vocabList.length} words)
          </h3>
        </div>

        {/* Summary stats bar */}
        <div className="flex flex-wrap gap-2 text-[10px] font-mono font-bold uppercase">
          {[0, 1, 2, 3].map((lvl) => {
            const count = vocabList.filter((_, idx) => (savedLevels[idx] ?? 0) === lvl).length;
            const colors = [
              "bg-neutral-100 dark:bg-neutral-800 text-neutral-600",
              "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/50",
              "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/50",
              "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200/50",
            ];
            return (
              <span key={lvl} className={`px-2 py-1 rounded ${colors[lvl]}`}>
                {LEVEL_LABELS[lvl]}: {count}
              </span>
            );
          })}
        </div>

        <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 dark:bg-neutral-950/20 text-xs font-mono uppercase text-neutral-500 border-b">
              <tr>
                <th className="px-4 py-2.5">Word</th>
                <th className="px-4 py-2.5">Translation</th>
                <th className="px-4 py-2.5 text-center">First-Try ✓</th>
                <th className="px-4 py-2.5 text-right">Level Reached</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-mono">
              {vocabList.map((item, idx) => {
                const level = savedLevels[idx] ?? 0;
                const ftc = savedFirstTry[idx] !== false; // default true only if state was never written
                const hasState = savedState?.levels != null;
                const levelColors = [
                  "bg-neutral-100 text-neutral-600",
                  "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300",
                  "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300",
                  "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300",
                ];
                return (
                  <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10">
                    <td className="px-4 py-3 font-sans font-semibold text-sm">{item.word}</td>
                    <td className="px-4 py-3 font-sans text-neutral-600 dark:text-neutral-300">
                      {item.translation}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasState ? (
                        ftc ? (
                          <span className="text-green-600 font-bold">Yes ✓</span>
                        ) : (
                          <span className="text-red-500 font-bold">No ✗</span>
                        )
                      ) : (
                        <span className="text-neutral-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${levelColors[level]}`}>
                        {LEVEL_LABELS[level]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Active word details
  const activeWord = vocabList[activeIdx];
  const activeLevel = levels[activeIdx] ?? 0;

  // Progress counts
  const masteredCount = vocabList.filter((_, idx) => (levels[idx] ?? 0) === 3).length;
  const progressPct = vocabList.length > 0 ? (masteredCount / vocabList.length) * 100 : 0;

  // Handlers
  const handleFlip = () => setFlipped(!flipped);

  const handleLevel0Complete = () => {
    setLevels((prev) => ({ ...prev, [activeIdx]: 1 }));
    setFlipped(false);
  };

  const handleMCOptionClick = (option: string, optionIdx: number) => {
    if (feedback !== "idle") return;
    setSelectedOptionIdx(optionIdx);
    const isCorrect = option === activeWord.translation;
    if (isCorrect) {
      setFeedback("correct");
    } else {
      setFeedback("incorrect");
      setFirstTryCorrect((prev) => ({ ...prev, [activeIdx]: false }));
    }
  };

  const handleMCNext = () => {
    if (feedback === "correct") {
      setLevels((prev) => ({ ...prev, [activeIdx]: 2 }));
    } else {
      setLevels((prev) => ({ ...prev, [activeIdx]: 0 }));
    }
    setFeedback("idle");
    setSelectedOptionIdx(null);
  };

  const handleSpellingSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (feedback !== "idle") return;
    const isCorrect =
      spellingInput.trim().toLowerCase() === activeWord.translation.trim().toLowerCase();
    if (isCorrect) {
      setFeedback("correct");
    } else {
      setFeedback("incorrect");
      setFirstTryCorrect((prev) => ({ ...prev, [activeIdx]: false }));
    }
  };

  const handleSpellingNext = () => {
    if (feedback === "correct") {
      setLevels((prev) => ({ ...prev, [activeIdx]: 3 }));
    } else {
      setLevels((prev) => ({ ...prev, [activeIdx]: 1 }));
    }
    setFeedback("idle");
    setSpellingInput("");
  };

  const handleSpeak = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  // Completed State
  if (unmasteredIndices.length === 0) {
    let firstTryCount = 0;
    vocabList.forEach((_, idx) => { if (firstTryCorrect[idx]) firstTryCount++; });
    return (
      <div className="text-center py-12 border border-green-200 dark:border-green-950/40 rounded bg-green-50/15 dark:bg-green-950/5 space-y-4">
        <Award className="w-16 h-16 mx-auto text-green-500 animate-bounce" />
        <h3 className="text-xl font-extrabold font-mono text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
          All Vocabulary Mastered!
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto">
          Congratulations! You have completed all vocabulary items.
        </p>
        <div className="inline-block border border-green-300 dark:border-green-800 px-4 py-2 rounded bg-white dark:bg-neutral-900 font-mono text-sm font-bold text-green-700 dark:text-green-300">
          Accuracy Score: {((firstTryCount / vocabList.length) * 100).toFixed(0)}%
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with progress bar */}
      <div className="space-y-3 border-b pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="font-bold text-base font-sans text-neutral-900 dark:text-neutral-100">
              Vocabulary Practice
            </h3>
            <p className="text-xs text-neutral-500 font-mono">
              {masteredCount} of {vocabList.length} words mastered
            </p>
          </div>

          {/* Level pill counters */}
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono font-bold uppercase shrink-0">
            <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-450 rounded border">
              Cards: {vocabList.filter((_, idx) => levels[idx] === 0).length}
            </span>
            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded border border-blue-200/50">
              Choice: {vocabList.filter((_, idx) => levels[idx] === 1).length}
            </span>
            <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded border border-amber-200/50">
              Spelling: {vocabList.filter((_, idx) => levels[idx] === 2).length}
            </span>
            <span className="px-2 py-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 rounded border border-green-200/50">
              Done: {masteredCount}
            </span>
          </div>
        </div>

        {/* Visual progress bar */}
        <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Study Arena */}
      <div className="max-w-md mx-auto py-2">
        {/* ---- LEVEL 0: FLASHCARD ---- */}
        {activeLevel === 0 && (
          <div className="space-y-6 text-center">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-450 flex items-center justify-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Stage 1 of 3 — Flashcard
            </div>

            <div
              onClick={handleFlip}
              className={`min-h-[200px] p-6 border rounded-lg shadow-sm flex flex-col justify-center items-center cursor-pointer select-none transition-all duration-200 ${
                flipped
                  ? "bg-white dark:bg-neutral-900 border-neutral-400 dark:border-neutral-600"
                  : "bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 hover:border-black dark:hover:border-white active:scale-98"
              }`}
            >
              {!flipped ? (
                <div className="space-y-4">
                  <span className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 block leading-tight">
                    {activeWord.word}
                  </span>
                  <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-400 bg-neutral-200/50 dark:bg-neutral-800 px-2 py-1 rounded">
                    Tap to reveal translation
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest block">
                    Translation
                  </span>
                  <span className="text-3xl font-extrabold text-green-700 dark:text-green-400 block leading-tight">
                    {activeWord.translation}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeak(activeWord.word);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold font-mono bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-2 py-1.5 rounded text-neutral-600 dark:text-neutral-350 transition"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Pronounce
                  </button>
                </div>
              )}
            </div>

            {flipped && (
              <button
                type="button"
                onClick={handleLevel0Complete}
                className="w-full bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 py-4 rounded-md font-sans font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                I Memorized It
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ---- LEVEL 1: MULTIPLE CHOICE ---- */}
        {activeLevel === 1 && (
          <div className="space-y-5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-450 text-center flex items-center justify-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              Stage 2 of 3 — Multiple Choice
            </div>

            <div className="p-5 border rounded bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-center space-y-2">
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                How do you translate:
              </span>
              <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 leading-tight">
                {activeWord.word}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {mcOptions.map((opt, oIdx) => {
                const isSelected = selectedOptionIdx === oIdx;
                const isCorrect = opt === activeWord.translation;

                let btnClass =
                  "w-full border p-4 rounded text-left text-sm font-medium transition select-none flex items-center justify-between min-h-[52px] ";

                if (feedback === "idle") {
                  btnClass +=
                    "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 active:bg-neutral-200 text-neutral-850 dark:text-neutral-200 bg-white dark:bg-neutral-950";
                } else {
                  if (isCorrect) {
                    btnClass +=
                      "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 font-bold";
                  } else if (isSelected) {
                    btnClass +=
                      "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 font-bold";
                  } else {
                    btnClass +=
                      "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 opacity-40 text-neutral-450";
                  }
                }

                return (
                  <button
                    key={oIdx}
                    type="button"
                    disabled={feedback !== "idle"}
                    onClick={() => handleMCOptionClick(opt, oIdx)}
                    className={btnClass}
                  >
                    <span>{opt}</span>
                    {feedback !== "idle" && isCorrect && (
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                    )}
                    {feedback !== "idle" && isSelected && !isCorrect && (
                      <X className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {feedback !== "idle" && (
              <div className="space-y-3 pt-1">
                <div
                  className={`p-3 rounded border text-xs font-medium flex items-center gap-2 ${
                    feedback === "correct"
                      ? "border-green-300 bg-green-50/20 text-green-700 dark:text-green-300"
                      : "border-red-350 bg-red-50/20 text-red-750 dark:text-red-300"
                  }`}
                >
                  {feedback === "correct" ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Correct! Moving to Spelling stage.</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-red-500" />
                      <span>Incorrect. Back to Flashcard to review.</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleMCNext}
                  className="w-full bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 py-4 rounded-md font-sans font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---- LEVEL 2: SPELLING ---- */}
        {activeLevel === 2 && (
          <div className="space-y-5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-450 text-center flex items-center justify-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              Stage 3 of 3 — Spelling Recall
            </div>

            <div className="p-5 border rounded bg-neutral-50 dark:bg-neutral-955 border-neutral-300 dark:border-neutral-800 text-center space-y-2">
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Write the translation for:
              </span>
              <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 leading-tight">
                {activeWord.word}
              </h2>
            </div>

            <form onSubmit={handleSpellingSubmit} className="space-y-4">
              <input
                type="text"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={feedback !== "idle"}
                value={spellingInput}
                onChange={(e) => setSpellingInput(e.target.value)}
                placeholder="Type the translation here..."
                className="w-full border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-center text-lg font-medium p-4 rounded-md focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black outline-none transition min-h-[52px]"
              />

              {feedback === "idle" && (
                <button
                  type="submit"
                  className="w-full bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 py-4 rounded-md font-sans font-bold text-sm transition"
                >
                  Check Spelling
                </button>
              )}
            </form>

            {feedback !== "idle" && (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded border text-xs font-medium flex flex-col gap-1.5 ${
                    feedback === "correct"
                      ? "border-green-300 bg-green-50/20 text-green-700 dark:text-green-300"
                      : "border-red-350 bg-red-50/20 text-red-750 dark:text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {feedback === "correct" ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span>Perfect! Word fully Mastered.</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-red-500" />
                        <span>Spelling incorrect. Back to Choice stage.</span>
                      </>
                    )}
                  </div>
                  {feedback === "incorrect" && (
                    <span className="text-xs opacity-90 pl-6">
                      Correct answer:{" "}
                      <strong className="font-mono bg-white/50 dark:bg-black/20 px-1 rounded">
                        {activeWord.translation}
                      </strong>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSpellingNext}
                  className="w-full bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 py-4 rounded-md font-sans font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Vocabulary;
