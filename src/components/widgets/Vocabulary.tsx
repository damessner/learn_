"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { WidgetProps, VocabularyConfig } from "./types";
import { 
  Check, 
  X, 
  Award, 
  Volume2, 
  ArrowRight, 
  BookOpen, 
  HelpCircle, 
  FileText, 
  Sparkles, 
  Loader2, 
  Image as ImageIcon, 
  RotateCcw, 
  Trophy 
} from "lucide-react";
import { getVocabDefinitionAction } from "@/lib/actions/ai-coach";

// --- HELPERS ---

export function cleanWordForPractice(word: string): string {
  return word
    .replace(/\((to|etw|sb|sth|sich|jemand|jemanden|etwas|jdm|jdn|jds|jdn\/etw)\)/gi, "")
    .replace(/[()]/g, "")
    .replace(/^\s*to\s+/i, "")
    .replace(/^\s*sich\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkVocabMatch(input: string, target: string): boolean {
  const clean = (s: string) => {
    return s
      .trim()
      .toLowerCase()
      .replace(/\((to|etw|sb|sth|sich|jemand|jemanden|etwas|jdm|jdn|jds|jdn\/etw)\)/gi, "")
      .replace(/[()]/g, "")
      .replace(/^\s*to\s+/i, "")
      .replace(/^\s*sich\s+/i, "")
      .replace(/\s+/g, "")
      .trim();
  };
  return clean(input) === clean(target);
}

// Seeded shuffle for deterministic distractor options
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Generate the letter gap layout and target string of missing characters
export function generateLetterGaps(word: string, revealedCount: number = 0): { display: string; missing: string; totalGaps: number } {
  const words = word.split(/\s+/);
  let gapsRevealed = 0;
  
  const displayWords = words.map(w => {
    if (w.length === 0) return "";
    const chars = w.split("");
    const result = chars.map((ch, i) => {
      if (i === 0) return ch; // Always keep the first letter
      if (/[a-zA-Z]/.test(ch)) {
        if (gapsRevealed < revealedCount) {
          gapsRevealed++;
          return ch; // Reveal as part of hints
        }
        return "_";
      }
      return ch; // Keep punctuation/digits
    });
    return result.join(" ");
  });

  // Calculate the remaining target sequence of letters to type
  const missingChars: string[] = [];
  let index = 0;
  words.forEach(w => {
    const chars = w.split("");
    chars.forEach((ch, i) => {
      if (i > 0 && /[a-zA-Z]/.test(ch)) {
        if (index >= revealedCount) {
          missingChars.push(ch);
        }
        index++;
      }
    });
  });

  return {
    display: displayWords.join("   "),
    missing: missingChars.join(""),
    totalGaps: index,
  };
}

// Get the display gaps combined with what the pupil has typed in real time
export function getGappedDisplayWithInput(word: string, userTyped: string, revealedCount: number) {
  const words = word.split(/\s+/);
  const cleanTyped = userTyped.replace(/\s+/g, "").toLowerCase();
  let typedCharIdx = 0;
  let gapsRevealed = 0;

  const displayWords = words.map(w => {
    if (w.length === 0) return "";
    const chars = w.split("");
    const result = chars.map((ch, i) => {
      if (i === 0) return ch;
      if (/[a-zA-Z]/.test(ch)) {
        if (gapsRevealed < revealedCount) {
          gapsRevealed++;
          return ch;
        }
        if (typedCharIdx < cleanTyped.length) {
          const userChar = cleanTyped[typedCharIdx];
          typedCharIdx++;
          return userChar;
        }
        return "_";
      }
      return ch;
    });
    return result.join(" ");
  });

  return displayWords.join("   ");
}

// --- STATE INTERFACE ---
interface VocabularySavedState {
  currentStage: "level1" | "level1_completed" | "opt1" | "level2" | "level2_completed" | "opt2_audio" | "opt2_image" | "level3" | "level3_completed" | "opt3_ai";
  
  level1Queue: number[];
  level1CurrentIdx: number;
  
  level2Queue: number[];
  level2CurrentIdx: number;
  level2RevealedCount: number;
  
  incorrectCounts: Record<number, number>;
  firstTryCorrect: Record<number, boolean>;
  
  opt1Done: boolean;
  opt1Queue: number[];
  opt1CurrentIdx: number;
  
  opt2AudioDone: boolean;
  opt2AudioQueue: number[];
  opt2AudioCurrentIdx: number;
  
  opt2ImageDone: boolean;
  opt2ImageQueue: number[];
  opt2ImageCurrentIdx: number;
  
  opt3AIDone: boolean;
  opt3AIQueue: number[];
  opt3AICurrentIdx: number;
  
  level3Score?: number;
  level3Grade?: string;
  level3Remarks?: string;
  level3Session?: {
    questions: Array<{
      wordIndex: number;
      type: "de-to-en" | "en-to-de";
    }>;
    answers: Record<number, string>;
    submitted: boolean;
    graded: boolean;
  };
}

// --- GRADES & REMARKS ---
const GRADE_SCHEME = [
  { min: 90, grade: "A", smiley: "happy", remarks: ["Outstanding work! You've mastered this vocabulary perfectly!", "Sensational! Aloys is very proud of you!", "Perfect score! You are a language superstar! ⭐"] },
  { min: 80, grade: "B", smiley: "happy", remarks: ["Great job! A few minor slips, but you really know your stuff!", "Excellent effort! Keep it up!", "Super vocabulary skills! Almost perfect!"] },
  { min: 70, grade: "C", smiley: "neutral", remarks: ["Good work! You are on the right track. Practice a bit more to get that A!", "Well done. You passed with a solid score!", "Keep practicing, you are doing great!"] },
  { min: 60, grade: "D", smiley: "neutral", remarks: ["You passed! Let's review the incorrect words to strengthen your memory.", "Decent attempt. Focus on spelling next time!"] },
  { min: 50, grade: "E", smiley: "sad", remarks: ["Mistakes are just stepping stones. Review the words and try again, you can do it!", "Don't be discouraged! Take your time to review and retake the test."] },
  { min: 0, grade: "F", smiley: "crying", remarks: ["No worries, everyone starts somewhere. Review Level 1-2 and try again!", "Let's work together to practice these words. Try again!"] }
];

// Fallback definitions for AI challenge
const FALLBACK_DEFINITIONS: Record<string, string> = {
  "play ball": "An activity where you throw, kick, or catch a round object with other people.",
  "football": "A game played by two teams of eleven players using a round ball that they kick.",
  "dog": "A friendly four-legged animal that barks and is often kept as a pet.",
  "cat": "A small furry animal with whiskers that likes to chase mice and sleep.",
  "apple": "A round fruit with red, green, or yellow skin and sweet white flesh.",
  "car": "A road vehicle with four wheels and an engine, used for carrying passengers.",
  "house": "A building that made for people, especially a family, to live in.",
  "school": "A place where children go to be educated and learn from teachers.",
  "teacher": "A person whose job is to help students learn and acquire knowledge."
};

export const Vocabulary: React.FC<WidgetProps<VocabularyConfig>> = ({
  config,
  assetsPath,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  const vocabList = useMemo(() => config.vocabList || [], [config.vocabList]);

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Extract all indices with images
  const wordsWithImagesIndices = useMemo(() => {
    return vocabList
      .map((item, idx) => (item.image ? idx : -1))
      .filter((idx) => idx !== -1);
  }, [vocabList]);

  // --- STATE INITIALIZATION & COMPATIBILITY MIGRATION ---
  const [state, setState] = useState<VocabularySavedState>(() => {
    if (savedState && savedState.currentStage) {
      return savedState as VocabularySavedState;
    }

    const totalWords = vocabList.length;
    const initialQueue = Array.from({ length: totalWords }, (_, i) => i);
    const imageQueue = [...wordsWithImagesIndices];

    // Attempt migration from old levels mapping if it exists
    let currentStage: VocabularySavedState["currentStage"] = "level1";
    let level1Queue = [...initialQueue];
    let level2Queue = [...initialQueue];
    const firstTryCorrect: Record<number, boolean> = savedState?.firstTryCorrect || {};

    if (savedState?.levels) {
      const levelsMap = savedState.levels as Record<number, number>;
      const allMastered = vocabList.every((_, idx) => (levelsMap[idx] ?? 0) === 3);
      if (allMastered) {
        currentStage = "level3";
      } else {
        const startedLevel2 = vocabList.some((_, idx) => (levelsMap[idx] ?? 0) >= 1);
        if (startedLevel2) {
          currentStage = "level2";
          level2Queue = vocabList
            .map((_, idx) => idx)
            .filter((idx) => (levelsMap[idx] ?? 0) < 3);
        } else {
          currentStage = "level1";
          level1Queue = vocabList
            .map((_, idx) => idx)
            .filter((idx) => (levelsMap[idx] ?? 0) < 1);
        }
      }
    }

    return {
      currentStage,
      level1Queue: level1Queue.length > 0 ? level1Queue : [0],
      level1CurrentIdx: 0,
      level2Queue: level2Queue.length > 0 ? level2Queue : [0],
      level2CurrentIdx: 0,
      level2RevealedCount: 0,
      incorrectCounts: {},
      firstTryCorrect,
      opt1Done: false,
      opt1Queue: imageQueue,
      opt1CurrentIdx: 0,
      opt2AudioDone: false,
      opt2AudioQueue: [...initialQueue],
      opt2AudioCurrentIdx: 0,
      opt2ImageDone: false,
      opt2ImageQueue: imageQueue,
      opt2ImageCurrentIdx: 0,
      opt3AIDone: false,
      opt3AIQueue: [...initialQueue],
      opt3AICurrentIdx: 0,
    };
  });

  // UI Interactive States (not persisted in savedState)
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect" | "hints_used">("idle");
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [spellingInput, setSpellingInput] = useState("");
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [aiDefinition, setAiDefinition] = useState<string | null>(null);

  const prevActiveIdxRef = useRef<number | null>(null);

  // Load definition in background for AI stage
  useEffect(() => {
    if (state.currentStage !== "opt3_ai") return;

    const activeWordIdx = state.opt3AIQueue[state.opt3AICurrentIdx];
    if (activeWordIdx === undefined) return;

    if (prevActiveIdxRef.current === activeWordIdx) return;
    prevActiveIdxRef.current = activeWordIdx;

    setAiDefinition(null);
    setDefinitionLoading(true);

    const loadDefinition = async () => {
      try {
        const activeWord = vocabList[activeWordIdx];
        const cleaned = cleanWordForPractice(activeWord.word);
        const res = await getVocabDefinitionAction(activeWord.word, activeWord.translation);
        if (res.success && res.data) {
          setAiDefinition(res.data.definition);
        } else {
          setAiDefinition(FALLBACK_DEFINITIONS[cleaned.toLowerCase()] || `The English word for the German term: "${activeWord.translation}"`);
        }
      } catch (err) {
        console.error(err);
        const activeWord = vocabList[activeWordIdx];
        const cleaned = cleanWordForPractice(activeWord.word);
        setAiDefinition(FALLBACK_DEFINITIONS[cleaned.toLowerCase()] || `The English word for the German term: "${activeWord.translation}"`);
      } finally {
        setDefinitionLoading(false);
      }
    };

    loadDefinition();
  }, [state.currentStage, state.opt3AIQueue, state.opt3AICurrentIdx, vocabList]);

  // Sync state to parent on change
  useEffect(() => {
    if (vocabList.length === 0) return;

    const totalWords = vocabList.length;
    
    // Level 1 Progress score
    const l1Completed = Math.max(0, totalWords - state.level1Queue.length);
    const l1Score = totalWords > 0 ? (l1Completed / totalWords) * 100 : 0;

    // Level 2 Progress score
    const l2Completed = Math.max(0, totalWords - state.level2Queue.length);
    const l2Score = totalWords > 0 ? (l2Completed / totalWords) * 100 : 0;

    // Level 3 Exam score
    const l3Score = state.level3Score || 0;

    // Core weighted score: Level 1 (30%), Level 2 (40%), Level 3 (30%)
    const finalScore = Math.min(100, Math.max(0, (l1Score * 0.3) + (l2Score * 0.4) + (l3Score * 0.3)));
    
    // Completed when Level 3 exam is graded
    const isComplete = !!(state.level3Session?.submitted && state.level3Session?.graded);

    onChangeRef.current(state, isComplete, finalScore);
  }, [state, vocabList.length]);

  // Speak helper (TTS)
  const handleSpeak = (text: string, isGerman: boolean = false) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = isGerman ? "de-DE" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- STAGE RENDER HELPERS ---

  // 1. Progress Header and Badges
  const renderBadgesHeader = () => {
    const badgeList = [
      { id: "level1", label: "Lvl 1: Choice", emoji: "🎯", unlocked: state.currentStage !== "level1", completed: !["level1", "level1_completed", "opt1"].includes(state.currentStage) },
      { id: "opt1", label: "Opt: Pictures", emoji: "🎨", unlocked: state.opt1Done || state.currentStage === "opt1", completed: state.opt1Done },
      { id: "level2", label: "Lvl 2: Spelling", emoji: "📝", unlocked: !["level1", "level1_completed", "opt1"].includes(state.currentStage), completed: !["level1", "level1_completed", "opt1", "level2", "level2_completed", "opt2_audio", "opt2_image"].includes(state.currentStage) },
      { id: "opt2_audio", label: "Opt: Listening", emoji: "🎧", unlocked: state.opt2AudioDone || state.currentStage === "opt2_audio", completed: state.opt2AudioDone },
      { id: "opt2_image", label: "Opt: Visuals", emoji: "📸", unlocked: state.opt2ImageDone || state.currentStage === "opt2_image", completed: state.opt2ImageDone },
      { id: "level3", label: "Lvl 3: Exam", emoji: "🎓", unlocked: ["level3", "level3_completed", "opt3_ai"].includes(state.currentStage), completed: !!state.level3Session?.graded },
      { id: "opt3_ai", label: "Opt: AI Master", emoji: "🏆", unlocked: state.opt3AIDone || state.currentStage === "opt3_ai", completed: state.opt3AIDone }
    ];

    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">Learning Badges</h4>
          <span className="text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full">
            Stage: {state.currentStage.replace("_", " ").toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {badgeList.map((b) => (
            <div
              key={b.id}
              className={`flex flex-col items-center p-2 rounded-lg border text-center transition-all ${
                b.completed
                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50"
                  : b.unlocked
                  ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40 border-dashed"
                  : "bg-neutral-100 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 opacity-30 grayscale"
              }`}
            >
              <span className="text-2xl mb-1">{b.emoji}</span>
              <span className="text-[9px] font-bold tracking-tight leading-none block truncate max-w-full text-neutral-700 dark:text-neutral-355">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderProgressBar = () => {
    let label = "";
    let percentage = 0;
    
    if (state.currentStage === "level1") {
      const total = vocabList.length;
      const remaining = state.level1Queue.length;
      percentage = total > 0 ? ((total - remaining) / total) * 100 : 0;
      label = `Level 1 Progress (Multiple Choice): ${percentage.toFixed(0)}%`;
    } else if (state.currentStage === "level2") {
      const total = vocabList.length;
      const remaining = state.level2Queue.length;
      percentage = total > 0 ? ((total - remaining) / total) * 100 : 0;
      label = `Level 2 Progress (Spell Gaps): ${percentage.toFixed(0)}%`;
    } else if (state.currentStage === "opt1") {
      const total = state.opt1Queue.length;
      percentage = total > 0 ? ((state.opt1CurrentIdx) / total) * 100 : 0;
      label = `Optional: Picture Match Progress: ${percentage.toFixed(0)}%`;
    } else if (state.currentStage === "opt2_audio") {
      const total = state.opt2AudioQueue.length;
      percentage = total > 0 ? ((state.opt2AudioCurrentIdx) / total) * 100 : 0;
      label = `Optional: Audio Translate Progress: ${percentage.toFixed(0)}%`;
    } else if (state.currentStage === "opt2_image") {
      const total = state.opt2ImageQueue.length;
      percentage = total > 0 ? ((state.opt2ImageCurrentIdx) / total) * 100 : 0;
      label = `Optional: Visual Speller Progress: ${percentage.toFixed(0)}%`;
    } else if (state.currentStage === "opt3_ai") {
      const total = state.opt3AIQueue.length;
      percentage = total > 0 ? ((state.opt3AICurrentIdx) / total) * 100 : 0;
      label = `Optional: AI Definition Mastery: ${percentage.toFixed(0)}%`;
    } else if (state.currentStage === "level3") {
      label = "Level 3: Lined Paper Exam (Ready to Start)";
      percentage = 0;
    } else if (state.currentStage === "level3_completed") {
      label = `Exam Completed! Score: ${state.level3Score?.toFixed(0)}%`;
      percentage = 100;
    } else {
      label = "Section Completed";
      percentage = 100;
    }

    return (
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono font-bold text-neutral-500">
          <span>{label}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-850 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  // --- READ-ONLY MODE ---
  if (isReadOnly) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <BookOpen className="w-5 h-5 text-neutral-500" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
            Vocabulary Practice Results ({vocabList.length} words)
          </h3>
        </div>
        <div className="border border-neutral-300 dark:border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 dark:bg-neutral-950/20 text-xs font-mono uppercase text-neutral-500 border-b">
              <tr>
                <th className="px-4 py-2.5">Word</th>
                <th className="px-4 py-2.5">Translation</th>
                <th className="px-4 py-2.5 text-center">First-Try ✓</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-mono">
              {vocabList.map((item, idx) => {
                const ftc = state.firstTryCorrect[idx] !== false;
                return (
                  <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10">
                    <td className="px-4 py-3 font-sans font-semibold text-sm">{item.word}</td>
                    <td className="px-4 py-3 font-sans text-neutral-600 dark:text-neutral-350">{item.translation}</td>
                    <td className="px-4 py-3 text-center">
                      {ftc ? (
                        <span className="text-green-600 font-bold">Yes ✓</span>
                      ) : (
                        <span className="text-red-500 font-bold">No ✗</span>
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

  // --- RENDERING ROUTER FOR ACTIVE STAGES ---

  // --- STAGE 1: LEVEL 1 (MULTIPLE CHOICE) ---
  if (state.currentStage === "level1") {
    const activeWordIdx = state.level1Queue[state.level1CurrentIdx];
    if (activeWordIdx === undefined) return null;
    const activeWord = vocabList[activeWordIdx];

    // Generate deterministic options
    const mcOptions = [
      activeWord.translation,
      ...seededShuffle(
        vocabList.filter((_, idx) => idx !== activeWordIdx).map((w) => w.translation),
        activeWordIdx * 13 + state.level1CurrentIdx
      ).slice(0, 3)
    ].sort();

    const handleMCClick = (opt: string, idx: number) => {
      if (feedback !== "idle") return;
      setSelectedOptionIdx(idx);
      const isCorrect = opt === activeWord.translation;
      if (isCorrect) {
        setFeedback("correct");
        handleSpeak(activeWord.word, false);
      } else {
        setFeedback("incorrect");
        setState(prev => ({
          ...prev,
          incorrectCounts: { ...prev.incorrectCounts, [activeWordIdx]: (prev.incorrectCounts[activeWordIdx] || 0) + 1 },
          firstTryCorrect: { ...prev.firstTryCorrect, [activeWordIdx]: false }
        }));
      }
    };

    const handleMCNext = () => {
      const isCorrect = mcOptions[selectedOptionIdx || 0] === activeWord.translation;
      setFeedback("idle");
      setSelectedOptionIdx(null);

      setState(prev => {
        const newQueue = [...prev.level1Queue];
        let nextIdx = prev.level1CurrentIdx;
        
        if (isCorrect) {
          nextIdx++;
        } else {
          // Reschedule wrong word at the end
          newQueue.push(activeWordIdx);
          nextIdx++;
        }

        const isCompleted = nextIdx >= newQueue.length;
        return {
          ...prev,
          level1Queue: newQueue,
          level1CurrentIdx: nextIdx,
          currentStage: isCompleted ? "level1_completed" : "level1"
        };
      });
    };

    return (
      <div className="space-y-6 max-w-md mx-auto py-2">
        <div className="text-center space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-blue-650 dark:text-blue-400">
            <HelpCircle className="w-4 h-4" />
            Stage 1 — Multiple Choice
          </span>
          <h4 className="font-bold text-xs text-neutral-450 font-mono">
            Word {state.level1CurrentIdx + 1} of {state.level1Queue.length}
          </h4>
        </div>

        <div className="p-6 border rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-center space-y-4 shadow-sm">
          {activeWord.image && (
            <div className="mx-auto w-44 h-44 rounded-xl overflow-hidden shadow-sm border border-neutral-200 dark:border-neutral-850 bg-neutral-100 dark:bg-neutral-900">
              <img
                src={`${assetsPath}${activeWord.image}`}
                alt={activeWord.word}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block">How do you translate:</span>
            <h2 className="text-3xl font-extrabold text-neutral-905 dark:text-neutral-100 leading-tight">
              {cleanWordForPractice(activeWord.word)}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {mcOptions.map((opt, oIdx) => {
            const isSelected = selectedOptionIdx === oIdx;
            const isCorrect = opt === activeWord.translation;

            let btnClass = "w-full border p-4 rounded-xl text-left text-sm font-semibold transition select-none flex items-center justify-between min-h-[56px] shadow-sm cursor-pointer ";
            if (feedback === "idle") {
              btnClass += "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-255 hover:border-purple-400 dark:hover:border-purple-500 active:scale-[0.99]";
            } else if (isCorrect) {
              btnClass += "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 font-bold";
            } else if (isSelected) {
              btnClass += "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 font-bold";
            } else {
              btnClass += "border-neutral-250 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-950/40 opacity-40 text-neutral-450 pointer-events-none";
            }

            return (
              <button
                key={oIdx}
                type="button"
                disabled={feedback !== "idle"}
                onClick={() => handleMCClick(opt, oIdx)}
                className={btnClass}
              >
                <span>{opt}</span>
                {feedback !== "idle" && isCorrect && <Check className="w-5 h-5 text-green-600" />}
                {feedback !== "idle" && isSelected && !isCorrect && <X className="w-5 h-5 text-red-500" />}
              </button>
            );
          })}
        </div>

        {feedback !== "idle" && (
          <div className="space-y-3 pt-2">
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              feedback === "correct" ? "border-green-300 bg-green-500/10 text-green-700 dark:text-green-350" : "border-red-300 bg-red-500/10 text-red-700 dark:text-red-350"
            }`}>
              {feedback === "correct" ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Correct! Press continue to move forward.</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-red-500" />
                  <span>Not quite. This word will be rescheduled at the end!</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleMCNext}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow cursor-pointer active:scale-95"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- STAGE 1 COMPLETED DASHBOARD ---
  if (state.currentStage === "level1_completed") {
    const hasImages = wordsWithImagesIndices.length >= 2;
    return (
      <div className="text-center py-10 max-w-md mx-auto space-y-6">
        <Award className="w-16 h-16 text-yellow-500 animate-bounce mx-auto" />
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-neutral-800 dark:text-neutral-205">Level 1 Mastered!</h2>
          <p className="text-sm text-neutral-500">You earned the **Recognition Pioneer Badge 🎯**! All words identified successfully.</p>
        </div>
        <div className="flex flex-col gap-3 pt-4">
          {hasImages && (
            <button
              type="button"
              onClick={() => setState(prev => ({ ...prev, currentStage: "opt1", opt1CurrentIdx: 0 }))}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold text-sm transition shadow cursor-pointer active:scale-95"
            >
              Play Optional: Picture Match (Get Badge 🎨)
            </button>
          )}
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, currentStage: "level2", level2CurrentIdx: 0 }))}
            className="w-full bg-neutral-905 dark:bg-white dark:text-black text-white hover:bg-neutral-800 dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition shadow cursor-pointer active:scale-95"
          >
            Go to Level 2: Fill Gapped Letters 📝
          </button>
        </div>
      </div>
    );
  }

  // --- STAGE 1.5: OPTIONAL PICTURE MATCHING ---
  if (state.currentStage === "opt1") {
    const activeWordIdx = state.opt1Queue[state.opt1CurrentIdx];
    if (activeWordIdx === undefined) return null;
    const activeWord = vocabList[activeWordIdx];

    // Generate image choices
    const otherImages = wordsWithImagesIndices
      .filter(idx => idx !== activeWordIdx)
      .map(idx => vocabList[idx].image)
      .filter(Boolean) as string[];
    const pictureChoices = [
      activeWord.image,
      ...seededShuffle(otherImages, activeWordIdx * 17).slice(0, 3)
    ].sort();

    const handlePictureChoiceClick = (img: string, idx: number) => {
      if (feedback !== "idle") return;
      setSelectedOptionIdx(idx);
      if (img === activeWord.image) {
        setFeedback("correct");
        handleSpeak(activeWord.word, false);
      } else {
        setFeedback("incorrect");
      }
    };

    const handlePictureNext = () => {
      const isCorrect = pictureChoices[selectedOptionIdx || 0] === activeWord.image;
      setFeedback("idle");
      setSelectedOptionIdx(null);

      setState(prev => {
        const newQueue = [...prev.opt1Queue];
        let nextIdx = prev.opt1CurrentIdx;
        
        if (isCorrect) {
          nextIdx++;
        } else {
          newQueue.push(activeWordIdx);
          nextIdx++;
        }

        const isCompleted = nextIdx >= newQueue.length;
        return {
          ...prev,
          opt1Queue: newQueue,
          opt1CurrentIdx: nextIdx,
          opt1Done: isCompleted ? true : prev.opt1Done,
          currentStage: isCompleted ? "level2" : "opt1"
        };
      });
    };

    return (
      <div className="space-y-6 max-w-md mx-auto py-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, currentStage: "level2", level2CurrentIdx: 0 }))}
            className="text-xs font-mono font-bold text-neutral-400 hover:text-neutral-600 underline"
          >
            Skip Optional
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-purple-650 dark:text-purple-400">
            <ImageIcon className="w-4 h-4" />
            Optional Picture matching
          </span>
        </div>

        <div className="p-6 border rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-neutral-250 dark:border-neutral-850 text-center space-y-2 shadow-sm">
          <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Select the correct picture for:</span>
          <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 leading-tight">
            {cleanWordForPractice(activeWord.word)}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {pictureChoices.map((opt, oIdx) => {
            const isSelected = selectedOptionIdx === oIdx;
            const isCorrect = opt === activeWord.image;

            let borderClass = "border-2 border-neutral-200 dark:border-neutral-800 ";
            if (feedback !== "idle") {
              if (isCorrect) {
                borderClass = "border-2 border-green-500 ring-2 ring-green-500/35 ";
              } else if (isSelected) {
                borderClass = "border-2 border-red-500 ring-2 ring-red-500/35 ";
              } else {
                borderClass = "border border-neutral-100 dark:border-neutral-900 opacity-40 ";
              }
            } else {
              borderClass += "hover:border-purple-400 focus:border-purple-500 active:scale-95";
            }

            return (
              <button
                key={oIdx}
                type="button"
                disabled={feedback !== "idle"}
                onClick={() => handlePictureChoiceClick(opt || "", oIdx)}
                className={`aspect-square rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-955 focus:outline-none transition cursor-pointer relative shadow-sm ${borderClass}`}
              >
                <img
                  src={`${assetsPath}${opt}`}
                  alt="quiz choice"
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>

        {feedback !== "idle" && (
          <div className="space-y-3 pt-1">
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              feedback === "correct" ? "border-green-300 bg-green-500/10 text-green-700 dark:text-green-300" : "border-red-350 bg-red-500/10 text-red-750 dark:text-red-305"
            }`}>
              {feedback === "correct" ? <span>Correct! Perfect visual mapping.</span> : <span>Incorrect. This picture will reappear later!</span>}
            </div>
            <button
              type="button"
              onClick={handlePictureNext}
              className="w-full bg-neutral-900 dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- STAGE 2: LEVEL 2 (FILL IN LETTERS) ---
  if (state.currentStage === "level2") {
    const activeWordIdx = state.level2Queue[state.level2CurrentIdx];
    if (activeWordIdx === undefined) return null;
    const activeWord = vocabList[activeWordIdx];
    const cleaned = cleanWordForPractice(activeWord.word);

    // Compute gapped layout
    const gapInfo = generateLetterGaps(cleaned, state.level2RevealedCount);

    const handleL2Submit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (feedback !== "idle") return;

      const isCorrect = checkVocabMatch(spellingInput, gapInfo.missing);
      if (isCorrect) {
        setFeedback(state.level2RevealedCount > 0 ? "hints_used" : "correct");
        handleSpeak(activeWord.word, false);
      } else {
        setFeedback("incorrect");
        setState(prev => ({
          ...prev,
          incorrectCounts: { ...prev.incorrectCounts, [activeWordIdx]: (prev.incorrectCounts[activeWordIdx] || 0) + 1 },
          firstTryCorrect: { ...prev.firstTryCorrect, [activeWordIdx]: false }
        }));
      }
    };

    const handleL2Next = () => {
      const isCorrect = checkVocabMatch(spellingInput, gapInfo.missing);
      const hintsUsed = state.level2RevealedCount > 0;
      const passCleanly = isCorrect && !hintsUsed;

      setFeedback("idle");
      setSpellingInput("");

      setState(prev => {
        const newQueue = [...prev.level2Queue];
        let nextIdx = prev.level2CurrentIdx;

        if (passCleanly) {
          nextIdx++;
        } else {
          // Reschedule wrong or assisted word at the end
          newQueue.push(activeWordIdx);
          nextIdx++;
        }

        const isCompleted = nextIdx >= newQueue.length;
        return {
          ...prev,
          level2Queue: newQueue,
          level2CurrentIdx: nextIdx,
          level2RevealedCount: 0,
          currentStage: isCompleted ? "level2_completed" : "level2"
        };
      });
    };

    const handleHintClick = () => {
      if (state.level2RevealedCount < gapInfo.totalGaps) {
        setState(prev => ({ ...prev, level2RevealedCount: prev.level2RevealedCount + 1 }));
      }
    };

    const handleIDontKnowClick = () => {
      // Reveal everything
      setState(prev => ({ ...prev, level2RevealedCount: gapInfo.totalGaps }));
      setSpellingInput("");
      setFeedback("hints_used");
    };

    // Live rendering inside gapped text box
    const gappedDisplay = getGappedDisplayWithInput(cleaned, spellingInput, state.level2RevealedCount);

    return (
      <div className="space-y-6 max-w-md mx-auto py-2">
        <div className="text-center space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            <FileText className="w-4 h-4" />
            Stage 2 — Fill in the Letters
          </span>
          <h4 className="font-bold text-xs text-neutral-450 font-mono">
            Word {state.level2CurrentIdx + 1} of {state.level2Queue.length}
          </h4>
        </div>

        <div className="p-6 border rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-neutral-250 dark:border-neutral-850 text-center space-y-3 shadow-sm">
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block">German meaning:</span>
          <h2 className="text-3xl font-extrabold text-green-700 dark:text-green-455 leading-tight">
            {activeWord.translation}
          </h2>
          <div className="flex justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSpeak(activeWord.word, false)}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold font-mono bg-neutral-200 hover:bg-neutral-350 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-3 py-1.5 rounded-lg text-neutral-700 dark:text-neutral-355 transition active:scale-95 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" /> Pronounce EN
            </button>
          </div>
        </div>

        <div className="p-6 border rounded-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-850 text-center space-y-3 shadow-inner">
          <span className="text-xs font-mono text-neutral-450 uppercase block">Fill spelling gaps:</span>
          <div className="text-3xl font-mono font-black tracking-[0.18em] text-neutral-900 dark:text-neutral-100 py-2">
            {gappedDisplay}
          </div>
          <div className="text-[10px] font-mono text-neutral-450">
            {gapInfo.missing.length} letter{gapInfo.missing.length !== 1 ? 's' : ''} remaining
          </div>
        </div>

        <form onSubmit={handleL2Submit} className="space-y-4">
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
            placeholder="Type the missing letters in order..."
            className="w-full border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-950 text-center text-lg font-bold p-4 rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition shadow-sm"
          />

          {feedback === "idle" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleHintClick}
                disabled={state.level2RevealedCount >= gapInfo.totalGaps}
                className="flex-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer active:scale-95 disabled:opacity-40"
              >
                Hint 💡
              </button>
              <button
                type="button"
                onClick={handleIDontKnowClick}
                className="flex-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer active:scale-95"
              >
                I don&apos;t know ❓
              </button>
              <button
                type="submit"
                className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer active:scale-95 shadow-sm"
              >
                Check Answer
              </button>
            </div>
          )}
        </form>

        {feedback !== "idle" && (
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border text-xs font-semibold flex flex-col gap-1.5 ${
              feedback === "correct"
                ? "border-green-300 bg-green-500/10 text-green-700 dark:text-green-350"
                : feedback === "hints_used"
                ? "border-yellow-300 bg-yellow-500/10 text-yellow-700 dark:text-yellow-350"
                : "border-red-300 bg-red-500/10 text-red-755 dark:text-red-350"
            }`}>
              <div className="flex items-center gap-2">
                {feedback === "correct" && (
                  <>
                    <Check className="w-5 h-5 text-green-500" />
                    <span>Spelled perfectly with no hints!</span>
                  </>
                )}
                {feedback === "hints_used" && (
                  <>
                    <Check className="w-5 h-5 text-yellow-500 animate-pulse" />
                    <span>Solved! But since you used hints, let&apos;s redo it at the end to memorize.</span>
                  </>
                )}
                {feedback === "incorrect" && (
                  <>
                    <X className="w-5 h-5 text-red-500" />
                    <span>Spelling incorrect. Try again or request a hint.</span>
                  </>
                )}
              </div>
              {feedback !== "incorrect" && (
                <span className="text-xs font-mono text-left block border-t pt-1.5 border-neutral-200 dark:border-neutral-800 mt-1">
                  Full word: <strong className="font-bold underline text-sm">{cleaned}</strong>
                </span>
              )}
            </div>

            {feedback !== "incorrect" && (
              <button
                type="button"
                onClick={handleL2Next}
                className="w-full bg-neutral-900 dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- STAGE 2 COMPLETED DASHBOARD ---
  if (state.currentStage === "level2_completed") {
    const hasImages = wordsWithImagesIndices.length >= 2;
    return (
      <div className="text-center py-10 max-w-md mx-auto space-y-6">
        <Award className="w-16 h-16 text-yellow-500 animate-bounce mx-auto" />
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-neutral-800 dark:text-neutral-205">Level 2 Completed!</h2>
          <p className="text-sm text-neutral-500">You earned the **Spelling Champ Badge 📝**! All spelling gap-fills completed successfully.</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 pt-4">
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, currentStage: "opt2_audio", opt2AudioCurrentIdx: 0 }))}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold text-sm transition shadow cursor-pointer active:scale-95"
          >
            Play Optional: Listen & Translate (Badge 🎧)
          </button>
          {hasImages && (
            <button
              type="button"
              onClick={() => setState(prev => ({ ...prev, currentStage: "opt2_image", opt2ImageCurrentIdx: 0 }))}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold text-sm transition shadow cursor-pointer active:scale-95"
            >
              Play Optional: Look & Write (Badge 📸)
            </button>
          )}
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, currentStage: "level3", level3Session: undefined }))}
            className="w-full bg-neutral-900 dark:bg-white dark:text-black text-white hover:bg-neutral-800 dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition shadow cursor-pointer active:scale-95"
          >
            Advance to Level 3: Lined Paper Exam 🎓
          </button>
        </div>
      </div>
    );
  }

  // --- STAGE 2.5A: OPTIONAL LISTEN & TRANSLATE ---
  if (state.currentStage === "opt2_audio") {
    const activeWordIdx = state.opt2AudioQueue[state.opt2AudioCurrentIdx];
    if (activeWordIdx === undefined) return null;
    const activeWord = vocabList[activeWordIdx];

    const handle2ASubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (feedback !== "idle") return;

      const isCorrect = checkVocabMatch(spellingInput, activeWord.translation);
      if (isCorrect) {
        setFeedback("correct");
      } else {
        setFeedback("incorrect");
      }
    };

    const handle2ANext = () => {
      const isCorrect = checkVocabMatch(spellingInput, activeWord.translation);
      setFeedback("idle");
      setSpellingInput("");

      setState(prev => {
        const newQueue = [...prev.opt2AudioQueue];
        let nextIdx = prev.opt2AudioCurrentIdx;

        if (isCorrect) {
          nextIdx++;
        } else {
          newQueue.push(activeWordIdx);
          nextIdx++;
        }

        const isCompleted = nextIdx >= newQueue.length;
        return {
          ...prev,
          opt2AudioQueue: newQueue,
          opt2AudioCurrentIdx: nextIdx,
          opt2AudioDone: isCompleted ? true : prev.opt2AudioDone,
          currentStage: isCompleted ? "level2_completed" : "opt2_audio"
        };
      });
    };

    return (
      <div className="space-y-6 max-w-md mx-auto py-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, currentStage: "level2_completed" }))}
            className="text-xs font-mono font-bold text-neutral-400 hover:text-neutral-600 underline"
          >
            Skip Optional
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <Volume2 className="w-4 h-4 text-purple-500 animate-pulse" />
            Audio Translator (Optional)
          </span>
        </div>

        <div className="p-8 border rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-neutral-250 dark:border-neutral-850 text-center space-y-4 shadow-sm flex flex-col items-center">
          <button
            type="button"
            onClick={() => handleSpeak(activeWord.word, false)}
            className="w-20 h-20 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 rounded-full flex items-center justify-center text-purple-700 shadow-md cursor-pointer transition active:scale-95 border border-purple-250 dark:border-purple-800"
          >
            <Volume2 className="w-10 h-10 animate-bounce" />
          </button>
          <div className="space-y-1">
            <span className="text-xs font-mono text-neutral-450 uppercase">Listen to the English word</span>
            <p className="text-xs text-neutral-400 font-bold">Translate it to German below!</p>
          </div>
        </div>

        <form onSubmit={handle2ASubmit} className="space-y-4">
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
            placeholder="Type German translation here..."
            className="w-full border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-950 text-center text-lg font-bold p-4 rounded-xl focus:border-purple-500 outline-none transition"
          />

          {feedback === "idle" && (
            <button
              type="submit"
              className="w-full bg-purple-650 hover:bg-purple-700 text-white py-4 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 shadow"
            >
              Verify Translation
            </button>
          )}
        </form>

        {feedback !== "idle" && (
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border text-xs font-semibold flex flex-col gap-1.5 ${
              feedback === "correct" ? "border-green-300 bg-green-500/10 text-green-700 dark:text-green-350" : "border-red-300 bg-red-500/10 text-red-750 dark:text-red-350"
            }`}>
              {feedback === "correct" ? (
                <span>Correct! Excellent translation!</span>
              ) : (
                <span>Incorrect. Translation was: <strong className="underline text-sm font-bold">{activeWord.translation}</strong>. Word rescheduled!</span>
              )}
            </div>
            <button
              type="button"
              onClick={handle2ANext}
              className="w-full bg-neutral-900 dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- STAGE 2.5B: OPTIONAL LOOK & WRITE ---
  if (state.currentStage === "opt2_image") {
    const activeWordIdx = state.opt2ImageQueue[state.opt2ImageCurrentIdx];
    if (activeWordIdx === undefined) return null;
    const activeWord = vocabList[activeWordIdx];
    const cleaned = cleanWordForPractice(activeWord.word);

    const handle2BSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (feedback !== "idle") return;

      const isCorrect = checkVocabMatch(spellingInput, cleaned);
      if (isCorrect) {
        setFeedback("correct");
        handleSpeak(activeWord.word, false);
      } else {
        setFeedback("incorrect");
      }
    };

    const handle2BNext = () => {
      const isCorrect = checkVocabMatch(spellingInput, cleaned);
      setFeedback("idle");
      setSpellingInput("");

      setState(prev => {
        const newQueue = [...prev.opt2ImageQueue];
        let nextIdx = prev.opt2ImageCurrentIdx;

        if (isCorrect) {
          nextIdx++;
        } else {
          newQueue.push(activeWordIdx);
          nextIdx++;
        }

        const isCompleted = nextIdx >= newQueue.length;
        return {
          ...prev,
          opt2ImageQueue: newQueue,
          opt2ImageCurrentIdx: nextIdx,
          opt2ImageDone: isCompleted ? true : prev.opt2ImageDone,
          currentStage: isCompleted ? "level2_completed" : "opt2_image"
        };
      });
    };

    return (
      <div className="space-y-6 max-w-md mx-auto py-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, currentStage: "level2_completed" }))}
            className="text-xs font-mono font-bold text-neutral-400 hover:text-neutral-600 underline"
          >
            Skip Optional
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <ImageIcon className="w-4 h-4" />
            Visual Speller (Optional)
          </span>
        </div>

        <div className="p-6 border rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-neutral-250 dark:border-neutral-850 text-center space-y-4 shadow-sm">
          {activeWord.image && (
            <div className="mx-auto w-48 h-48 rounded-xl overflow-hidden shadow border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
              <img
                src={`${assetsPath}${activeWord.image}`}
                alt="visual cue"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <span className="text-xs font-mono text-neutral-450 uppercase block">Write the English word for this picture:</span>
        </div>

        <form onSubmit={handle2BSubmit} className="space-y-4">
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
            placeholder="Type English word here..."
            className="w-full border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-950 text-center text-lg font-bold p-4 rounded-xl focus:border-purple-500 outline-none transition"
          />

          {feedback === "idle" && (
            <button
              type="submit"
              className="w-full bg-purple-650 hover:bg-purple-700 text-white py-4 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 shadow"
            >
              Check Spelling
            </button>
          )}
        </form>

        {feedback !== "idle" && (
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border text-xs font-semibold flex flex-col gap-1.5 ${
              feedback === "correct" ? "border-green-300 bg-green-500/10 text-green-700 dark:text-green-350" : "border-red-300 bg-red-500/10 text-red-750 dark:text-red-350"
            }`}>
              {feedback === "correct" ? (
                <span>Correct! Excellent visual recall!</span>
              ) : (
                <span>Incorrect. Spelling was: <strong className="underline text-sm font-bold">{cleaned}</strong>. Word rescheduled!</span>
              )}
            </div>
            <button
              type="button"
              onClick={handle2BNext}
              className="w-full bg-neutral-900 dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- STAGE 3: LEVEL 3 (PRINTED WORKSHEET EXAM) ---
  if (state.currentStage === "level3") {
    // Generate Level 3 session if not existing
    const session = state.level3Session || (() => {
      const totalWords = vocabList.length;
      // Sort words by incorrectCounts descending
      const sortedByErrors = vocabList
        .map((_, idx) => idx)
        .sort((a, b) => (state.incorrectCounts[b] || 0) - (state.incorrectCounts[a] || 0));

      const hardCount = Math.min(5, Math.floor(totalWords / 2));
      const hardIndices = sortedByErrors.slice(0, hardCount);
      const remainingIndices = sortedByErrors.slice(hardCount);

      // Take some random other words to fill up to 10-12
      const testSize = Math.min(12, totalWords);
      const randomCount = testSize - hardCount;
      const shuffledRemaining = seededShuffle(remainingIndices, 888);
      const selectedIndices = [...hardIndices, ...shuffledRemaining.slice(0, randomCount)];

      // Re-shuffle list so hard ones aren't grouped first
      const testIndices = seededShuffle(selectedIndices, 555);

      // Half the questions are en-to-de, other half de-to-en
      const enToDeCount = Math.min(5, Math.floor(testSize / 2));
      const questions = testIndices.map((wordIndex, i) => ({
        wordIndex,
        type: (i < enToDeCount ? "en-to-de" : "de-to-en") as "de-to-en" | "en-to-de",
      }));

      const initialAnswers: Record<number, string> = {};
      return {
        questions,
        answers: initialAnswers,
        submitted: false,
        graded: false,
      };
    })();

    // Ensure session is written into state immediately if generated
    if (!state.level3Session) {
      setState(prev => ({ ...prev, level3Session: session }));
      return null;
    }

    const handleAnswerChange = (idx: number, val: string) => {
      setState(prev => {
        if (!prev.level3Session) return prev;
        return {
          ...prev,
          level3Session: {
            ...prev.level3Session,
            answers: {
              ...prev.level3Session.answers,
              [idx]: val,
            }
          }
        };
      });
    };

    const handleExamSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      let correctCount = 0;
      session.questions.forEach((q, idx) => {
        const answer = session.answers[idx] || "";
        const targetWord = vocabList[q.wordIndex];
        const cleanedTarget = cleanWordForPractice(targetWord.word);
        
        let match = false;
        if (q.type === "de-to-en") {
          match = checkVocabMatch(answer, cleanedTarget);
        } else {
          match = checkVocabMatch(answer, targetWord.translation);
        }

        if (match) correctCount++;
      });

      const totalQs = session.questions.length;
      const pctScore = totalQs > 0 ? (correctCount / totalQs) * 100 : 0;

      // Find appropriate Grade and remark
      const gradeMatch = GRADE_SCHEME.find(g => pctScore >= g.min) || GRADE_SCHEME[GRADE_SCHEME.length - 1];
      const commentIdx = Math.floor(seededShuffle([0, 1, 2], pctScore)[0] % gradeMatch.remarks.length);
      const randomRemark = gradeMatch.remarks[commentIdx];

      setState(prev => {
        if (!prev.level3Session) return prev;
        return {
          ...prev,
          level3Score: pctScore,
          level3Grade: gradeMatch.grade,
          level3Remarks: randomRemark,
          level3Session: {
            ...prev.level3Session,
            submitted: true,
            graded: true,
          },
          currentStage: "level3_completed"
        };
      });
    };

    return (
      <div className="space-y-6 py-2">
        <style dangerouslySetInnerHTML={{ __html: `
          .worksheet-container {
            background-color: #fcfcf9;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border-radius: 1rem;
            position: relative;
            overflow: hidden;
            font-family: Arial, sans-serif;
          }
          .worksheet-paper {
            background-image: 
              linear-gradient(90deg, transparent 79px, #fda4af 79px, #fda4af 81px, transparent 81px),
              linear-gradient(#e2e8f0 1px, transparent 1px);
            background-size: 100% 100%, 100% 2.75rem;
            line-height: 2.75rem;
            padding-left: 95px;
            padding-right: 25px;
            padding-top: 1.375rem;
            padding-bottom: 2.75rem;
          }
          .worksheet-line {
            min-height: 2.75rem;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            border-bottom: 1px solid transparent;
          }
          .worksheet-input {
            border-bottom: 1.5px dashed #94a3b8;
            border-top: none;
            border-left: none;
            border-right: none;
            background: transparent;
            font-family: 'Kalam', 'Caveat', cursive;
            color: #1e3a8a;
            font-size: 1.3rem;
            height: 2.2rem;
            width: 200px;
            padding: 0 0.5rem;
            outline: none;
            transition: all 0.2s;
          }
          .worksheet-input:focus {
            border-bottom: 2px solid #3b82f6;
          }
        ` }} />

        <div className="text-center space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-red-500">
            <BookOpen className="w-4 h-4 animate-pulse" />
            Level 3 — Printed Lined Paper Exam
          </span>
          <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider">Complete all questions on the page and submit!</p>
        </div>

        <form onSubmit={handleExamSubmit} className="space-y-6">
          <div className="worksheet-container">
            <div className="worksheet-paper space-y-0.5">
              <div className="text-xs font-mono text-neutral-400 border-b pb-2 mb-4 leading-normal">
                NAME: <span className="font-bold border-b border-neutral-300 px-4 py-0.5">STUDENT</span>
                <span className="ml-6">DATE: <span className="font-bold border-b border-neutral-300 px-4 py-0.5">{new Date().toLocaleDateString()}</span></span>
              </div>
              
              {session.questions.map((q, idx) => {
                const targetWord = vocabList[q.wordIndex];
                const cleanedTarget = cleanWordForPractice(targetWord.word);
                const answer = session.answers[idx] || "";

                return (
                  <div key={idx} className="worksheet-line py-1 text-sm md:text-base text-neutral-700">
                    <span className="font-bold w-48 truncate mr-2 select-none">
                      {idx + 1}. {q.type === "de-to-en" ? targetWord.translation : cleanedTarget} &rarr;
                    </span>
                    <input
                      type="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={answer}
                      onChange={(e) => handleAnswerChange(idx, e.target.value)}
                      placeholder="..."
                      className="worksheet-input flex-1 min-w-[150px]"
                    />
                    {targetWord.image && q.type === "de-to-en" && (
                      <span className="text-xl ml-2 select-none" title="Picture available">🖼️</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-red-650 hover:bg-red-700 text-white py-4.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 shadow-md flex items-center justify-center gap-1.5"
          >
            Submit Exam & Grade <Check className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  // --- STAGE 3 COMPLETED (GRADES, REMARKS & CORRECTIVE OVERLAY) ---
  if (state.currentStage === "level3_completed") {
    const session = state.level3Session;
    if (!session) return null;

    // SVG Drawn Smiley representation
    const renderDrawnSmiley = () => {
      const g = state.level3Grade || "F";
      let color = "stroke-green-500 text-green-500";
      if (["C", "D"].includes(g)) color = "stroke-yellow-500 text-yellow-500";
      if (["E", "F"].includes(g)) color = "stroke-red-500 text-red-500";

      return (
        <div className="flex flex-col items-center gap-2">
          {["A", "B"].includes(g) && (
            <svg viewBox="0 0 100 100" className={`w-20 h-20 fill-none stroke-[5] stroke-linecap-round ${color}`}>
              <circle cx="50" cy="50" r="40" className="opacity-80" />
              <path d="M 33 40 Q 37 38 41 40" />
              <path d="M 59 40 Q 63 38 67 40" />
              <path d="M 32 60 Q 50 82 68 60" />
            </svg>
          )}
          {["C", "D"].includes(g) && (
            <svg viewBox="0 0 100 100" className={`w-20 h-20 fill-none stroke-[5] stroke-linecap-round ${color}`}>
              <circle cx="50" cy="50" r="40" className="opacity-80" />
              <circle cx="37" cy="42" r="3" fill="currentColor" />
              <circle cx="63" cy="42" r="3" fill="currentColor" />
              <line x1="32" y1="62" x2="68" y2="62" />
            </svg>
          )}
          {["E", "F"].includes(g) && (
            <svg viewBox="0 0 100 100" className={`w-20 h-20 fill-none stroke-[5] stroke-linecap-round ${color}`}>
              <circle cx="50" cy="50" r="40" className="opacity-80" />
              <circle cx="37" cy="42" r="3" fill="currentColor" />
              <circle cx="63" cy="42" r="3" fill="currentColor" />
              <path d="M 32 68 Q 50 50 68 68" />
              <path d="M 35 48 Q 33 58 35 62" className="stroke-blue-400 stroke-2" />
            </svg>
          )}
          <span className="text-xs font-mono font-bold text-neutral-450 uppercase tracking-widest">Pupil State</span>
        </div>
      );
    };

    return (
      <div className="space-y-8 py-2">
        <style dangerouslySetInnerHTML={{ __html: `
          .worksheet-container {
            background-color: #fcfcf9;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border-radius: 1rem;
            position: relative;
            overflow: hidden;
            font-family: Arial, sans-serif;
          }
          .worksheet-paper-graded {
            background-image: 
              linear-gradient(90deg, transparent 79px, #fda4af 79px, #fda4af 81px, transparent 81px),
              linear-gradient(#e2e8f0 1px, transparent 1px);
            background-size: 100% 100%, 100% 2.75rem;
            line-height: 2.75rem;
            padding-left: 95px;
            padding-right: 25px;
            padding-top: 1.375rem;
            padding-bottom: 2.75rem;
          }
          .worksheet-line {
            min-height: 2.75rem;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            border-bottom: 1px solid transparent;
          }
          .graded-correct {
            font-family: 'Kalam', 'Caveat', cursive;
            color: #1d4ed8;
            font-size: 1.35rem;
            text-decoration: none;
            padding: 0 0.5rem;
          }
          .graded-incorrect {
            font-family: 'Kalam', 'Caveat', cursive;
            color: #ef4444;
            font-size: 1.35rem;
            text-decoration: line-through;
            padding: 0 0.5rem;
            opacity: 0.8;
          }
          .correction-red {
            font-family: 'Kalam', 'Caveat', cursive;
            color: #dc2626;
            font-size: 1.35rem;
            font-weight: bold;
            margin-left: 1rem;
            animation: fadeIn 0.3s ease-out;
          }
          .exam-stamp {
            position: absolute;
            top: 25px;
            right: 40px;
            border: 4px double #ef4444;
            border-radius: 50%;
            width: 75px;
            height: 75px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ef4444;
            font-family: 'Kalam', 'Caveat', cursive;
            font-size: 2.25rem;
            font-weight: bold;
            transform: rotate(-15deg);
            background: rgba(254, 242, 242, 0.4);
            user-select: none;
            z-index: 10;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateX(5px); }
            to { opacity: 1; transform: translateX(0); }
          }
        ` }} />

        {/* Report Card Banner */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex flex-col items-center md:items-start space-y-1.5">
            <span className="text-[10px] font-mono font-bold text-neutral-450 uppercase tracking-widest block">Exam Result</span>
            <div className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">Grade: {state.level3Grade}</div>
            <div className="text-xs font-mono font-semibold bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 px-3 py-1 rounded-full border border-green-200/50">
              Exam Score: {state.level3Score?.toFixed(0)}%
            </div>
          </div>
          <div className="text-center italic text-sm text-neutral-600 dark:text-neutral-350 px-2 leading-relaxed font-semibold border-y md:border-y-0 md:border-x py-3 md:py-0 border-neutral-200 dark:border-neutral-800">
            &ldquo;{state.level3Remarks}&rdquo;
          </div>
          <div className="flex justify-center">
            {renderDrawnSmiley()}
          </div>
        </div>

        {/* Marked Worksheet paper */}
        <div className="worksheet-container">
          <div className="exam-stamp">{state.level3Grade}</div>
          <div className="worksheet-paper-graded space-y-0.5">
            <div className="text-xs font-mono text-neutral-400 border-b pb-2 mb-4 leading-normal select-none">
              NAME: <span className="font-bold border-b border-neutral-300 px-4 py-0.5">STUDENT</span>
              <span className="ml-6">DATE: <span className="font-bold border-b border-neutral-300 px-4 py-0.5">{new Date().toLocaleDateString()}</span></span>
            </div>

            {session.questions.map((q, idx) => {
              const targetWord = vocabList[q.wordIndex];
              const cleanedTarget = cleanWordForPractice(targetWord.word);
              const answer = session.answers[idx] || "";
              
              let match = false;
              if (q.type === "de-to-en") {
                match = checkVocabMatch(answer, cleanedTarget);
              } else {
                match = checkVocabMatch(answer, targetWord.translation);
              }

              return (
                <div key={idx} className="worksheet-line py-1 text-sm md:text-base text-neutral-700">
                  <span className="font-bold w-48 truncate mr-2 select-none">
                    {idx + 1}. {q.type === "de-to-en" ? targetWord.translation : cleanedTarget} &rarr;
                  </span>
                  
                  {match ? (
                    <>
                      <span className="graded-correct">{answer || "(blank)"}</span>
                      <span className="text-green-600 font-bold ml-2 text-xs select-none">✓</span>
                    </>
                  ) : (
                    <>
                      <span className="graded-incorrect">{answer || "(blank)"}</span>
                      <span className="text-red-500 font-bold ml-2 text-xs select-none">✗</span>
                      <span className="correction-red">
                        {q.type === "de-to-en" ? cleanedTarget : targetWord.translation}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Proceed to AI Mastery Challenge or restart */}
        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => {
              setState(prev => ({
                ...prev,
                currentStage: "opt3_ai",
                opt3AICurrentIdx: 0,
                opt3AIDone: false,
              }));
              setAiDefinition(null);
            }}
            className="w-full bg-purple-650 hover:bg-purple-700 text-white py-4.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 shadow flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5 text-yellow-300 animate-pulse" /> Unlock Gold Trophy: AI Definition Challenge 🏆
          </button>

          <button
            type="button"
            onClick={() => setState(prev => ({
              ...prev,
              currentStage: "level3",
              level3Session: undefined,
              level3Score: undefined,
              level3Grade: undefined,
              level3Remarks: undefined
            }))}
            className="w-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-350 py-3.5 rounded-xl font-mono text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Retake Exam
          </button>
        </div>
      </div>
    );
  }

  // --- STAGE 4: OPTIONAL FINAL (AI DEFINITION MASTERY) ---
  if (state.currentStage === "opt3_ai") {
    const activeWordIdx = state.opt3AIQueue[state.opt3AICurrentIdx];
    if (activeWordIdx === undefined) {
      // Completed definitions
      return (
        <div className="text-center py-10 max-w-md mx-auto space-y-6">
          <Trophy className="w-20 h-20 text-yellow-500 animate-bounce mx-auto" />
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-neutral-800 dark:text-neutral-200">AI Definition Master!</h2>
            <p className="text-sm text-neutral-550">Incredible achievement! You decoded all AI-generated lexical definitions and earned the Gold Trophy Badge 🏆!</p>
          </div>
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, currentStage: "level3_completed" }))}
            className="w-full bg-neutral-900 dark:bg-white dark:text-black text-white hover:bg-neutral-800 dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition shadow cursor-pointer active:scale-95"
          >
            Back to Exam Review
          </button>
        </div>
      );
    }
    const activeWord = vocabList[activeWordIdx];
    const cleaned = cleanWordForPractice(activeWord.word);

    const handleAISubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (feedback !== "idle") return;

      const isCorrect = checkVocabMatch(spellingInput, cleaned);
      if (isCorrect) {
        setFeedback("correct");
        handleSpeak(activeWord.word, false);
      } else {
        setFeedback("incorrect");
      }
    };

    const handleAINext = () => {
      const isCorrect = checkVocabMatch(spellingInput, cleaned);
      setFeedback("idle");
      setSpellingInput("");

      setState(prev => {
        const newQueue = [...prev.opt3AIQueue];
        let nextIdx = prev.opt3AICurrentIdx;

        if (isCorrect) {
          nextIdx++;
        } else {
          newQueue.push(activeWordIdx);
          nextIdx++;
        }

        const isCompleted = nextIdx >= newQueue.length;
        return {
          ...prev,
          opt3AIQueue: newQueue,
          opt3AICurrentIdx: nextIdx,
          opt3AIDone: isCompleted ? true : prev.opt3AIDone,
          currentStage: isCompleted ? "level3_completed" : "opt3_ai" // completed redirects back to exam review
        };
      });
    };

    return (
      <div className="space-y-6 max-w-md mx-auto py-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setState(prev => ({ ...prev, currentStage: "level3_completed" }))}
            className="text-xs font-mono font-bold text-neutral-400 hover:text-neutral-600 underline animate-pulse"
          >
            Skip Optional Challenge
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            <Sparkles className="w-4 h-4 text-purple-500 animate-spin" />
            AI Definition Mastery
          </span>
        </div>

        <div className="p-6 border rounded-2xl bg-gradient-to-br from-purple-50/20 to-indigo-50/20 dark:from-purple-950/5 dark:to-indigo-950/5 border-neutral-250 dark:border-neutral-850 text-center min-h-[160px] flex flex-col justify-center shadow-sm">
          {definitionLoading ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
              <p className="text-xs font-mono text-neutral-450 uppercase tracking-widest">AI is writing definition...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <span className="text-[10px] font-mono text-purple-500 dark:text-purple-400 uppercase tracking-widest font-bold block">Guess the word based on this definition:</span>
              <p className="text-lg font-medium text-neutral-800 dark:text-neutral-200 leading-relaxed italic">
                &ldquo;{aiDefinition}&rdquo;
              </p>
            </div>
          )}
        </div>

        {!definitionLoading && (
          <form onSubmit={handleAISubmit} className="space-y-4">
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
              placeholder="What is the English word?"
              className="w-full border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-950 text-center text-lg font-bold p-4 rounded-xl focus:border-purple-500 outline-none transition shadow-sm"
            />

            {feedback === "idle" && (
              <button
                type="submit"
                className="w-full bg-purple-650 hover:bg-purple-700 text-white py-4 rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 shadow"
              >
                Submit Vocabulary Guess
              </button>
            )}
          </form>
        )}

        {feedback !== "idle" && (
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border text-xs font-semibold flex flex-col gap-1.5 ${
              feedback === "correct" ? "border-green-300 bg-green-500/10 text-green-700 dark:text-green-350" : "border-red-300 bg-red-500/10 text-red-750 dark:text-red-350"
            }`}>
              {feedback === "correct" ? (
                <span>Perfect match! You mastered this lexical item.</span>
              ) : (
                <span>Not quite. The correct spelling was: <strong className="underline text-sm font-bold">{cleaned}</strong>. Word rescheduled!</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleAINext}
              className="w-full bg-neutral-900 dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 py-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Fallback / Loading
  return (
    <div className="space-y-6">
      {renderBadgesHeader()}
      {renderProgressBar()}
      <div className="text-center py-6 text-neutral-500 italic">
        Loading stage...
      </div>
    </div>
  );
};

export default Vocabulary;
