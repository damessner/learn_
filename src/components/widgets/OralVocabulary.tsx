"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { WidgetProps, VocabularyConfig, OralVocabularyConfig } from "./types";
import { Check, X, Award, Volume2, ArrowRight } from "lucide-react";

export function checkVocabMatch(input: string, target: string): boolean {
  const cleanStr = (s: string) => s.trim().toLowerCase();
  
  const inVal = cleanStr(input);
  const targetVal = cleanStr(target);
  
  if (inVal === targetVal) return true;
  
  const noParens = (s: string) => s.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  if (noParens(inVal) === noParens(targetVal)) return true;
  
  const noParensContent = (s: string) => s.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (noParensContent(inVal) === noParensContent(targetVal)) return true;
  
  const stripTo = (s: string) => s.replace(/^\s*to\s+/i, "").trim();
  const normValIn = stripTo(noParens(inVal));
  const normValTarget = stripTo(noParens(targetVal));
  if (normValIn === normValTarget) return true;
  
  const normValIn2 = stripTo(noParensContent(inVal));
  const normValTarget2 = stripTo(noParensContent(targetVal));
  if (normValIn2 === normValTarget2) return true;
  
  return false;
}

export const OralVocabulary: React.FC<WidgetProps<VocabularyConfig | OralVocabularyConfig>> = ({
  config,
  assetsPath,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  const vocabList = useMemo(() => config.vocabList || [], [config.vocabList]);

  // Stable onChange ref to avoid infinite loops
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // State: pupil's text input per item index
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    return savedState?.answers || {};
  });

  // Track correctness per item
  const [correctItems, setCorrectItems] = useState<Record<number, boolean>>(() => {
    return savedState?.correctItems || {};
  });

  // Active word index
  const [activeIdx, setActiveIdx] = useState<number>(() => {
    return savedState?.activeIdx || 0;
  });

  // Completed status
  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    return savedState?.isCompleted || false;
  });

  // Feedback status for active question: "idle" | "correct" | "incorrect"
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");
  const [currentInput, setCurrentInput] = useState(() => {
    const savedAnswers = savedState?.answers || {};
    const startIdx = savedState?.activeIdx || 0;
    return (savedAnswers[startIdx] as string) || "";
  });

  const activeWord = vocabList[activeIdx];

  // Report changes to parent
  useEffect(() => {
    if (vocabList.length === 0) return;

    const totalCount = vocabList.length;
    const answeredCount = Object.keys(answers).length;
    const complete = isCompleted || (answeredCount === totalCount && feedback !== "idle");

    let correctCount = 0;
    vocabList.forEach((_, idx) => {
      if (correctItems[idx] === true) correctCount++;
    });

    const score = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
    onChangeRef.current(
      {
        answers,
        correctItems,
        activeIdx,
        isCompleted: complete,
      },
      complete,
      score
    );
  }, [answers, correctItems, activeIdx, isCompleted, vocabList, feedback]);

  // Play pronunciation
  const handlePlayAudio = useCallback(() => {
    if (!activeWord) return;
    // The German translation audio file: e.g. "tts-vocab-0-trans.wav"
    const audioFile = activeWord.translationAudio || `tts-vocab-${activeIdx}-trans.wav`;
    const url = `${assetsPath}${audioFile}`;
    const audio = new Audio(url);
    audio.play().catch((err) => {
      console.error("Audio playback failed:", err);
      // Fallback: browser speech synthesis in German
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(activeWord.translation);
        utterance.lang = "de-DE";
        window.speechSynthesis.speak(utterance);
      }
    });
  }, [activeWord, activeIdx, assetsPath]);

  // Auto-play audio when active index changes
  useEffect(() => {
    if (!isReadOnly && !isCompleted && activeIdx < vocabList.length) {
      handlePlayAudio();
    }
  }, [activeIdx, isCompleted, isReadOnly, handlePlayAudio, vocabList.length]);

  if (vocabList.length === 0) {
    return (
      <div className="text-center py-6 text-neutral-500 italic">
        No vocabulary words configured.
      </div>
    );
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (feedback !== "idle") return;

    const isCorrect = checkVocabMatch(currentInput, activeWord.word);

    setAnswers((prev) => ({ ...prev, [activeIdx]: currentInput }));
    setCorrectItems((prev) => ({ ...prev, [activeIdx]: isCorrect }));

    if (isCorrect) {
      setFeedback("correct");
    } else {
      setFeedback("incorrect");
    }
  };

  const handleNext = () => {
    const nextIdx = activeIdx + 1;
    if (nextIdx < vocabList.length) {
      setActiveIdx(nextIdx);
      setFeedback("idle");
      setCurrentInput(answers[nextIdx] || "");
    } else {
      setIsCompleted(true);
    }
  };

  // ----------------------------------------------------
  // READ-ONLY Mode
  // ----------------------------------------------------
  if (isReadOnly) {
    let scoreCount = 0;
    vocabList.forEach((_, idx) => {
      if (correctItems[idx] === true) scoreCount++;
    });
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Volume2 className="w-5 h-5 text-neutral-550" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
            Oral Vocabulary Quiz Results
          </h3>
        </div>

        <div className="inline-block border border-green-300 dark:border-green-800 px-4 py-2 rounded bg-white dark:bg-neutral-900 font-mono text-sm font-bold text-green-700 dark:text-green-300">
          Accuracy Score: {vocabList.length > 0 ? ((scoreCount / vocabList.length) * 100).toFixed(0) : 0}% ({scoreCount} / {vocabList.length} correct)
        </div>

        <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 dark:bg-neutral-955/20 text-xs font-mono uppercase text-neutral-550 border-b">
              <tr>
                <th className="px-4 py-2.5">Listen (German)</th>
                <th className="px-4 py-2.5">Your Translation (English)</th>
                <th className="px-4 py-2.5">Correct Term</th>
                <th className="px-4 py-2.5 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-mono">
              {vocabList.map((item, idx) => {
                const wasCorrect = correctItems[idx] === true;
                const studentAns = answers[idx] || "";
                return (
                  <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10">
                    <td className="px-4 py-3 font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          const audioFile = item.translationAudio || `tts-vocab-${idx}-trans.wav`;
                          const audio = new Audio(`${assetsPath}${audioFile}`);
                          audio.play().catch(() => {
                            if (typeof window !== "undefined" && window.speechSynthesis) {
                              const utterance = new SpeechSynthesisUtterance(item.translation);
                              utterance.lang = "de-DE";
                              window.speechSynthesis.speak(utterance);
                            }
                          });
                        }}
                        className="inline-flex items-center gap-1 hover:underline text-blue-600 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{item.translation}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-sans text-neutral-600 dark:text-neutral-300">
                      {studentAns || <span className="italic text-neutral-450">No answer</span>}
                    </td>
                    <td className="px-4 py-3 font-sans font-semibold text-sm">{item.word}</td>
                    <td className="px-4 py-3 text-center">
                      {wasCorrect ? (
                        <span className="text-green-600 font-bold">Correct ✓</span>
                      ) : (
                        <span className="text-red-500 font-bold">Incorrect ✗</span>
                      )}
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

  // Completed screen
  if (isCompleted) {
    let scoreCount = 0;
    vocabList.forEach((_, idx) => {
      if (correctItems[idx] === true) scoreCount++;
    });
    return (
      <div className="text-center py-12 border border-green-200 dark:border-green-950/40 rounded bg-green-50/15 dark:bg-green-950/5 space-y-4 max-w-md mx-auto">
        <Award className="w-16 h-16 mx-auto text-green-500 animate-bounce" />
        <h3 className="text-xl font-extrabold font-mono text-neutral-800 dark:text-neutral-200 uppercase tracking-wide">
          Quiz Completed!
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-450 max-w-sm mx-auto">
          Excellent work on this oral vocabulary test!
        </p>
        <div className="inline-block border border-green-300 dark:border-green-800 px-4 py-2 rounded bg-white dark:bg-neutral-900 font-mono text-sm font-bold text-green-700 dark:text-green-300">
          Score: {vocabList.length > 0 ? ((scoreCount / vocabList.length) * 100).toFixed(0) : 0}% ({scoreCount} / {vocabList.length} correct)
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto py-2">
      <div className="text-center space-y-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-955/40 text-blue-750 dark:text-blue-300 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider">
          <Volume2 className="w-3.5 h-3.5" />
          Oral Vocabulary Quiz
        </span>
        <h4 className="font-bold text-sm text-neutral-500 font-mono">
          Item {activeIdx + 1} of {vocabList.length}
        </h4>
      </div>

      <div className="p-6 border rounded-xl bg-neutral-50 dark:bg-neutral-955 border-neutral-300 dark:border-neutral-800 space-y-6 flex flex-col items-center">
        <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
          Click below to hear the German word:
        </span>

        <button
          type="button"
          onClick={handlePlayAudio}
          className="w-20 h-20 bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg transition duration-200 cursor-pointer"
        >
          <Volume2 className="w-10 h-10" />
        </button>

        <span className="text-[10px] text-neutral-450 uppercase font-mono font-bold tracking-wider">
          Listen carefully and write the English translation
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={feedback !== "idle"}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          placeholder="Translate to English..."
          className="w-full border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-center text-lg font-medium p-4 rounded-md focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black outline-none transition min-h-[52px]"
        />

        {feedback === "idle" && (
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-md font-sans font-bold text-sm transition"
          >
            Check Answer
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
                  <span>Correct! Nice job.</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-red-500" />
                  <span>Incorrect translation.</span>
                </>
              )}
            </div>
            {feedback === "incorrect" && (
              <span className="text-xs opacity-90 pl-6">
                Correct translation:{" "}
                <strong className="font-mono bg-white/50 dark:bg-black/20 px-1 rounded">
                  {activeWord.word}
                </strong>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="w-full bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black py-4 rounded-md font-sans font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default OralVocabulary;
