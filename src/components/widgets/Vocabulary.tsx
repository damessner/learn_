"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { WidgetProps, VocabularyConfig } from "./types";
import { Check, X, Award, Volume2, ArrowRight, BookOpen, HelpCircle, FileText, Sparkles, Loader2, Image as ImageIcon } from "lucide-react";
import { getVocabContextChallengeAction } from "@/lib/actions/ai-coach";

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
  const vocabList = useMemo(() => config.vocabList || [], [config.vocabList]);

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

  // Active word index - starts at first unmastered word if loading saved state
  const [activeIdx, setActiveIdx] = useState<number>(() => {
    if (savedState?.levels) {
      const firstUnmastered = vocabList.findIndex((_, idx) => (savedState.levels[idx] ?? 0) < 3);
      return firstUnmastered >= 0 ? firstUnmastered : 0;
    }
    return 0;
  });

  // Feedback state: "idle" | "correct" | "incorrect"
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [spellingInput, setSpellingInput] = useState("");

  // AI Challenge States
  const [challengeMode, setChallengeMode] = useState<"idle" | "loading" | "playing" | "completed">(
    savedState?.challengeMode || "idle"
  );
  const [challengeWords, setChallengeWords] = useState<number[]>(
    savedState?.challengeWords || []
  );
  const [challengeActiveIdx, setChallengeActiveIdx] = useState<number>(
    savedState?.challengeActiveIdx || 0
  );
  const [challengeData, setChallengeData] = useState<{ sentence: string; hint: string } | null>(
    savedState?.challengeData || null
  );
  const [challengeInput, setChallengeInput] = useState(
    savedState?.challengeInput || ""
  );
  const [challengeFeedback, setChallengeFeedback] = useState<"idle" | "correct" | "incorrect">(
    savedState?.challengeFeedback || "idle"
  );
  const [challengeCorrectCount, setChallengeCorrectCount] = useState<number>(
    savedState?.challengeCorrectCount || 0
  );
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Picture Quiz States
  const [pictureQuizMode, setPictureQuizMode] = useState<"idle" | "playing" | "completed">(
    savedState?.pictureQuizMode || "idle"
  );
  const [pictureQuizActiveIdx, setPictureQuizActiveIdx] = useState<number>(
    savedState?.pictureQuizActiveIdx || 0
  );
  const [pictureQuizFeedback, setPictureQuizFeedback] = useState<"idle" | "correct" | "incorrect">(
    savedState?.pictureQuizFeedback || "idle"
  );
  const [pictureQuizSelectedIdx, setPictureQuizSelectedIdx] = useState<number | null>(
    savedState?.pictureQuizSelectedIdx || null
  );
  const [pictureQuizOrder, setPictureQuizOrder] = useState<number[]>(
    savedState?.pictureQuizOrder || []
  );

  const wordsWithImagesIndices = useMemo(() => {
    const indices: number[] = [];
    vocabList.forEach((item, idx) => {
      if (item.image) {
        indices.push(idx);
      }
    });
    return indices;
  }, [vocabList]);

  const pictureChoices = useMemo(() => {
    if (pictureQuizMode !== "playing" || pictureQuizOrder.length === 0) return [];
    const targetWordIdx = pictureQuizOrder[pictureQuizActiveIdx];
    const targetWord = vocabList[targetWordIdx];
    if (!targetWord || !targetWord.image) return [];

    const otherImages = wordsWithImagesIndices
      .filter((idx) => idx !== targetWordIdx)
      .map((idx) => vocabList[idx].image)
      .filter(Boolean) as string[];

    const shuffledDistractors = seededShuffle(otherImages, targetWordIdx * 17 + pictureQuizActiveIdx * 3);
    const chosenDistractors = shuffledDistractors.slice(0, 3);

    const combined = [targetWord.image, ...chosenDistractors];
    return seededShuffle(combined, targetWordIdx * 5);
  }, [pictureQuizMode, pictureQuizActiveIdx, pictureQuizOrder, vocabList, wordsWithImagesIndices]);

  // Unmastered indices
  const unmasteredIndices = useMemo(() => {
    const indices: number[] = [];
    vocabList.forEach((_, idx) => {
      if ((levels[idx] ?? 0) < 3) indices.push(idx);
    });
    return indices;
  }, [levels, vocabList]);

  // Track previous activeIdx to reset per-word state when word changes
  const prevActiveIdx = useRef(activeIdx);
  useEffect(() => {
    if (activeIdx !== prevActiveIdx.current) {
      prevActiveIdx.current = activeIdx;
      setFeedback("idle");
      setFlipped(false);
      setSelectedOptionIdx(null);
      setSpellingInput("");
    }
  }, [activeIdx]);

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
    
    const standardComplete = masteredCount === totalCount;
    const needsPictureQuiz = !!config.pictureSupplementation && wordsWithImagesIndices.length >= 2;
    const pictureQuizComplete = pictureQuizMode === "completed";
    
    const isComplete = standardComplete && (!needsPictureQuiz || pictureQuizComplete);

    let firstTryCount = 0;
    vocabList.forEach((_, idx) => {
      if (firstTryCorrect[idx]) firstTryCount++;
    });

    const score = totalCount > 0 ? (firstTryCount / totalCount) * 100 : 0;
    onChangeRef.current(
      {
        levels,
        firstTryCorrect,
        challengeMode,
        challengeWords,
        challengeActiveIdx,
        challengeData,
        challengeInput,
        challengeFeedback,
        challengeCorrectCount,
        pictureQuizMode,
        pictureQuizActiveIdx,
        pictureQuizFeedback,
        pictureQuizSelectedIdx,
        pictureQuizOrder,
      },
      isComplete,
      score
    );
  }, [
    levels,
    firstTryCorrect,
    vocabList,
    challengeMode,
    challengeWords,
    challengeActiveIdx,
    challengeData,
    challengeInput,
    challengeFeedback,
    challengeCorrectCount,
    pictureQuizMode,
    pictureQuizActiveIdx,
    pictureQuizFeedback,
    pictureQuizSelectedIdx,
    pictureQuizOrder,
    config.pictureSupplementation,
    wordsWithImagesIndices,
  ]);

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
      // Advance to next unmastered word
      const nextUnmastered = vocabList.findIndex((_, idx) => idx !== activeIdx && (levels[idx] ?? 0) < 3);
      if (nextUnmastered >= 0) {
        setActiveIdx(nextUnmastered);
      }
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

  const startChallenge = async () => {
    setChallengeMode("loading");
    setChallengeError(null);
    const indices = vocabList.map((_, idx) => idx);
    // eslint-disable-next-line react-hooks/purity
    const shuffled = seededShuffle(indices, Date.now() & 0xffff);
    setChallengeWords(shuffled);
    setChallengeActiveIdx(0);
    setChallengeCorrectCount(0);
    await loadChallengeForIndex(shuffled[0], 0, shuffled);
  };

  const loadChallengeForIndex = async (wordIdx: number, challengeIdx: number, currentShuffledList?: number[]) => {
    setChallengeMode("loading");
    setChallengeError(null);
    setChallengeInput("");
    setChallengeFeedback("idle");

    const targetWord = vocabList[wordIdx];
    try {
      const res = await getVocabContextChallengeAction(targetWord.word, targetWord.translation);
      if (res.error) {
        setChallengeError(res.error);
        setChallengeMode("idle");
      } else if (res.data) {
        setChallengeData(res.data);
        setChallengeActiveIdx(challengeIdx);
        if (currentShuffledList) {
          setChallengeWords(currentShuffledList);
        }
        setChallengeMode("playing");
      }
    } catch (err: unknown) {
      setChallengeError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setChallengeMode("idle");
    }
  };

  const needsPictureQuiz = !!config.pictureSupplementation && wordsWithImagesIndices.length >= 2;

  // Completed State
  if (unmasteredIndices.length === 0) {
    let firstTryCount = 0;
    vocabList.forEach((_, idx) => { if (firstTryCorrect[idx]) firstTryCount++; });

    if (needsPictureQuiz && pictureQuizMode !== "completed") {
      if (pictureQuizMode === "idle") {
        return (
          <div className="text-center py-12 border border-purple-200 dark:border-purple-950/40 rounded bg-purple-50/10 space-y-6 max-w-md mx-auto">
            <ImageIcon className="w-16 h-16 mx-auto text-purple-500 animate-bounce" />
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold font-mono text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
                Picture Quiz Unlocked!
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
                You mastered spelling! Now test your memory with the image recognition matching quiz.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const shuffled = seededShuffle(wordsWithImagesIndices, Date.now() & 0xffff);
                setPictureQuizOrder(shuffled);
                setPictureQuizActiveIdx(0);
                setPictureQuizSelectedIdx(null);
                setPictureQuizFeedback("idle");
                setPictureQuizMode("playing");
              }}
              className="bg-purple-650 hover:bg-purple-700 active:scale-95 text-white font-mono font-bold text-xs uppercase py-3.5 px-6 rounded-lg shadow transition cursor-pointer inline-flex items-center gap-1.5"
            >
              Start Picture Quiz <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );
      }

      if (pictureQuizMode === "playing" && pictureQuizOrder.length > 0) {
        const targetWordIdx = pictureQuizOrder[pictureQuizActiveIdx];
        const targetWord = vocabList[targetWordIdx];

        const handlePictureChoiceClick = (opt: string, optIdx: number) => {
          if (pictureQuizFeedback !== "idle") return;
          setPictureQuizSelectedIdx(optIdx);
          const isCorrect = opt === targetWord.image;
          if (isCorrect) {
            setPictureQuizFeedback("correct");
          } else {
            setPictureQuizFeedback("incorrect");
          }
        };

        const handlePictureQuizContinue = () => {
          const nextIdx = pictureQuizActiveIdx + 1;
          if (nextIdx < pictureQuizOrder.length) {
            setPictureQuizActiveIdx(nextIdx);
            setPictureQuizFeedback("idle");
            setPictureQuizSelectedIdx(null);
          } else {
            setPictureQuizMode("completed");
          }
        };

        return (
          <div className="space-y-6 max-w-md mx-auto py-4">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-purple-550">
                <ImageIcon className="w-3.5 h-3.5" />
                Picture Recognition Match
              </span>
              <h4 className="font-bold text-sm text-neutral-500 font-mono">
                Item {pictureQuizActiveIdx + 1} of {pictureQuizOrder.length}
              </h4>
            </div>

            <div className="p-5 border rounded bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-850 text-center space-y-2">
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Select the correct image for:
              </span>
              <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 leading-tight">
                {targetWord.word}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {pictureChoices.map((opt, oIdx) => {
                const isSelected = pictureQuizSelectedIdx === oIdx;
                const isCorrect = opt === targetWord.image;

                let borderClass = "border-2 border-neutral-200 dark:border-neutral-800 ";
                if (pictureQuizFeedback !== "idle") {
                  if (isCorrect) {
                    borderClass = "border-2 border-green-500 ring-2 ring-green-500/35 ";
                  } else if (isSelected) {
                    borderClass = "border-2 border-red-500 ring-2 ring-red-500/35 ";
                  } else {
                    borderClass = "border border-neutral-100 dark:border-neutral-900 opacity-40 ";
                  }
                } else {
                  borderClass += "hover:border-purple-400 focus:border-purple-500 ";
                }

                return (
                  <button
                    key={oIdx}
                    type="button"
                    disabled={pictureQuizFeedback !== "idle"}
                    onClick={() => handlePictureChoiceClick(opt, oIdx)}
                    className={`aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-955 focus:outline-none transition cursor-pointer relative shadow-sm ${borderClass}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/exercises/${config.id}/assets/${opt}`}
                      alt="quiz choice"
                      className="w-full h-full object-cover"
                    />
                    {pictureQuizFeedback !== "idle" && isCorrect && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {pictureQuizFeedback !== "idle" && isSelected && !isCorrect && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-md">
                        <X className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {pictureQuizFeedback !== "idle" && (
              <div className="space-y-3 pt-1">
                <div
                  className={`p-3 rounded border text-xs font-medium flex items-center gap-2 ${
                    pictureQuizFeedback === "correct"
                      ? "border-green-300 bg-green-50/20 text-green-700 dark:text-green-300"
                      : "border-red-350 bg-red-50/20 text-red-755 dark:text-red-300"
                  }`}
                >
                  {pictureQuizFeedback === "correct" ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Correct! Excellent memory!</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-red-500" />
                      <span>Not quite. Let&apos;s memorize this connection!</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handlePictureQuizContinue}
                  className="w-full bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white dark:bg-white dark:text-black py-4 rounded-md font-sans font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        );
      }
    }

    if (challengeMode === "loading") {
      return (
        <div className="text-center py-16 space-y-4 max-w-md mx-auto">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto" />
          <h4 className="font-bold font-mono text-sm uppercase tracking-wider text-purple-600">
            AI Coach is preparing your challenge...
          </h4>
          <p className="text-xs text-neutral-450">
            Generating custom contextual sentence and hint...
          </p>
        </div>
      );
    }

    if (challengeMode === "playing" && challengeData) {
      const activeWordIdx = challengeWords[challengeActiveIdx];
      const targetWord = vocabList[activeWordIdx];

      const handleChallengeSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (challengeFeedback !== "idle") return;

        const isCorrect =
          challengeInput.trim().toLowerCase() === targetWord.translation.trim().toLowerCase();
        if (isCorrect) {
          setChallengeFeedback("correct");
          setChallengeCorrectCount((prev) => prev + 1);
        } else {
          setChallengeFeedback("incorrect");
        }
      };

      const handleChallengeNext = () => {
        const nextIdx = challengeActiveIdx + 1;
        if (nextIdx < challengeWords.length) {
          loadChallengeForIndex(challengeWords[nextIdx], nextIdx);
        } else {
          setChallengeMode("completed");
        }
      };

      const sentenceParts = challengeData.sentence.split("____");
      const beforeGap = sentenceParts[0] || "";
      const afterGap = sentenceParts[1] || "";

      return (
        <div className="space-y-6 max-w-md mx-auto py-4">
          <div className="text-center space-y-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-purple-550">
              <Sparkles className="w-3 h-3 text-purple-500 animate-pulse" />
              AI Challenge Arena
            </span>
            <h4 className="font-bold text-sm text-neutral-500 font-mono">
              Word {challengeActiveIdx + 1} of {challengeWords.length}
            </h4>
          </div>

          <div className="p-6 border rounded-xl bg-neutral-50 dark:bg-neutral-955 border-neutral-300 dark:border-neutral-800 space-y-4">
            <div className="text-base text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium text-center">
              {beforeGap}
              <span className="inline-block mx-1">
                <input
                  type="text"
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={challengeFeedback !== "idle"}
                  value={challengeInput}
                  onChange={(e) => setChallengeInput(e.target.value)}
                  placeholder="word"
                  className={`border-b-2 bg-transparent text-center focus:outline-none transition-all px-1 font-semibold ${
                    challengeFeedback === "correct"
                      ? "border-green-500 text-green-600"
                      : challengeFeedback === "incorrect"
                      ? "border-red-500 text-red-600"
                      : "border-purple-400 focus:border-black dark:focus:border-white"
                  }`}
                  style={{ width: `${Math.max(4, challengeInput.length || 4) * 10 + 15}px` }}
                />
              </span>
              {afterGap}
            </div>

            <div className="text-xs text-neutral-500 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-100 dark:border-neutral-850 flex items-start gap-2 leading-relaxed">
              <span className="text-base leading-none">💡</span>
              <div className="text-left">
                <span className="font-semibold text-neutral-750 dark:text-neutral-300">Context Tip:</span>{" "}
                {challengeData.hint}
              </div>
            </div>
          </div>

          {challengeFeedback === "idle" ? (
            <button
              type="button"
              onClick={() => handleChallengeSubmit()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-mono font-bold text-xs uppercase py-4 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
            >
              Verify Answer
            </button>
          ) : (
            <div className="space-y-4">
              <div
                className={`p-3 rounded-lg border text-xs font-medium flex flex-col gap-1.5 ${
                  challengeFeedback === "correct"
                    ? "border-green-300 bg-green-50/20 text-green-700 dark:text-green-300"
                    : "border-red-350 bg-red-50/20 text-red-750 dark:text-red-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {challengeFeedback === "correct" ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Perfect! Your answer fits the context perfectly.</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-red-500" />
                      <span>Not quite. Let&apos;s learn the correct fit.</span>
                    </>
                  )}
                </div>
                {challengeFeedback === "incorrect" && (
                  <span className="text-xs opacity-90 pl-6 text-left">
                    Correct word:{" "}
                    <strong className="font-mono bg-white/50 dark:bg-black/20 px-1 rounded text-neutral-850 dark:text-neutral-100">
                      {targetWord.translation}
                    </strong>{" "}
                    (German: *{targetWord.word}*)
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleChallengeNext}
                className="w-full bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black py-4 rounded-lg font-mono font-bold text-xs uppercase shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      );
    }

    if (challengeMode === "completed") {
      return (
        <div className="text-center py-12 border border-purple-200 dark:border-purple-950/40 rounded bg-purple-50/15 dark:bg-purple-950/5 space-y-6 max-w-md mx-auto">
          <Award className="w-16 h-16 mx-auto text-purple-500 animate-bounce" />
          <div className="space-y-2">
            <h3 className="text-xl font-extrabold font-mono text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
              AI Arena Completed!
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
              Incredible job! You solved context sentences for all vocabulary words.
            </p>
          </div>
          <div className="inline-block border border-purple-300 dark:border-purple-800 px-5 py-2.5 rounded bg-white dark:bg-neutral-900 font-mono text-sm font-bold text-purple-700 dark:text-purple-300">
            Context Challenge Score: {challengeCorrectCount} / {challengeWords.length} correct
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setChallengeMode("idle")}
              className="px-4 py-2 border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 transition cursor-pointer"
            >
              Back to Summary
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center py-12 border border-green-200 dark:border-green-950/40 rounded bg-green-50/15 dark:bg-green-950/5 space-y-4 max-w-md mx-auto">
          <Award className="w-16 h-16 mx-auto text-green-500 animate-bounce" />
          <h3 className="text-xl font-extrabold font-mono text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
            {needsPictureQuiz ? "Vocab & Picture Match Mastered!" : "All Vocabulary Mastered!"}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto">
            {needsPictureQuiz
              ? "Congratulations! You have mastered all terms and matching pictures."
              : "Congratulations! You have completed all vocabulary items."}
          </p>
          <div className="inline-block border border-green-300 dark:border-green-800 px-4 py-2 rounded bg-white dark:bg-neutral-900 font-mono text-sm font-bold text-green-700 dark:text-green-300">
            Accuracy Score: {((firstTryCount / vocabList.length) * 100).toFixed(0)}%
          </div>
        </div>

        <div className="p-6 border border-purple-200 dark:border-purple-800 bg-purple-50/10 dark:bg-purple-950/5 rounded-xl shadow-sm space-y-4 max-w-md mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-950/40 text-purple-750 dark:text-purple-300 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
            Bonus AI Arena
          </div>
          <h4 className="font-extrabold text-neutral-800 dark:text-neutral-200 text-sm">
            Context Sentence Challenge
          </h4>
          <p className="text-xs text-neutral-600 dark:text-neutral-450 leading-relaxed">
            Test your spelling in real English context! The AI coach will generate a simple sentence with a blank gap and a secret hint for your vocabulary words.
          </p>

          {challengeError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-[11px] text-red-750 dark:text-red-400 text-left">
              {challengeError}
            </div>
          )}

          <button
            type="button"
            onClick={startChallenge}
            className="w-full bg-purple-650 hover:bg-purple-750 active:scale-95 text-white font-mono font-bold text-xs uppercase py-3.5 rounded-lg shadow transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Enter AI Arena
          </button>
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
                autoComplete="off"
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
