"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { submitAssignment } from "@/lib/actions/submission";
import { rateExerciseAction } from "@/lib/actions/exercise";
import { generateMasteryMeme } from "@/lib/actions/ai-meme";
import { WIDGET_REGISTRY } from "@/components/widgets";
import type { ExerciseData } from "@/lib/exercises";
import { ArrowLeft, Check, AlertTriangle, ArrowRight, RotateCcw, Headphones, Volume2, Star } from "lucide-react";
import { MediaEmbed } from "@/components/widgets/MediaEmbed";
import Link from "next/link";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";
import WidgetErrorBoundary from "@/components/widgets/WidgetErrorBoundary";
import { getTaskMaxPoints } from "@/lib/points";
import { scoreQuestionByType } from "@/lib/submissionScoring";

export { getTaskMaxPoints } from "@/lib/points";

interface WorksheetQuestionData {
  id: string;
  type: string;
  question?: string;
  options?: string[];
  correctOptionIndex?: number;
  text?: string;
  categories?: string[];
  items?: Array<{ id?: string; name: string; category: string }>;
  choices?: string[];
  statements?: Array<{ text: string; correctChoice: string }>;
  pairs?: Array<{ id: string; leftText?: string; leftMedia?: string; rightText: string }>;
  media?: string;
  hint?: string;
  keywords?: string[];
  elements?: string[];
  [key: string]: unknown;
}

interface AssignmentPlayerProps {
  assignmentId: string;
  exercise?: ExerciseData;
  exerciseJson?: string;
  assetsPath: string;
  savedAnswers?: Record<string, unknown> | null;
  savedAnswersJson?: string;
  role: "STUDENT" | "TEACHER";
  attemptNumber?: number;      // 1-indexed: what this submission will be recorded as
  multiplier?: number;         // score multiplier for this attempt (1.0, 0.75, 0.5, 0.25)
  priorAttemptCount?: number;  // how many submissions already exist
  dueDate?: string;
}

interface WorksheetQuestionRowProps {
  q: WorksheetQuestionData;
  index: number;
  ChildWidget: React.ComponentType<{
    config: Record<string, unknown>;
    assetsPath: string;
    savedState: unknown;
    onChange: (state: unknown, complete: boolean, score: number) => void;
  }>;
  assetsPath: string;
  savedAnswers: Record<string, unknown> | null | undefined;
  handleChildChange: (qId: string, state: unknown, complete: boolean, score: number) => void;
}

