"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  startLiveQuiz,
  endLiveQuestion,
  showLiveLeaderboard,
  nextLiveQuestion,
  finishLiveQuiz,
} from "@/lib/actions/live-quiz";
import { Play, SkipForward, Trophy, Users, Award, Loader2 } from "lucide-react";
import { LiveQuizConfig } from "@/components/widgets/types";

const optionShapes = ["▲", "◆", "●", "■"];

interface Participant {
  id: string;
  name: string;
  score: number;
  rank: number;
}

interface GameState {
  status: "LOBBY" | "QUESTION" | "SHOW_CORRECT" | "LEADERBOARD" | "FINISHED";
  currentQuestionIdx: number;
  pin: string;
  totalQuestions: number;
  timeRemaining: number;
  participantsCount: number;
  participants: Participant[];
  responsesCount: number;
  responseStats: Record<string, number>;
}

interface LiveQuizSessionHostClientProps {
  sessionId: string;
  exercise: LiveQuizConfig;
  classrooms: Array<{ id: string; name: string }>;
}

export default function LiveQuizSessionHostClient({
  sessionId,
  exercise,
  classrooms,
}: LiveQuizSessionHostClientProps) {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [saveGrades, setSaveGrades] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll game state every 1.5 seconds
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/live-quiz/sync?sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);

          // Auto-advance status if timer hit 0 under QUESTION status
          if (data.status === "QUESTION" && data.timeRemaining === 0 && data.responsesCount > 0) {
            // We can auto-skip to show correct
            await endLiveQuestion(sessionId);
          }
        }
      } catch (err) {
        console.error("Failed to sync host state:", err);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        <p className="text-xs text-neutral-400 font-mono">Loading active live board...</p>
      </div>
    );
  }

  const handleStart = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await startLiveQuiz(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start quiz.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await endLiveQuestion(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end question.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleShowLeaderboard = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await showLiveLeaderboard(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to show leaderboard.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNext = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await nextLiveQuestion(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance question.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinish = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await finishLiveQuiz(sessionId, saveGrades && !!selectedClassroomId, selectedClassroomId || undefined);
      router.push("/teacher");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish session.");
      setActionLoading(false);
    }
  };

  const currentQ = exercise.questions[gameState.currentQuestionIdx];
  const isLastQ = gameState.currentQuestionIdx === exercise.questions.length - 1;

  // Render chart heights
  const maxStatVal = Math.max(...Object.values(gameState.responseStats || {}), 1);

  return (
    <main className="max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
      {/* Session Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-650 dark:text-purple-400 bg-purple-50 dark:bg-purple-955/20 px-2.5 py-1 rounded">
            Live Quiz Session
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1 text-neutral-900 dark:text-neutral-100">
            {exercise.title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold font-mono text-neutral-500">
            Status: <span className="font-extrabold uppercase text-purple-650 dark:text-purple-400">{gameState.status}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 border border-red-200 bg-red-50 text-xs text-red-700 rounded-lg font-bold">
          {error}
        </div>
      )}

      {/* 1. LOBBY VIEW */}
      {gameState.status === "LOBBY" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* PIN Card */}
            <div className="md:col-span-2 p-8 border rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white text-center space-y-4 shadow-lg">
              <span className="text-xs font-mono font-bold uppercase tracking-widest opacity-80 block">
                Join PIN Code
              </span>
              <span className="text-5xl font-black font-mono tracking-widest block bg-white/10 py-4 rounded-xl border border-white/20">
                {gameState.pin}
              </span>
              <p className="text-xs opacity-90 leading-relaxed font-sans">
                Tell students to go to the <strong>Join Live Quiz</strong> screen on their devices and enter this PIN.
              </p>
            </div>

            {/* Config Panel */}
            <div className="p-6 border rounded-2xl bg-white dark:bg-neutral-900 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1 border-b pb-1.5">
                  <Users className="w-4 h-4 text-purple-500" /> Session Setup
                </h3>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                    Link Grades to Classroom
                  </label>
                  <select
                    value={selectedClassroomId}
                    onChange={(e) => setSelectedClassroomId(e.target.value)}
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-750 rounded p-2 bg-transparent outline-none"
                  >
                    <option value="">-- Host Standalone (No Submissions) --</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={actionLoading || gameState.participantsCount === 0}
                className="w-full bg-black text-white dark:bg-white dark:text-black font-bold font-mono text-xs py-3.5 rounded-xl uppercase tracking-wider transition hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Start Game
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Lobby Participants List */}
          <div className="border border-neutral-200 dark:border-neutral-850 rounded-2xl bg-neutral-50/50 dark:bg-neutral-950/20 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                Waiting Lobby
              </h3>
              <span className="text-xs font-mono font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2.5 py-0.5 rounded-full">
                {gameState.participantsCount} players joined
              </span>
            </div>

            {gameState.participants.length === 0 ? (
              <div className="text-center py-12 text-xs text-neutral-400 italic font-mono">
                No players joined yet. Waiting for students to connect...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {gameState.participants.map((part) => (
                  <div
                    key={part.id}
                    className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 shadow-sm text-center font-bold text-xs truncate animate-fade-in"
                  >
                    👤 {part.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. QUESTION ACTIVE SCREEN */}
      {gameState.status === "QUESTION" && currentQ && (
        <div className="space-y-6">
          {/* Question Text */}
          <div className="p-6 border border-purple-200 dark:border-purple-950 bg-purple-50/10 dark:bg-purple-955/5 rounded-2xl text-center space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-650 dark:text-purple-400">
              Question {gameState.currentQuestionIdx + 1} of {gameState.totalQuestions} ({currentQ.type})
            </span>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 leading-snug">
              {currentQ.questionText}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Options display */}
            <div className="md:col-span-2 space-y-4">
              {(currentQ.type === "single-choice" || currentQ.type === "multiple-choice") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(currentQ.options || []).map((opt: string, idx: number) => {
                    const shapes = ["▲", "◆", "●", "■"];
                    const colors = [
                      "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-955/10 dark:border-rose-900/40 dark:text-rose-300",
                      "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-955/10 dark:border-blue-900/40 dark:text-blue-300",
                      "bg-amber-50 border-amber-250 text-amber-800 dark:bg-amber-955/10 dark:border-amber-900/40 dark:text-amber-300",
                      "bg-emerald-50 border-emerald-250 text-emerald-800 dark:bg-emerald-955/10 dark:border-emerald-900/40 dark:text-emerald-300",
                    ];
                    return (
                      <div
                        key={idx}
                        className={`p-4 border rounded-xl flex items-center justify-between text-sm font-semibold shadow-sm ${colors[idx % 4] || "bg-neutral-50"}`}
                      >
                        <span>{opt}</span>
                        <span className="font-mono text-base font-black">{shapes[idx % 4]}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {currentQ.type === "word-ordering" && (
                <div className="p-4 border border-neutral-350 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-950/20 text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold text-neutral-450 block">Scrambled Words:</span>
                  <div className="flex flex-wrap gap-2 justify-center font-mono">
                    {(currentQ.words || []).map((word: string, idx: number) => (
                      <span key={idx} className="bg-white dark:bg-neutral-900 border rounded-lg px-3 py-1.5 shadow-sm text-xs font-semibold">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {currentQ.type === "text-input" && (
                <div className="p-4 border border-neutral-350 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-950/20 text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold text-neutral-450 block">Acceptable answers:</span>
                  <div className="flex flex-wrap gap-2 justify-center font-mono">
                    {(currentQ.acceptedAnswers || []).map((ans: string, idx: number) => (
                      <span key={idx} className="bg-white dark:bg-neutral-900 border rounded-lg px-3 py-1.5 shadow-sm text-xs font-semibold">
                        {ans}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar stats/controls */}
            <div className="p-6 border rounded-2xl bg-white dark:bg-neutral-900 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4 text-center">
                {/* Timer block */}
                <div className="py-4 border-b">
                  <span className="text-[10px] font-mono text-neutral-400 block uppercase">Time Remaining</span>
                  <span className="text-4xl font-black font-mono text-amber-500 animate-pulse">
                    {gameState.timeRemaining}s
                  </span>
                </div>

                {/* Responses block */}
                <div>
                  <span className="text-[10px] font-mono text-neutral-400 block uppercase font-semibold">Responses</span>
                  <span className="text-3xl font-extrabold font-mono text-neutral-800 dark:text-neutral-250">
                    {gameState.responsesCount} / {gameState.participantsCount}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSkip}
                disabled={actionLoading}
                className="w-full bg-purple-650 hover:bg-purple-700 text-white font-bold font-mono text-xs py-3 rounded-xl uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><SkipForward className="w-4 h-4" /> Skip Timer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SHOW CORRECT STATE (BAR CHART VIEW) */}
      {gameState.status === "SHOW_CORRECT" && currentQ && (
        <div className="space-y-6">
          <div className="p-6 border border-green-250 dark:border-green-950 bg-green-50/10 dark:bg-green-955/5 rounded-2xl text-center space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-green-650">
              Answer Statistics
            </span>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 leading-snug">
              {currentQ.questionText}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stats Chart Bar */}
            <div className="md:col-span-2 p-6 border rounded-2xl bg-white dark:bg-neutral-900 shadow-sm space-y-6 flex flex-col justify-end min-h-[300px]">
              <div className="flex justify-around items-end h-48 border-b pb-2">
                {Object.entries(gameState.responseStats || {}).map(([key, val]) => {
                  const pct = maxStatVal > 0 ? (val / maxStatVal) * 100 : 0;
                  // Colors
                  let barColor = "bg-neutral-400 dark:bg-neutral-700";
                  let label = key;
                  if (currentQ.type === "single-choice" || currentQ.type === "multiple-choice") {
                    const colors = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"];
                    barColor = colors[Number(key) % 4] || barColor;
                    const shapes = ["▲", "◆", "●", "■"];
                    label = shapes[Number(key) % 4] || key;
                  } else {
                    barColor = key === "correct" ? "bg-green-500" : "bg-red-500";
                  }

                  return (
                    <div key={key} className="flex flex-col items-center gap-2 w-12">
                      <span className="text-xs font-mono font-extrabold">{val}</span>
                      <div
                        style={{ height: `${Math.max(8, pct)}%` }}
                        className={`w-full rounded-t-lg transition-all duration-500 ${barColor}`}
                      ></div>
                      <span className="text-xs font-bold font-mono uppercase text-neutral-500">{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Show correct summary list */}
              <div className="text-xs space-y-1 text-neutral-600 dark:text-neutral-400">
                <span className="font-bold text-neutral-500 block uppercase tracking-wider text-[10px]">
                  Correct Answer:
                </span>
                {currentQ.type === "single-choice" && currentQ.correctOptionIdx !== undefined && (
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    Option {optionShapes[currentQ.correctOptionIdx % 4]} ({currentQ.options?.[currentQ.correctOptionIdx]})
                  </p>
                )}
                {currentQ.type === "multiple-choice" && currentQ.correctOptionIndices !== undefined && (
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    Options: {currentQ.correctOptionIndices.map((idx: number) => `Option ${optionShapes[idx % 4]} (${currentQ.options?.[idx]})`).join(", ")}
                  </p>
                )}
                {currentQ.type === "word-ordering" && currentQ.words && (
                  <p className="font-mono font-semibold text-neutral-850 dark:text-neutral-150">
                    {currentQ.words.join(" ")}
                  </p>
                )}
                {currentQ.type === "text-input" && currentQ.acceptedAnswers && (
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {currentQ.acceptedAnswers.join(" / ")}
                  </p>
                )}
              </div>
            </div>

            {/* Sidebar controls */}
            <div className="p-6 border rounded-2xl bg-white dark:bg-neutral-900 shadow-sm flex flex-col justify-center">
              <button
                onClick={handleShowLeaderboard}
                disabled={actionLoading}
                className="w-full bg-black text-white dark:bg-white dark:text-black font-bold font-mono text-xs py-4 rounded-xl uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Show Leaderboard &rarr;</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. LEADERBOARD SCREEN */}
      {gameState.status === "LEADERBOARD" && (
        <div className="space-y-6">
          <div className="p-6 border rounded-2xl bg-white dark:bg-neutral-900 shadow-sm space-y-4">
            <h3 className="font-black text-lg text-center uppercase tracking-wider font-mono border-b pb-2 flex items-center justify-center gap-2">
              📊 Score Leaderboard
            </h3>

            {gameState.participants.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 italic text-xs">No participants scored yet.</div>
            ) : (
              <div className="max-w-md mx-auto space-y-3">
                {gameState.participants.slice(0, 5).map((part, idx) => {
                  const rankIcons = ["🥇", "🥈", "🥉"];
                  const rankIcon = rankIcons[idx] || `${idx + 1}.`;

                  return (
                    <div
                      key={part.id}
                      className="p-3.5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-950/20 flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono font-bold w-6 text-center">{rankIcon}</span>
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">{part.name}</span>
                      </div>
                      <span className="font-mono font-black text-purple-650 dark:text-purple-400">
                        {part.score} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            {isLastQ ? (
              <button
                onClick={handleFinish}
                disabled={actionLoading}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold font-mono text-xs px-6 py-3.5 rounded-xl uppercase tracking-wider transition flex items-center gap-1 cursor-pointer shadow"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trophy className="w-4 h-4" /> End Quiz & Podium</>}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={actionLoading}
                className="bg-black text-white dark:bg-white dark:text-black font-bold font-mono text-xs px-6 py-3.5 rounded-xl uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next Question &rarr;</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. FINISHED PODIUM VIEW */}
      {gameState.status === "FINISHED" && (
        <div className="space-y-6">
          <div className="p-8 border border-amber-300 bg-amber-50/10 dark:bg-amber-955/5 rounded-2xl text-center space-y-6 py-12 shadow">
            <Trophy className="w-16 h-16 text-amber-500 mx-auto animate-bounce" />
            <h2 className="text-3xl font-black uppercase font-mono text-amber-600 tracking-wider">
              Podium Winners!
            </h2>

            {/* Podium graphic boxes */}
            <div className="max-w-lg mx-auto flex items-end justify-center gap-4 pt-8 h-56 border-b pb-2">
              {/* 2nd Place */}
              {gameState.participants[1] && (
                <div className="flex flex-col items-center gap-2 w-28">
                  <span className="font-bold text-xs truncate max-w-full">{gameState.participants[1].name}</span>
                  <span className="text-[10px] font-mono text-neutral-500">{gameState.participants[1].score} pts</span>
                  <div className="bg-neutral-200 dark:bg-neutral-800 border-2 border-neutral-350 dark:border-neutral-700 w-full h-24 rounded-t-lg flex flex-col items-center justify-center shadow">
                    <span className="text-xl">🥈</span>
                    <span className="text-xs font-black font-mono mt-1">2ND</span>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {gameState.participants[0] && (
                <div className="flex flex-col items-center gap-2 w-32">
                  <span className="font-black text-sm truncate max-w-full text-amber-500">🏆 {gameState.participants[0].name}</span>
                  <span className="text-xs font-mono font-bold text-amber-550">{gameState.participants[0].score} pts</span>
                  <div className="bg-amber-400 dark:bg-amber-500 border-2 border-amber-300 w-full h-36 rounded-t-lg flex flex-col items-center justify-center shadow-lg">
                    <span className="text-2xl">🥇</span>
                    <span className="text-sm font-black font-mono mt-1 text-amber-900">1ST</span>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {gameState.participants[2] && (
                <div className="flex flex-col items-center gap-2 w-28">
                  <span className="font-bold text-xs truncate max-w-full">{gameState.participants[2].name}</span>
                  <span className="text-[10px] font-mono text-neutral-500">{gameState.participants[2].score} pts</span>
                  <div className="bg-amber-700/20 border-2 border-amber-700/50 w-full h-16 rounded-t-lg flex flex-col items-center justify-center shadow">
                    <span className="text-lg">🥉</span>
                    <span className="text-xs font-black font-mono mt-1 text-amber-700">3RD</span>
                  </div>
                </div>
              )}
            </div>

            {/* Submissions checklist if classroom selected */}
            {selectedClassroomId && (
              <div className="max-w-sm mx-auto p-4 border rounded-xl bg-white dark:bg-neutral-900 flex items-center justify-between text-xs">
                <div className="text-left space-y-1">
                  <span className="font-bold text-neutral-750 dark:text-neutral-250 block">Save to Gradebook</span>
                  <p className="text-[10px] text-neutral-450">
                    Record correct answer ratios as classroom assignment submissions.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={saveGrades}
                  onChange={(e) => setSaveGrades(e.target.checked)}
                  className="h-4.5 w-4.5 cursor-pointer accent-purple-600 rounded"
                />
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={actionLoading}
              className="bg-black text-white dark:bg-white dark:text-black font-bold font-mono text-xs px-8 py-3.5 rounded-xl uppercase tracking-wider transition hover:opacity-90 shadow-md cursor-pointer inline-flex items-center gap-1"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Award className="w-4 h-4" /> Close Session</>}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
