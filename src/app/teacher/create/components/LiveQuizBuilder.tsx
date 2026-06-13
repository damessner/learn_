"use client";

import React from "react";
import { Plus, Trash, HelpCircle, List, ArrowDownAz, Type, Clock } from "lucide-react";
import { randomUUID } from "@/lib/uuid";

export interface LiveQuizQuestion {
  id: string;
  type: "single-choice" | "multiple-choice" | "word-ordering" | "text-input";
  questionText: string;
  timeLimit: number; // in seconds
  media?: string;
  options: string[]; // for choice types
  correctOptionIdx: number; // for single-choice
  correctOptionIndices: number[]; // for multiple-choice
  words: string[]; // for word ordering
  acceptedAnswers: string[]; // for text-input
}

interface LiveQuizBuilderProps {
  questions: LiveQuizQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<LiveQuizQuestion[]>>;
}

export function LiveQuizBuilder({ questions, setQuestions }: LiveQuizBuilderProps) {
  const addQuestion = () => {
    const newQ: LiveQuizQuestion = {
      id: randomUUID(),
      type: "single-choice",
      questionText: "",
      timeLimit: 20,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctOptionIdx: 0,
      correctOptionIndices: [],
      words: ["The", "fox", "jumps"],
      acceptedAnswers: ["Correct Answer"],
    };
    setQuestions([...questions, newQ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<LiveQuizQuestion>) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === id) {
          return { ...q, ...updates } as LiveQuizQuestion;
        }
        return q;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-2">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wide flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-purple-500" />
          Live Quiz Questions Builder
        </h3>
        <p className="text-xs text-neutral-450 mt-1">
          Create questions for your real-time synchronous classroom quiz. You can add choice, ordering, or input questions.
        </p>
      </div>

      <div className="space-y-6">
        {questions.map((q, qIdx) => (
          <div
            key={q.id}
            className="p-6 border border-neutral-300 dark:border-neutral-850 bg-white dark:bg-neutral-900 rounded-lg shadow-sm space-y-4 relative"
          >
            {/* Header & Delete */}
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                Question {qIdx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                disabled={questions.length <= 1}
                className="text-red-500 hover:text-red-700 disabled:opacity-30 cursor-pointer p-1 transition"
                title="Remove Question"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>

            {/* Question Text */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  Question Text
                </label>
                <input
                  type="text"
                  required
                  value={q.questionText}
                  onChange={(e) => updateQuestion(q.id, { questionText: e.target.value })}
                  placeholder="e.g. What is the capital of Germany?"
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-2.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              {/* Question Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  Question Type
                </label>
                <select
                  value={q.type}
                  onChange={(e) => {
                    const newType = e.target.value as LiveQuizQuestion["type"];
                    updateQuestion(q.id, { type: newType });
                  }}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-2.5 bg-white dark:bg-neutral-900 outline-none focus:border-black dark:focus:border-white"
                >
                  <option value="single-choice">Single Choice</option>
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="word-ordering">Word Ordering</option>
                  <option value="text-input">Text Input</option>
                </select>
              </div>
            </div>

            {/* Time limit & Media */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Time Limit (seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={q.timeLimit}
                  onChange={(e) => updateQuestion(q.id, { timeLimit: Math.max(5, parseInt(e.target.value) || 20) })}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-2.5 bg-transparent outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  Optional Media Filename (or URL)
                </label>
                <input
                  type="text"
                  value={q.media || ""}
                  onChange={(e) => updateQuestion(q.id, { media: e.target.value || undefined })}
                  placeholder="e.g. map.png"
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-2.5 bg-transparent outline-none"
                />
              </div>
            </div>

            {/* Answer Configuration depending on Type */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850">
              {/* Choice Types */}
              {(q.type === "single-choice" || q.type === "multiple-choice") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block flex items-center gap-1">
                      <List className="w-3.5 h-3.5" /> Options & Correct Answer
                    </label>
                    <button
                      type="button"
                      onClick={() => updateQuestion(q.id, { options: [...q.options, `Option ${q.options.length + 1}`] })}
                      className="text-[10px] uppercase font-mono tracking-wider font-bold text-neutral-500 hover:text-black dark:hover:text-white transition flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options.map((opt, optIdx) => {
                      const isCorrectSingle = q.type === "single-choice" && q.correctOptionIdx === optIdx;
                      const isCorrectMulti = q.type === "multiple-choice" && q.correctOptionIndices.includes(optIdx);

                      return (
                        <div
                          key={optIdx}
                          className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-neutral-50/50 dark:bg-neutral-950/20"
                        >
                          <input
                            type={q.type === "single-choice" ? "radio" : "checkbox"}
                            name={`correct-answer-${q.id}`}
                            checked={q.type === "single-choice" ? isCorrectSingle : isCorrectMulti}
                            onChange={() => {
                              if (q.type === "single-choice") {
                                updateQuestion(q.id, { correctOptionIdx: optIdx });
                              } else {
                                const newMulti = q.correctOptionIndices.includes(optIdx)
                                  ? q.correctOptionIndices.filter((idx) => idx !== optIdx)
                                  : [...q.correctOptionIndices, optIdx];
                                updateQuestion(q.id, { correctOptionIndices: newMulti });
                              }
                            }}
                            className="cursor-pointer h-4 w-4"
                            title="Mark Correct"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...q.options];
                              newOpts[optIdx] = e.target.value;
                              updateQuestion(q.id, { options: newOpts });
                            }}
                            className="flex-1 text-xs border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 bg-transparent rounded p-1.5 focus:border-neutral-400 focus:bg-white dark:focus:bg-neutral-850 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = q.options.filter((_, idx) => idx !== optIdx);
                              // Adjust correct pointers
                              let newIdx = q.correctOptionIdx;
                              if (q.correctOptionIdx === optIdx) {
                                newIdx = 0;
                              } else if (q.correctOptionIdx > optIdx) {
                                newIdx--;
                              }
                              const newMulti = q.correctOptionIndices
                                .filter((idx) => idx !== optIdx)
                                .map((idx) => (idx > optIdx ? idx - 1 : idx));

                              updateQuestion(q.id, {
                                options: newOpts,
                                correctOptionIdx: newIdx,
                                correctOptionIndices: newMulti,
                              });
                            }}
                            disabled={q.options.length <= 2}
                            className="text-neutral-400 hover:text-red-500 cursor-pointer disabled:opacity-30 p-1"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Word Ordering */}
              {q.type === "word-ordering" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block flex items-center gap-1">
                      <ArrowDownAz className="w-3.5 h-3.5" /> Words to Order (Enter in Correct Sequence)
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    value={q.words.join(" ")}
                    onChange={(e) => {
                      const wordsArray = e.target.value.split(/\s+/).filter(Boolean);
                      updateQuestion(q.id, { words: wordsArray });
                    }}
                    placeholder="Type words separated by space, e.g. The quick brown fox jumps"
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-750 rounded p-2.5 bg-transparent font-mono outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 mr-1">Preview Order:</span>
                    {q.words.map((w, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-[11px] rounded font-mono border text-neutral-600 dark:text-neutral-300"
                      >
                        {idx + 1}. {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Input */}
              {q.type === "text-input" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block flex items-center gap-1">
                      <Type className="w-3.5 h-3.5" /> Accepted Answer Variations
                    </label>
                    <button
                      type="button"
                      onClick={() => updateQuestion(q.id, { acceptedAnswers: [...q.acceptedAnswers, "Answer Option"] })}
                      className="text-[10px] uppercase font-mono tracking-wider font-bold text-neutral-500 hover:text-black dark:hover:text-white transition flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Variation
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.acceptedAnswers.map((ans, ansIdx) => (
                      <div
                        key={ansIdx}
                        className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-neutral-50/50 dark:bg-neutral-950/20"
                      >
                        <input
                          type="text"
                          required
                          value={ans}
                          onChange={(e) => {
                            const newAnswers = [...q.acceptedAnswers];
                            newAnswers[ansIdx] = e.target.value;
                            updateQuestion(q.id, { acceptedAnswers: newAnswers });
                          }}
                          className="flex-1 text-xs bg-transparent outline-none p-1 border border-transparent focus:border-neutral-300"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newAnswers = q.acceptedAnswers.filter((_, idx) => idx !== ansIdx);
                            updateQuestion(q.id, { acceptedAnswers: newAnswers });
                          }}
                          disabled={q.acceptedAnswers.length <= 1}
                          className="text-neutral-400 hover:text-red-500 cursor-pointer disabled:opacity-30 p-1"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Question Button */}
      <button
        type="button"
        onClick={addQuestion}
        className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-neutral-300 dark:border-neutral-850 hover:border-black dark:hover:border-white p-4 rounded-lg text-neutral-500 hover:text-black dark:hover:text-white transition font-semibold cursor-pointer text-sm"
      >
        <Plus className="w-4 h-4" /> Add Next Question
      </button>
    </div>
  );
}