const WorksheetQuestionRow: React.FC<WorksheetQuestionRowProps> = ({
  q,
  index,
  ChildWidget,
  assetsPath,
  savedAnswers,
  handleChildChange,
}) => {
  const handleWidgetChange = useCallback((state: unknown, complete: boolean, score: number) => {
    handleChildChange(q.id, state, complete, score);
  }, [q.id, handleChildChange]);

  const adaptedConfig = useMemo(() => {
    const base: Record<string, unknown> = {
      ...q,
      id: q.id,
      title: q.question || `${q.type} task`,
      type: q.type,
    };

    if (q.type === "multiple-choice") {
      base.questions = [
        {
          id: q.id,
          question: q.question || "",
          options: q.options || [],
          correctOptionIndex: q.correctOptionIndex ?? 0,
        },
      ];
    } else if (q.type === "gap-fill" || q.type === "drag-drop") {
      base.text = q.text || "";
    } else if (q.type === "categorization") {
      base.categories = q.categories || [];
      base.items = q.items || [];
    } else if (q.type === "clickable-choice") {
      base.choices = q.choices || [];
      base.statements = q.statements || [];
    } else if (q.type === "matching") {
      base.pairs = q.pairs || [];
    } else if (q.type === "media") {
      base.media = q.media || "";
    } else if (q.type === "instruction") {
      base.text = q.text || "";
    } else if (q.type === "open-question") {
      base.question = q.question || "";
      base.keywords = q.keywords || [];
    } else if (q.type === "ordering") {
      base.question = q.question || "";
      base.elements = q.elements || [];
    }
    return base;
  }, [q]);

  return (
    <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-350">
            Question {index + 1}
          </span>
          <span className="text-[10px] font-mono uppercase text-neutral-450">
            {getExerciseTypeLabel(q.type)}
          </span>
        </div>

        {q.type !== "media" && q.type !== "instruction" && (
          <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
            Points: {getTaskMaxPoints(q)}
          </span>
        )}
      </div>

      {q.media && q.type !== "media" && (
        <div className="max-w-md my-2">
          <MediaEmbed src={q.media} assetsPath={assetsPath} />
        </div>
      )}

      <ChildWidget
        config={adaptedConfig}
        assetsPath={assetsPath}
        savedState={savedAnswers?.[q.id]}
        onChange={handleWidgetChange}
      />

      {/* Hint disclosure */}
      {q.hint && (
        <div className="mt-2 text-xs pt-2 border-t border-neutral-100 dark:border-neutral-850">
          <details className="cursor-pointer text-neutral-550 hover:text-black dark:hover:text-white transition">
            <summary className="font-semibold select-none font-mono">💡 Need a hint?</summary>
            <div className="mt-1.5 p-2 bg-amber-50/20 dark:bg-amber-955/10 border border-amber-250/30 rounded font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
              {q.hint}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

function isQuestionStateComplete(type: string, state: any): boolean {
  if (state === undefined || state === null) return false;
  if (type === "multiple-choice") {
    return state.answers !== undefined && Object.keys(state.answers).length > 0;
  }
  if (type === "gap-fill") {
    return state.answers !== undefined && Object.keys(state.answers).length > 0;
  }
  if (type === "drag-drop") {
    return state.placements !== undefined && Object.keys(state.placements).length > 0;
  }
  if (type === "categorization") {
    return state.placements !== undefined && Object.keys(state.placements).length > 0;
  }
  if (type === "matching") {
    return state.matches !== undefined && Object.keys(state.matches).length > 0;
  }
  if (type === "clickable-choice") {
    return state.selections !== undefined && Object.keys(state.selections).length > 0;
  }
  if (type === "ordering") {
    return state.placed !== undefined && Array.isArray(state.placed) && state.placed.length > 0;
  }
  if (type === "open-question") {
    return !!(state.response?.trim() || state.audioUrl || state.imageUrl);
  }
  return true;
}

export default function AssignmentPlayer({
  assignmentId,
  exercise: initialExercise,
  exerciseJson,
  assetsPath,
  savedAnswers: initialSavedAnswers,
  savedAnswersJson,
  role,
  attemptNumber = 1,
  multiplier = 1.0,
  priorAttemptCount = 0,
  dueDate,
}: AssignmentPlayerProps) {
  const router = useRouter();
  const startTimeRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  const exercise = useMemo(() => {
    if (exerciseJson) {
      try {
        return JSON.parse(exerciseJson) as ExerciseData;
      } catch (e) {
        console.error("Failed to parse exerciseJson:", e);
      }
    }
    return initialExercise!;
  }, [initialExercise, exerciseJson]);

  const savedAnswers = useMemo(() => {
    if (savedAnswersJson) {
      try {
        return JSON.parse(savedAnswersJson) as Record<string, unknown>;
      } catch (e) {
        console.error("Failed to parse savedAnswersJson:", e);
      }
    }
    return initialSavedAnswers;
  }, [initialSavedAnswers, savedAnswersJson]);

  const flatQuestions = useMemo(() => {
    if (exercise.type === "worksheet") {
      if (Array.isArray(exercise.pages)) {
        return exercise.pages.flatMap((p: { questions?: WorksheetQuestionData[] }) => p.questions || []);
      }
      return (exercise.questions as WorksheetQuestionData[]) || [];
    }
    return [];
  }, [exercise]);

  const isPastDue = useMemo(() => {
    if (!dueDate) return false;
    return new Date() > new Date(dueDate);
  }, [dueDate]);

  // Pre-calculate initial child completions, scores, total score and completeness
  const initialChildState = useMemo(() => {
    let restoredState: Record<string, unknown> | null = null;
    let isRedo = false;
    if (typeof window !== "undefined") {
      isRedo = new URLSearchParams(window.location.search).get("redo") === "true";
      if (isRedo) {
        localStorage.removeItem(`draft_${assignmentId}`);
      } else {
        const saved = localStorage.getItem(`draft_${assignmentId}`);
        if (saved) {
          try {
            restoredState = JSON.parse(saved);
          } catch {
            // ignore
          }
        }
      }
    }
    if (!restoredState && !isRedo) {
      restoredState = savedAnswers || null;
    }

    const completions: Record<string, boolean> = {};
    const scores: Record<string, number> = {};

    if (restoredState && exercise.type === "worksheet") {
      flatQuestions.forEach((q: WorksheetQuestionData) => {
        if (q.type === "media" || q.type === "instruction") return;
        const qState = restoredState?.[q.id];
        if (qState !== undefined && qState !== null) {
          const score = scoreQuestionByType(q as any, qState);
          scores[q.id] = score;
          completions[q.id] = isQuestionStateComplete(q.type, qState);
        } else {
          completions[q.id] = false;
          scores[q.id] = 0;
        }
      });
    }

    return { restoredState, completions, scores };
  }, [savedAnswers, exercise, flatQuestions, assignmentId]);

  // Widget state variables
  const [widgetState, setWidgetState] = useState<Record<string, unknown> | null>(() => initialChildState.restoredState || (exercise.type === "worksheet" ? {} : null));
  const [childCompletions, setChildCompletions] = useState<Record<string, boolean>>(() => initialChildState.completions);
  const [childScores, setChildScores] = useState<Record<string, number>>(() => initialChildState.scores);

  const [score, setScore] = useState(() => {
    if (exercise.type === "worksheet") {
      let totalMax = 0;
      let totalEarned = 0;
      flatQuestions.forEach((q: WorksheetQuestionData) => {
        const maxPts = getTaskMaxPoints(q);
        const childPct = initialChildState.scores[q.id] ?? 0;
        totalMax += maxPts;
        totalEarned += (childPct / 100) * maxPts;
      });
      return totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
    }
    return 0;
  });

  const [isComplete, setIsComplete] = useState(() => {
    if (exercise.type === "worksheet") {
      return flatQuestions.every((q: WorksheetQuestionData) => {
        if (q.type === "media" || q.type === "instruction") return true;
        return initialChildState.completions[q.id] === true;
      });
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window !== "undefined" && role === "STUDENT" && widgetState) {
      localStorage.setItem(`draft_${assignmentId}`, JSON.stringify(widgetState));
    }
  }, [widgetState, assignmentId, role]);

  // --- Biophilic Focus Mode States & Web Audio API Generator ---
  const [focusMode, setFocusMode] = useState<"off" | "binaural" | "rain">("off");
  const [focusVolume, setFocusVolume] = useState<number>(0.3);

  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const nodesRef = React.useRef<{
    oscL?: OscillatorNode;
    oscR?: OscillatorNode;
    noiseSource?: AudioBufferSourceNode;
    lfo?: OscillatorNode;
    masterGain?: GainNode;
  } | null>(null);

  const cleanupAudio = useCallback(() => {
    if (nodesRef.current) {
      try {
        nodesRef.current.oscL?.stop();
      } catch {}
      try {
        nodesRef.current.oscR?.stop();
      } catch {}
      try {
        nodesRef.current.noiseSource?.stop();
      } catch {}
      try {
        nodesRef.current.lfo?.stop();
      } catch {}
      nodesRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        if (audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close();
        }
      } catch {}
      audioCtxRef.current = null;
    }
  }, []);

  const initAudio = useCallback((mode: "binaural" | "rain", vol: number) => {
    cleanupAudio();

    if (typeof window === "undefined") return;
    const AudioCtxClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;

    try {
      const audioCtx = new AudioCtxClass();
      audioCtxRef.current = audioCtx;

      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      const nodes: typeof nodesRef.current = { masterGain };

      if (mode === "binaural") {
        // 10Hz Binaural differential (carrier 200Hz L / 210Hz R)
        const merger = audioCtx.createChannelMerger(2);

        const oscL = audioCtx.createOscillator();
        oscL.type = "sine";
        oscL.frequency.setValueAtTime(200, audioCtx.currentTime);

        const oscR = audioCtx.createOscillator();
        oscR.type = "sine";
        oscR.frequency.setValueAtTime(210, audioCtx.currentTime);

        const gainL = audioCtx.createGain();
        const gainR = audioCtx.createGain();
        gainL.gain.setValueAtTime(0.55, audioCtx.currentTime);
        gainR.gain.setValueAtTime(0.55, audioCtx.currentTime);

        oscL.connect(gainL);
        oscR.connect(gainR);

        gainL.connect(merger, 0, 0);
        gainR.connect(merger, 0, 1);

        merger.connect(masterGain);

        oscL.start();
        oscR.start();

        nodes.oscL = oscL;
        nodes.oscR = oscR;
      } else if (mode === "rain") {
        // Synthesizing organic cozy rain/wind using Pink-ish noise buffer
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        // Populate white noise
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        // Apply lowpass filter to make it soft like rain
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(700, audioCtx.currentTime);

        // LFO (0.08Hz) to modulate the volume dynamically for breeze/gust wind fluctuations
        const lfo = audioCtx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.08, audioCtx.currentTime);

        const lfoGain = audioCtx.createGain();
        lfoGain.gain.setValueAtTime(0.2, audioCtx.currentTime);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.5, audioCtx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(noiseGain.gain);

        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);

        lfo.start();
        noiseSource.start();

        nodes.noiseSource = noiseSource;
        nodes.lfo = lfo;
      }

      nodesRef.current = nodes;

      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    } catch (err) {
      console.error("Web Audio initialization failure:", err);
    }
  }, [cleanupAudio]);

  React.useEffect(() => {
    if (focusMode === "off") {
      cleanupAudio();
    } else {
      initAudio(focusMode, focusVolume);
    }
  }, [focusMode, initAudio, cleanupAudio, focusVolume]);

  React.useEffect(() => {
    if (nodesRef.current?.masterGain && audioCtxRef.current) {
      nodesRef.current.masterGain.gain.setValueAtTime(focusVolume, audioCtxRef.current.currentTime);
    }
  }, [focusVolume]);

  React.useEffect(() => {
    if (focusMode !== "off") {
      document.body.classList.add("focus-mode-active");
    } else {
      document.body.classList.remove("focus-mode-active");
    }
    return () => {
      document.body.classList.remove("focus-mode-active");
    };
  }, [focusMode]);

  React.useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // --- AI Mastery Meme States & Action triggers ---
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [unwrappedMeme, setUnwrappedMeme] = useState(false);
  const [loadingMeme, setLoadingMeme] = useState(false);
  const [memeData, setMemeData] = useState<{ text: string; imageUrl: string } | null>(null);
  const [memeError, setMemeError] = useState<string | null>(null);

  // Student feedback states
  const [ratingStars, setRatingStars] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const feedbackTagsSuggestions = ["Easy", "Difficult", "Fun", "Boring", "Confusing", "Helpful", "Clear", "Too Long"];

  const handleUnwrapMeme = useCallback(async () => {
    setLoadingMeme(true);
    setMemeError(null);
    setUnwrappedMeme(true);
    try {
      const res = await generateMasteryMeme(exercise.title || "English Learning", submissionId);
      if (res.success && res.text && res.imageUrl) {
        setMemeData({ text: res.text, imageUrl: res.imageUrl });
      } else {
        setMemeError(res.error || "Failed to load meme");
      }
    } catch {
      setMemeError("An error occurred loading the meme.");
    } finally {
      setLoadingMeme(false);
    }
  }, [exercise.title, submissionId]);


  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitScore, setSubmitScore] = useState<number | null>(null);
  const [submitEffectiveScore, setSubmitEffectiveScore] = useState<number | null>(null);
  const [submitAttemptNumber, setSubmitAttemptNumber] = useState<number>(attemptNumber);
  const [submitMultiplier, setSubmitMultiplier] = useState<number>(multiplier);
  const [error, setError] = useState<string | null>(null);

  const Widget = exercise.type !== "worksheet" && exercise.type !== "image-hotspot-quiz" && exercise.type !== "interactive-reading"
    ? WIDGET_REGISTRY[exercise.type as keyof typeof WIDGET_REGISTRY]
    : null;

  const enforceGate = exercise.type === "worksheet" ? !!exercise.enforceGate : false;
  const gateRequiredScore = exercise.type === "worksheet" ? (exercise.gateRequiredScore ?? 75) : 75;

  const handleWidgetChange = useCallback((state: unknown, complete: boolean, currentScore: number) => {
    setWidgetState(state as Record<string, unknown> | null);
    setIsComplete(complete);
    setScore(currentScore);
  }, []);



  const pages = useMemo(() => {
    if (exercise.type === "worksheet") {
      if (Array.isArray(exercise.pages) && exercise.pages.length > 0) {
        return exercise.pages as Array<{ id: string; title?: string; questions: WorksheetQuestionData[] }>;
      }
      return [
        {
          id: "legacy-page-1",
          title: "Worksheet",
          questions: (exercise.questions as WorksheetQuestionData[]) || [],
        },
      ];
    }
    return [
      {
        id: "legacy-page-1",
        title: "Worksheet",
        questions: [],
      },
    ];
  }, [exercise]);

  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [gateAlertVisible, setGateAlertVisible] = useState(false);
  const currentPage = pages[currentPageIdx];



  const isCurrentPageComplete = useMemo(() => {
    if (!currentPage?.questions) return true;
    return currentPage.questions.every((q: WorksheetQuestionData) => {
      if (q.type === "media" || q.type === "instruction") return true;
      return childCompletions[q.id];
    });
  }, [currentPage, childCompletions]);

  const currentPageScore = useMemo(() => {
    if (!currentPage?.questions) return 0;
    let pageMax = 0;
    let pageEarned = 0;
    currentPage.questions.forEach((q: WorksheetQuestionData) => {
      const maxPts = getTaskMaxPoints(q);
      const childPct = childScores[q.id] ?? 0;
      pageMax += maxPts;
      pageEarned += (childPct / 100) * maxPts;
    });
    return pageMax > 0 ? (pageEarned / pageMax) * 100 : 0;
  }, [currentPage, childScores]);

  const handleNextPage = () => {
    if (!isCurrentPageComplete) {
      alert("Please complete all tasks on this page first.");
      return;
    }
    if (enforceGate && currentPageScore < gateRequiredScore) {
      setGateAlertVisible(true);
      return;
    }
    setGateAlertVisible(false);
    setCurrentPageIdx((prev) => Math.min(pages.length - 1, prev + 1));
  };

  const handlePrevPage = () => {
    setGateAlertVisible(false);
    setCurrentPageIdx((prev) => Math.max(0, prev - 1));
  };

  const resetCurrentPage = () => {
    if (!currentPage?.questions) return;
    setWidgetState((prev: Record<string, unknown> | null) => {
      const next = { ...(prev || {}) };
      currentPage.questions.forEach((q: WorksheetQuestionData) => {
        delete next[q.id];
      });
      return next;
    });
    setChildCompletions((prev: Record<string, boolean>) => {
      const next = { ...prev };
      currentPage.questions.forEach((q: WorksheetQuestionData) => {
        next[q.id] = false;
      });
      return next;
    });
    setChildScores((prev: Record<string, number>) => {
      const next = { ...prev };
      currentPage.questions.forEach((q: WorksheetQuestionData) => {
        next[q.id] = 0;
      });
      return next;
    });
    setGateAlertVisible(false);
  };

  const handleChildChange = useCallback((qId: string, childState: unknown, childComplete: boolean, childScore: number) => {
    setGateAlertVisible(false);
    setWidgetState((prev: Record<string, unknown> | null) => ({ ...(prev || {}), [qId]: childState }));

    setChildCompletions((prev) => {
      const next = { ...prev, [qId]: childComplete };
      if (exercise.type === "worksheet") {
        const allComplete = flatQuestions.every((q: WorksheetQuestionData) => {
          if (q.type === "media" || q.type === "instruction") return true;
          return next[q.id];
        });
        setIsComplete(allComplete);
      }
      return next;
    });

    setChildScores((prev) => {
      const next = { ...prev, [qId]: childScore };
      if (exercise.type === "worksheet") {
        let totalMax = 0;
        let totalEarned = 0;
        flatQuestions.forEach((q: WorksheetQuestionData) => {
          const maxPts = getTaskMaxPoints(q);
          const childPct = next[q.id] ?? 0;
          totalMax += maxPts;
          totalEarned += (childPct / 100) * maxPts;
        });
        const avgScore = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
        setScore(avgScore);
      }
      return next;
    });
  }, [flatQuestions, exercise.type]);

  const handleSubmit = async () => {
    if (role === "TEACHER") {
      router.push("/teacher");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
      const res = await submitAssignment(assignmentId, widgetState, score, duration);
      if (res?.error) {
        setError(res.error);
      } else {
        if (typeof window !== "undefined") {
          localStorage.removeItem(`draft_${assignmentId}`);
        }
        setSubmissionId(res?.id || null);
        setSubmitted(true);
        setSubmitScore(res?.score ?? score);
        setSubmitEffectiveScore(res?.effectiveScore ?? score * multiplier);
        setSubmitAttemptNumber(res?.attemptNumber ?? attemptNumber);
        setSubmitMultiplier(res?.multiplier ?? multiplier);
        router.refresh();
      }
    } catch {
      setError("An error occurred during submission.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    const effectivePct = submitEffectiveScore?.toFixed(0) ?? "0";
    const rawPct = submitScore?.toFixed(0) ?? "0";
    const pct = Math.round(submitMultiplier * 100);
    const isFullMarks = submitMultiplier === 1.0;

    const isVisualEnhancementEnabled = exercise.type === "worksheet"
      ? (exercise.enhancements?.autoVisuals !== false)
      : true;
    const isMastered = (submitEffectiveScore ?? score ?? 0) >= 75;

    return (
      <div className="max-w-md mx-auto border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 p-8 shadow text-center space-y-6">
        <div className="w-16 h-16 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-200">
          <Check className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold font-mono uppercase">Submitted!</h2>
          <p className="text-sm text-neutral-500">
            Attempt #{submitAttemptNumber} recorded.
          </p>
        </div>

        {/* Score card */}
        <div className="space-y-3">
          <div className="py-3 px-6 bg-neutral-50 dark:bg-neutral-950 rounded border inline-block">
            <span className="text-xs text-neutral-550 block font-semibold uppercase tracking-wider font-mono">
              Effective Score
            </span>
            <span className="text-3xl font-extrabold font-mono text-neutral-900 dark:text-neutral-100">
              {effectivePct}%
            </span>
          </div>

          {!isFullMarks && (
            <div className="text-xs font-mono text-neutral-500 space-y-1">
              <p>
                Raw score: <strong>{rawPct}%</strong> × {pct}% multiplier
                <span className="ml-1 text-amber-600 dark:text-amber-400">(Attempt #{submitAttemptNumber})</span>
              </p>
            </div>
          )}
        </div>

        {/* AI Mastery Meme Reward */}
        {isMastered && isVisualEnhancementEnabled && (
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-4">
            {!unwrappedMeme ? (
              <button
                type="button"
                onClick={handleUnwrapMeme}
                className="relative group overflow-hidden bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-mono font-bold text-xs px-6 py-4 rounded-xl uppercase tracking-widest hover:scale-[1.02] transition-all duration-250 cursor-pointer shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] w-full animate-pulse"
              >
                <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></span>
                <span className="flex items-center justify-center gap-2">
                  ✨ Unwrap AI Reward ✨
                </span>
              </button>
            ) : loadingMeme ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-950 animate-pulse border border-neutral-300 dark:border-neutral-800 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest animate-pulse">
                    Crafting brain reward...
                  </p>
                </div>
              </div>
            ) : memeError ? (
              <div className="p-4 border rounded border-red-300 bg-red-50/20 text-red-755 dark:text-red-350 text-xs font-mono">
                <p>⚠️ {memeError}</p>
                <button
                  type="button"
                  onClick={handleUnwrapMeme}
                  className="mt-2 text-indigo-650 dark:text-indigo-400 font-bold hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : memeData ? (
              <div className="space-y-3">
                <div className="relative aspect-video rounded-xl overflow-hidden border border-neutral-300 dark:border-neutral-850 shadow-md group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={memeData.imageUrl}
                    alt="Mastery Meme Background"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex flex-col justify-end p-5 text-left bg-gradient-to-t from-black/90 via-black/45 to-transparent text-white">
                    <span className="text-[9px] font-mono tracking-widest text-indigo-300 font-bold uppercase mb-1">
                      🎓 Mastery Reward
                    </span>
                    <p className="font-['Kalam'] text-base sm:text-lg font-bold leading-snug drop-shadow-lg text-yellow-300">
                      {memeData.text}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUnwrapMeme}
                  className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-350 transition uppercase tracking-wider flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  ✨ Generate Another Meme
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Pupil feedback and rating */}
        <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-4">
          <h3 className="text-sm font-bold font-mono uppercase text-neutral-800 dark:text-neutral-205">
            How was this worksheet?
          </h3>
          {feedbackSuccess ? (
            <div className="p-4 bg-green-500/5 border border-green-200 dark:border-green-800/40 rounded text-xs font-mono text-green-600 dark:text-green-400">
              ✓ Thanks! Your feedback has been recorded.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stars selection */}
              <div className="flex items-center justify-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => {
                  const starVal = i + 1;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRatingStars(starVal)}
                      className="text-neutral-300 dark:text-neutral-700 hover:scale-110 transition cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          starVal <= ratingStars
                            ? "text-amber-400 fill-current"
                            : "text-neutral-300 dark:text-neutral-700"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Suggestions feedback tag chips */}
              <div className="flex flex-wrap gap-1.5 justify-center max-w-xs mx-auto">
                {feedbackTagsSuggestions.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedTags((prev) =>
                          isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                        );
                      }}
                      className={`px-2 py-1 rounded-full text-[10px] font-mono border transition cursor-pointer select-none ${
                        isSelected
                          ? "bg-purple-600 text-white border-purple-600 dark:bg-purple-500 dark:border-purple-500 font-bold"
                          : "border-neutral-300 dark:border-neutral-750 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* Submit button */}
              <button
                type="button"
                disabled={ratingStars === 0 || submittingFeedback}
                onClick={async () => {
                  setSubmittingFeedback(true);
                  try {
                    const res = await rateExerciseAction(exercise.id, ratingStars, selectedTags.join(","));
                    if (res?.success) {
                      setFeedbackSuccess(true);
                    }
                  } catch (err) {
                    console.error("Failed to submit student rating:", err);
                  } finally {
                    setSubmittingFeedback(false);
                  }
                }}
                className="w-full bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs py-2 rounded uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
              >
                {submittingFeedback ? "Submitting..." : "Submit Rating"}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/student"
            className="inline-block bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:opacity-90 transition shadow"
          >
            Back to Dashboard
          </Link>
          <Link
            href={`/assignments/${assignmentId}`}
            className="inline-block border border-neutral-350 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            Try Again (fewer points)
          </Link>
        </div>
      </div>
    );
  }

  if (!Widget && exercise.type !== "worksheet" && exercise.type !== "image-hotspot-quiz" && exercise.type !== "interactive-reading") {
    return (
      <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-950/10 border-red-350 text-red-700">
        Unknown exercise widget type: <strong>{exercise.type}</strong>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between border-b pb-4">
        <Link
          href={role === "TEACHER" ? "/teacher" : "/student"}
          className="flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {/* Biophilic Focus sound controls */}
          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-850 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-750">
            <Headphones className={`w-3.5 h-3.5 text-neutral-500 ${focusMode !== "off" ? "animate-pulse text-indigo-500 dark:text-indigo-400" : ""}`} />
            <select
              value={focusMode}
              onChange={(e) => setFocusMode(e.target.value as "off" | "binaural" | "rain")}
              className="bg-transparent text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer border-none p-0 pr-1"
            >
              <option value="off" className="bg-white dark:bg-neutral-900">Focus Sound: Off</option>
              <option value="binaural" className="bg-white dark:bg-neutral-900">Binaural (10Hz)</option>
              <option value="rain" className="bg-white dark:bg-neutral-900">Rain Noise</option>
            </select>
            {focusMode !== "off" && (
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-neutral-300 dark:border-neutral-700">
                <Volume2 className="w-3 h-3 text-neutral-500" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={focusVolume}
                  onChange={(e) => setFocusVolume(parseFloat(e.target.value))}
                  className="w-12 sm:w-16 h-1 bg-neutral-300 dark:bg-neutral-700 rounded appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {role === "STUDENT" && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-wider">
              ✓ Autosaved draft
            </span>
          )}
          {role === "TEACHER" ? (
            <span className="text-xs font-semibold uppercase tracking-widest font-mono bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded">
              Teacher Preview Mode
            </span>
          ) : priorAttemptCount > 0 ? (
            <span className="text-xs font-semibold font-mono uppercase tracking-widest bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
              Attempt #{attemptNumber} · Score ×{Math.round(multiplier * 100)}%
            </span>
          ) : null}
        </div>
      </div>

      {/* Title bl      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-150">
          {exercise.title}
        </h1>
        <span className="inline-block text-[10px] font-mono uppercase tracking-widest bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 px-2 py-0.5 rounded">
          {getExerciseTypeLabel(exercise.type)}
        </span>
      </div>

      {isPastDue && role === "STUDENT" && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-955/20 text-red-750 dark:text-red-350 border border-red-200 dark:border-red-900 rounded font-mono text-xs font-bold leading-normal">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
          <span>This assignment is locked because the due date ({new Date(dueDate!).toLocaleDateString("en-GB")}) has passed. You cannot modify your answers or submit attempts.</span>
        </div>
      )}

      {/* Widget Container */}
      <div className={isPastDue && role === "STUDENT" ? "pointer-events-none opacity-70" : ""}>
        {exercise.type === "worksheet" ? (
          <div className="space-y-8">
            {pages.length > 1 && (
              <div className="p-4 border rounded border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-955/10 flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                  {currentPage.title || `Page ${currentPageIdx + 1}`}
                </span>
                <span className="text-[11px] font-mono text-neutral-500">
                  Page {currentPageIdx + 1} of {pages.length}
                </span>
              </div>
            )}

            {(currentPage.questions as WorksheetQuestionData[]).map((q, index: number) => {
              const ChildWidget = WIDGET_REGISTRY[q.type as keyof typeof WIDGET_REGISTRY];
              if (!ChildWidget) return null;

              return (
                <WidgetErrorBoundary key={q.id}>
                  <WorksheetQuestionRow
                    q={q}
                    index={index}
                    ChildWidget={ChildWidget}
                    assetsPath={assetsPath}
                    savedAnswers={savedAnswers}
                    handleChildChange={handleChildChange}
                  />
                </WidgetErrorBoundary>
              );
            })}
          </div>
        ) : exercise.type === "image-hotspot-quiz" ? (
          <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
            <WidgetErrorBoundary>
              {WIDGET_REGISTRY["image-hotspot-quiz"] ? (
                React.createElement(WIDGET_REGISTRY["image-hotspot-quiz"], {
                  config: exercise,
                  assetsPath,
                  savedState: savedAnswers,
                  onChange: handleWidgetChange,
                })
              ) : (
                <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-955/10 border-red-350 text-red-700">
                  Hotspot Quiz widget not registered.
                </div>
              )}
            </WidgetErrorBoundary>
          </div>
        ) : exercise.type === "interactive-reading" ? (
          <div className="p-6 border border-neutral-350 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
            <WidgetErrorBoundary>
              {WIDGET_REGISTRY["interactive-reading"] ? (
                React.createElement(WIDGET_REGISTRY["interactive-reading"], {
                  config: exercise,
                  assetsPath,
                  savedState: savedAnswers,
                  onChange: handleWidgetChange,
                })
              ) : (
                <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-955/10 border-red-350 text-red-700">
                  Interactive Reading widget not registered.
                </div>
              )}
            </WidgetErrorBoundary>
          </div>
        ) : (
          <div className="p-6 border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm">
            <WidgetErrorBoundary>
              {Widget ? (
                <Widget
                  config={exercise}
                  assetsPath={assetsPath}
                  savedState={savedAnswers}
                  onChange={handleWidgetChange}
                />
              ) : (
                <div className="text-center py-12 border rounded bg-red-50 dark:bg-red-955/10 border-red-350 text-red-700">
                  Widget type not registered.
                </div>
              )}
            </WidgetErrorBoundary>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-955/20 border border-red-300 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-350">
          {error}
        </div>
      )}

      {exercise.type === "worksheet" && gateAlertVisible && (
        <div className="p-4 border rounded border-red-350 bg-red-50/20 text-red-750 dark:text-red-350 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="space-y-1">
            <p className="text-xs font-bold font-mono uppercase tracking-wider">⚠️ Score Threshold Not Reached</p>
            <p className="text-xs">
              You scored <strong>{currentPageScore.toFixed(0)}%</strong>, but you need at least{" "}
              <strong>{gateRequiredScore}%</strong> to continue. Please review your answers or redo this page to try again.
            </p>
          </div>
          <button
            type="button"
            onClick={resetCurrentPage}
            className="bg-red-650 hover:bg-red-700 text-white font-mono font-bold text-[10px] uppercase px-3.5 py-2 rounded-lg cursor-pointer transition self-start sm:self-auto shrink-0 shadow-sm flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redo Page
          </button>
        </div>
      )}

      {/* Submission Footer bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-955/40">
        <div className="flex flex-col gap-1">
          {isPastDue && role === "STUDENT" ? (
            <span className="text-xs text-red-650 dark:text-red-400 flex items-center gap-1 font-mono font-bold">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Submission locked
            </span>
          ) : exercise.type === "worksheet" && pages.length > 1 ? (
            currentPageIdx === pages.length - 1 ? (
              isComplete ? (
                <span className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-1 font-mono">
                  <Check className="w-4 h-4 text-green-500" /> Ready to submit
                </span>
              ) : (
                <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Progress: Incomplete
                </span>
              )
            ) : (
              isCurrentPageComplete ? (
                <span className="text-xs text-neutral-650 dark:text-neutral-400 flex items-center gap-1 font-mono">
                  <Check className="w-4 h-4 text-green-500" /> Page complete {enforceGate && `(Score: ${currentPageScore.toFixed(0)}% / Target: ${gateRequiredScore}%)`}
                </span>
              ) : (
                <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Page incomplete
                </span>
              )
            )
          ) : isComplete ? (
            <span className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-1 font-mono">
              <Check className="w-4 h-4 text-green-500" /> Ready to submit
            </span>
          ) : (
            <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Progress: Incomplete
            </span>
          )}
          {role === "STUDENT" && priorAttemptCount > 0 && !isPastDue && (
            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
              Attempt #{attemptNumber}: score multiplied by ×{Math.round(multiplier * 100)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {exercise.type === "worksheet" && pages.length > 1 && currentPageIdx > 0 && (
            <button
              onClick={handlePrevPage}
              disabled={loading}
              className="border border-neutral-350 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold font-mono text-xs px-5 py-3 rounded uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              Previous Page
            </button>
          )}

          {exercise.type === "worksheet" && pages.length > 1 && currentPageIdx < pages.length - 1 ? (
            <button
              onClick={handleNextPage}
              disabled={loading || (isPastDue && role === "STUDENT")}
              className="bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow flex items-center gap-1.5"
            >
              Next Page
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || (isPastDue && role === "STUDENT") || (exercise.type === "worksheet" && pages.length > 1 && currentPageIdx === pages.length - 1 && !isComplete)}
              className="bg-black text-white dark:bg-white dark:text-black font-semibold font-mono text-xs px-6 py-3 rounded uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow"
            >
              {loading ? "Saving..." : role === "TEACHER" ? "Done Previewing" : isPastDue && role === "STUDENT" ? "Locked" : "Submit Assignment"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
