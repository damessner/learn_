"use client";

import React, { useState, useEffect } from "react";
import { submitLiveAnswer } from "@/lib/actions/live-quiz";
import { Check, X, Award, Clock, ArrowRight, Loader2, ListCollapse } from "lucide-react";

interface LiveQuizPlayerClientProps {
  sessionId: string;
  participantId: string;
}

interface GameState {
  status: "LOBBY" | "QUESTION" | "SHOW_CORRECT" | "LEADERBOARD" | "FINISHED";
  currentQuestionIdx: number;
  totalQuestions: number;
  timeRemaining: number;
  participantsCount: number;
  responsesCount: number;
  participants: Array<{
    id: string;
    name: string;
    score: number;
    rank: number;
  }>;
  participantDetails: {
    name: string;
    score: number;
    hasAnswered: boolean;
    answerPoints: number;
    answerCorrect: boolean;
  } | null;
  question: {
    type: "single-choice" | "multiple-choice" | "word-ordering" | "text-input";
    questionText: string;
    timeLimit: number;
    media?: string;
    options?: string[];
    words?: string[];
  } | null;
}

export default function LiveQuizPlayerClient({ sessionId, participantId }: LiveQuizPlayerClientProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [orderedWords, setOrderedWords] = useState<string[]>([]);
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Poll state every 1.2 seconds
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/live-quiz/sync?sessionId=${sessionId}&participantId=${participantId}`);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);
        }
      } catch (err) {
        console.error("Failed to sync live quiz:", err);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1200);
    return () => clearInterval(interval);
  }, [sessionId, participantId]);

  // Reset local states on question change
  const currentIdx = gameState?.currentQuestionIdx;
  const gameStatus = gameState?.status;
  const rawWords = gameState?.question?.words;

  const [prevKey, setPrevKey] = useState<string | null>(null);
  const currentKey = gameState ? `${currentIdx}-${gameStatus}-${rawWords ? rawWords.join(",") : ""}` : null;

  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setSelectedIndices([]);
    setTextAnswer("");
    setLocalError(null);
    setSubmitting(false);
    if (rawWords) {
      setOrderedWords([]);
      setShuffledWords(rawWords);
    }
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        <p className="text-xs text-neutral-400 font-mono">Syncing game lobby...</p>
      </div>
    );
  }

  const handleChoiceClick = async (idx: number) => {
    if (gameState.status !== "QUESTION" || gameState.participantDetails?.hasAnswered || submitting) return;

    setSubmitting(true);
    setLocalError(null);

    try {
      const res = await submitLiveAnswer(sessionId, participantId, gameState.currentQuestionIdx, JSON.stringify(idx));
      if (res.error) {
        setLocalError(res.error);
        setSubmitting(false);
      }
    } catch {
      setLocalError("Failed to submit answer.");
      setSubmitting(false);
    }
  };

  const handleMultipleChoiceSubmit = async () => {
    if (selectedIndices.length === 0 || submitting) return;

    setSubmitting(true);
    setLocalError(null);

    try {
      const res = await submitLiveAnswer(
        sessionId,
        participantId,
        gameState.currentQuestionIdx,
        JSON.stringify(selectedIndices)
      );
      if (res.error) {
        setLocalError(res.error);
        setSubmitting(false);
      }
    } catch {
      setLocalError("Failed to submit answer.");
      setSubmitting(false);
    }
  };

  const handleWordOrderClick = (word: string, isFromOrdered: boolean) => {
    if (gameState.participantDetails?.hasAnswered || submitting) return;

    if (isFromOrdered) {
      setOrderedWords(orderedWords.filter((w) => w !== word));
      setShuffledWords([...shuffledWords, word]);
    } else {
      setShuffledWords(shuffledWords.filter((w) => w !== word));
      setOrderedWords([...orderedWords, word]);
    }
  };

  const handleWordOrderingSubmit = async () => {
    if (orderedWords.length === 0 || submitting) return;

    setSubmitting(true);
    setLocalError(null);

    try {
      const res = await submitLiveAnswer(
        sessionId,
        participantId,
        gameState.currentQuestionIdx,
        JSON.stringify(orderedWords)
      );
      if (res.error) {
        setLocalError(res.error);
        setSubmitting(false);
      }
    } catch {
      setLocalError("Failed to submit answer.");
      setSubmitting(false);
    }
  };

  const handleTextInputSubmit = async () => {
    if (!textAnswer.trim() || submitting) return;

    setSubmitting(true);
    setLocalError(null);

    try {
      const res = await submitLiveAnswer(
        sessionId,
        participantId,
        gameState.currentQuestionIdx,
        JSON.stringify(textAnswer.trim())
      );
      if (res.error) {
        setLocalError(res.error);
        setSubmitting(false);
      }
    } catch {
      setLocalError("Failed to submit answer.");
      setSubmitting(false);
    }
  };

  // Option colors mapped to Kahoot-like gradients
  const optionGradients = [
    "bg-gradient-to-br from-rose-500 to-red-650 text-white",
    "bg-gradient-to-br from-blue-500 to-indigo-650 text-white",
    "bg-gradient-to-br from-amber-500 to-yellow-650 text-white",
    "bg-gradient-to-br from-emerald-500 to-green-650 text-white",
  ];

  const optionShapes = ["▲", "◆", "●", "■"];

  return (
    <main className="max-w-xl w-full mx-auto px-4 py-8 space-y-6">
      {/* Participant Header Info */}
      <div className="flex items-center justify-between border-b pb-3 text-xs font-mono text-neutral-500">
        <div>
          Nickname: <span className="font-bold text-neutral-800 dark:text-neutral-200">{gameState.participantDetails?.name}</span>
        </div>
        <div>
          Score: <span className="font-bold text-neutral-800 dark:text-neutral-200">{gameState.participantDetails?.score} pts</span>
        </div>
      </div>

      {/* 1. LOBBY STATE */}
      {gameState.status === "LOBBY" && (
        <div className="p-8 border rounded-2xl bg-white dark:bg-neutral-900 shadow-md text-center space-y-6 py-12">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/30 animate-pulse"></div>
            <div className="absolute inset-2 rounded-full border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            <div className="absolute inset-4 rounded-full bg-purple-500/10 flex items-center justify-center font-bold text-lg">🎮</div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold font-mono uppercase">You&apos;re in the Lobby!</h2>
            <p className="text-sm text-neutral-500">
              Get ready! The quiz will begin as soon as the teacher clicks start on the projection screen.
            </p>
          </div>
          <div className="text-xs bg-neutral-50 dark:bg-neutral-950 px-4 py-2 rounded-lg border inline-block text-neutral-550">
            Wait count: <span className="font-bold text-purple-650 dark:text-purple-400">{gameState.participantsCount} players</span> joined
          </div>
        </div>
      )}

      {/* 2. QUESTION PLAY STATE */}
      {gameState.status === "QUESTION" && gameState.question && (
        <div className="space-y-6">
          {/* Progress & Timer Row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-neutral-100 dark:bg-neutral-850 px-2.5 py-1 rounded text-neutral-550">
              Question {gameState.currentQuestionIdx + 1} of {gameState.totalQuestions}
            </span>
            <div className="flex items-center gap-1.5 text-sm font-bold font-mono bg-amber-50 dark:bg-amber-955/20 border border-amber-250 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full">
              <Clock className="w-4 h-4 text-amber-500" />
              {gameState.timeRemaining}s
            </div>
          </div>

          {/* Already Answered Waiting Screen */}
          {gameState.participantDetails?.hasAnswered ? (
            <div className="p-8 border border-neutral-200 dark:border-neutral-850 rounded-2xl bg-white dark:bg-neutral-900 shadow-md text-center space-y-4 py-12">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-955/20 text-green-650 dark:text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-200/50">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">Answer Submitted!</h3>
              <p className="text-xs text-neutral-450">
                Waiting for the time limit to expire or for other players to submit...
              </p>
              <div className="text-[10px] font-mono text-neutral-400">
                Responses: {gameState.responsesCount} / {gameState.participantsCount} players
              </div>
            </div>
          ) : (
            /* Question Layout */
            <div className="space-y-6">
              {/* Question Text */}
              <div className="p-5 border border-purple-250 dark:border-purple-950 bg-purple-50/10 dark:bg-purple-955/5 rounded-2xl">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                  {gameState.question.questionText}
                </h2>
              </div>

              {/* Error messages */}
              {localError && (
                <div className="p-3 border border-red-200 bg-red-50 text-xs text-red-700 rounded-lg text-center font-bold">
                  {localError}
                </div>
              )}

              {/* Single Choice Options (Instant Click) */}
              {gameState.question.type === "single-choice" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(gameState.question.options || []).map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChoiceClick(idx)}
                      disabled={submitting}
                      className={`p-6 rounded-2xl font-bold text-left text-sm transition duration-200 flex items-center justify-between cursor-pointer border border-transparent shadow hover:scale-[1.01] hover:brightness-105 active:scale-[0.99] ${
                        optionGradients[idx % 4] || "bg-neutral-500 text-white"
                      }`}
                    >
                      <span>{opt}</span>
                      <span className="text-lg opacity-80 font-mono font-black">{optionShapes[idx % 4]}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Multiple Choice Options (Checkbox Grid + Submit) */}
              {gameState.question.type === "multiple-choice" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(gameState.question.options || []).map((opt, idx) => {
                      const isSelected = selectedIndices.includes(idx);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedIndices(
                              isSelected ? selectedIndices.filter((i) => i !== idx) : [...selectedIndices, idx]
                            );
                          }}
                          disabled={submitting}
                          className={`p-5 rounded-2xl font-semibold text-left text-sm transition duration-200 flex items-center justify-between cursor-pointer border shadow ${
                            isSelected
                              ? "border-black dark:border-white ring-2 ring-black dark:ring-white scale-[1.01]"
                              : "border-neutral-200 dark:border-neutral-800"
                          } ${optionGradients[idx % 4] || "bg-neutral-500 text-white"}`}
                        >
                          <span>{opt}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="h-4 w-4 accent-black dark:accent-white pointer-events-none rounded"
                          />
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleMultipleChoiceSubmit}
                    disabled={selectedIndices.length === 0 || submitting}
                    className="w-full bg-purple-650 hover:bg-purple-700 text-white font-bold font-mono text-xs py-4 rounded-xl uppercase tracking-wider transition disabled:opacity-40 cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    Submit Choices <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Word Ordering (Click to order list) */}
              {gameState.question.type === "word-ordering" && (
                <div className="space-y-4">
                  {/* Ordered Answers list */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                      Your ordered answer (Click to remove)
                    </label>
                    <div className="min-h-14 border border-neutral-350 dark:border-neutral-800 rounded-xl p-3 bg-neutral-50/50 dark:bg-neutral-950/20 flex flex-wrap gap-2 items-center">
                      {orderedWords.length === 0 ? (
                        <span className="text-xs text-neutral-400 italic font-sans">
                          Click words below in correct sequence...
                        </span>
                      ) : (
                        orderedWords.map((word, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleWordOrderClick(word, true)}
                            className="bg-black text-white dark:bg-white dark:text-black font-mono font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-red-500 dark:hover:bg-red-500 dark:hover:text-white transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>{word}</span>
                            <X className="w-3 h-3 text-red-400" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Remaining scrambled words list */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                      Words to choose:
                    </label>
                    <div className="border border-dashed border-neutral-300 dark:border-neutral-850 rounded-xl p-4 flex flex-wrap gap-2 justify-center">
                      {shuffledWords.length === 0 && orderedWords.length > 0 && (
                        <span className="text-[10px] text-neutral-400 italic">All words ordered!</span>
                      )}
                      {shuffledWords.map((word, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleWordOrderClick(word, false)}
                          className="bg-neutral-100 dark:bg-neutral-800 hover:bg-purple-100 dark:hover:bg-purple-950 text-neutral-800 dark:text-neutral-250 font-mono text-xs px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-750 transition cursor-pointer"
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleWordOrderingSubmit}
                    disabled={orderedWords.length === 0 || submitting}
                    className="w-full bg-purple-650 hover:bg-purple-700 text-white font-bold font-mono text-xs py-4 rounded-xl uppercase tracking-wider transition disabled:opacity-40 cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    Submit Order <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Text Input Match */}
              {gameState.question.type === "text-input" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                      Your Answer
                    </label>
                    <input
                      type="text"
                      required
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Type correct answer..."
                      className="w-full text-center border border-neutral-300 dark:border-neutral-750 rounded-xl p-3 bg-transparent outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>

                  <button
                    onClick={handleTextInputSubmit}
                    disabled={!textAnswer.trim() || submitting}
                    className="w-full bg-purple-650 hover:bg-purple-700 text-white font-bold font-mono text-xs py-4 rounded-xl uppercase tracking-wider transition disabled:opacity-40 cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    Submit Answer <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. SHOW CORRECT STATE */}
      {gameState.status === "SHOW_CORRECT" && (
        <div className="space-y-6">
          {gameState.participantDetails?.hasAnswered ? (
            /* Results displays */
            gameState.participantDetails.answerCorrect ? (
              <div className="p-8 border border-green-300 bg-green-55/10 dark:bg-green-955/5 rounded-2xl text-center space-y-4 py-12">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-950/45 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-200">
                  <Check className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-green-700 dark:text-green-450 uppercase font-mono">
                    Correct! 🎉
                  </h2>
                  <p className="text-xs text-neutral-550">
                    Plus <strong className="text-green-600 dark:text-green-400">+{gameState.participantDetails.answerPoints}</strong> points for speed!
                  </p>
                </div>
                <div className="text-[10px] text-neutral-450 italic">Look at the classroom projector screen!</div>
              </div>
            ) : (
              <div className="p-8 border border-red-300 bg-red-55/10 dark:bg-red-955/5 rounded-2xl text-center space-y-4 py-12">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-950/45 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-200">
                  <X className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-red-700 dark:text-red-450 uppercase font-mono">
                    Incorrect! ❌
                  </h2>
                  <p className="text-xs text-neutral-555">Better luck on the next question!</p>
                </div>
                <div className="text-[10px] text-neutral-450 italic">Look at the classroom projector screen!</div>
              </div>
            )
          ) : (
            <div className="p-8 border rounded-2xl bg-neutral-50/50 dark:bg-neutral-900 shadow-sm text-center space-y-3 py-12 text-neutral-450">
              <ListCollapse className="w-8 h-8 mx-auto text-neutral-400" />
              <h3 className="font-semibold text-sm">Time&apos;s Up!</h3>
              <p className="text-xs">You didn&apos;t submit an answer in time.</p>
            </div>
          )}
        </div>
      )}

      {/* 4. LEADERBOARD STATE */}
      {gameState.status === "LEADERBOARD" && (
        <div className="p-8 border border-purple-200 dark:border-purple-950 rounded-2xl bg-white dark:bg-neutral-900 shadow-md text-center space-y-6 py-12">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-950/45 text-purple-650 dark:text-purple-400 rounded-xl flex items-center justify-center mx-auto border border-purple-200/50">
            <span className="text-2xl font-bold font-mono">📊</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold font-mono uppercase">Leaderboard Active</h2>
            <p className="text-xs text-neutral-550">
              Check the big projection screen to see who is on the podium!
            </p>
          </div>

          {gameState.participantDetails && (
            <div className="py-4 border-t border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-around">
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">Rank</span>
                <span className="text-xl font-extrabold font-mono text-purple-650 dark:text-purple-400">
                  #{gameState.participants.find((p) => p.id === participantId)?.rank || "-"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono text-neutral-400 block uppercase">Score</span>
                <span className="text-xl font-extrabold font-mono text-neutral-800 dark:text-neutral-250">
                  {gameState.participantDetails.score} pts
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. FINISHED STATE */}
      {gameState.status === "FINISHED" && (
        <div className="p-8 border border-amber-300 bg-amber-50/10 dark:bg-amber-955/5 rounded-2xl text-center space-y-6 py-12">
          <Award className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-amber-700 dark:text-amber-450 uppercase font-mono">
              Quiz Completed! 🏆
            </h2>
            <p className="text-sm text-neutral-500">
              Great game! Check the classroom podium for the final winners.
            </p>
          </div>

          {gameState.participantDetails && (
            <div className="max-w-xs mx-auto py-4 px-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm flex items-center justify-around font-mono text-xs">
              <div>
                <span className="text-neutral-400 block uppercase text-[9px]">Final Rank</span>
                <span className="text-lg font-extrabold text-amber-600">
                  #{gameState.participants.find((p) => p.id === participantId)?.rank || "-"}
                </span>
              </div>
              <div className="h-6 w-[1px] bg-neutral-200 dark:bg-neutral-800"></div>
              <div>
                <span className="text-neutral-400 block uppercase text-[9px]">Final Score</span>
                <span className="text-lg font-extrabold text-neutral-800 dark:text-neutral-250">
                  {gameState.participantDetails.score} pts
                </span>
              </div>
            </div>
          )}

          <p className="text-[10px] text-neutral-400 italic">
            Your results have been automatically synchronized and submitted.
          </p>
        </div>
      )}
    </main>
  );
}
