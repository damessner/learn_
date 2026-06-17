"use client";

import React, { useState } from "react";
import { Upload, Trash, Search } from "lucide-react";
import { PixabaySearchModal } from "@/components/PixabaySearchModal";

export interface CreatorQuestion {
  id: string;
  type:
    | "multiple-choice"
    | "gap-fill"
    | "drag-drop"
    | "categorization"
    | "clickable-choice"
    | "matching"
    | "open-question"
    | "ordering"
    | "media"
    | "instruction";
  question: string;
  media: string;
  mediaStatus: string;
  hint: string;
  options: string[];
  correctOptionIndex: number;
  text: string;
  categories: string;
  categorizationMap: Record<string, string>; // category -> joined items
  choices: string; // clickable choices comma-separated
  statements: string; // statements split newlines, Statement##choice
  matchingPairs: Array<{
    id: string;
    leftText: string;
    leftMedia: string;
    leftMediaStatus: string;
    rightText: string;
  }>;
  keywords: string; // open-question space/comma separated
  orderingSentence: string;
  ttsEnabled?: boolean;
}

interface WorksheetQuestionsBuilderProps {
  exerciseId: string;
  questions: CreatorQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<CreatorQuestion[]>>;
  handleMediaUpload: (
    file: File,
    onUploaded: (filename: string) => void,
    onStatus: (status: string) => void
  ) => Promise<void>;
}

export function WorksheetQuestionsBuilder({
  exerciseId,
  questions,
  setQuestions,
  handleMediaUpload,
}: WorksheetQuestionsBuilderProps) {
  const [isPixabayOpen, setIsPixabayOpen] = useState(false);
  const [activeMediaTarget, setActiveMediaTarget] = useState<((filename: string) => void) | null>(null);
  const [activeQuery, setActiveQuery] = useState("");

  const addQuestion = (type: CreatorQuestion["type"]) => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        question: "",
        media: "",
        mediaStatus: "",
        hint: "",
        options: ["", ""],
        correctOptionIndex: 0,
        text: "",
        categories: "",
        categorizationMap: {},
        choices: "",
        statements: "",
        matchingPairs: [
          {
            id: crypto.randomUUID(),
            leftText: "",
            leftMedia: "",
            leftMediaStatus: "",
            rightText: "",
          },
        ],
        keywords: "",
        orderingSentence: "",
      },
    ]);
  };

  const removeQuestion = (qId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const updateQuestion = (qId: string, fields: Partial<CreatorQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, ...fields } : q))
    );
  };

  const updateCategorizationMap = (qId: string, category: string, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === qId) {
          return {
            ...q,
            categorizationMap: {
              ...q.categorizationMap,
              [category]: value,
            },
          };
        }
        return q;
      })
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-base font-bold font-mono uppercase tracking-wide border-b pb-2">
        Tasks & Questions List ({questions.length})
      </h2>

      {questions.map((q, qIdx) => {
        const activeCats = q.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);

        return (
          <div
            key={q.id}
            className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-350">
                  Task {qIdx + 1}
                </span>
                <select
                  value={q.type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateQuestion(q.id, { type: e.target.value as CreatorQuestion["type"] })}
                  className="text-xs font-mono font-bold bg-transparent border border-neutral-355 dark:border-neutral-750 rounded px-2 py-0.5 outline-none cursor-pointer"
                >
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="gap-fill">Write into the Gap</option>
                  <option value="drag-drop">Word Drag & Drop</option>
                  <option value="categorization">Categorization Sorting</option>
                  <option value="clickable-choice">Clickable Choice</option>
                  <option value="matching">Connections Match</option>
                  <option value="open-question">Open Question</option>
                  <option value="ordering">Word Ordering</option>
                  <option value="media">Solely Media Embed</option>
                  <option value="instruction">Instruction Card</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-neutral-400 hover:text-red-500 cursor-pointer transition"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>

            {/* Question prompt inputs */}
            {q.type !== "media" && q.type !== "instruction" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                      Task Prompt / Prompt Instructions
                    </label>
                    <label className="flex items-center gap-1 text-[10px] font-mono font-bold text-neutral-450 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.ttsEnabled || false}
                        onChange={(e) => updateQuestion(q.id, { ttsEnabled: e.target.checked })}
                        className="h-3.5 w-3.5 cursor-pointer accent-purple-650"
                      />
                      <span>🔊 English TTS</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solve the equation:"
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                {/* Optional Hint */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-455">
                    Optional Hint (Shown if stuck)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Try listing prime factors first"
                    value={q.hint}
                    onChange={(e) => updateQuestion(q.id, { hint: e.target.value })}
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
              </div>
            )}

            {/* Media attachments uploader */}
            {q.type !== "instruction" && (
              <div className="p-3 bg-neutral-50/50 dark:bg-neutral-955/10 border rounded space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block font-mono">
                  Optional Question Media (Image / Audio / Video)
                </label>
                <div className="flex flex-col md:flex-row gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Media file name (e.g. audio.mp3) or YouTube URL"
                    value={q.media}
                    onChange={(e) => updateQuestion(q.id, { media: e.target.value })}
                    className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                  />
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,audio/*,video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleMediaUpload(
                            file,
                            (fn) => updateQuestion(q.id, { media: fn }),
                            (st) => updateQuestion(q.id, { mediaStatus: st })
                          );
                        }
                      }}
                      className="hidden"
                      id={`upload-${q.id}`}
                    />
                    <label
                      htmlFor={`upload-${q.id}`}
                      className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload file
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!exerciseId.trim()) {
                        alert("Please specify the Worksheet ID at the top of the form before searching Pixabay.");
                        return;
                      }
                      setActiveMediaTarget(() => (fn: string) => updateQuestion(q.id, { media: fn }));
                      setActiveQuery(q.question || "");
                      setIsPixabayOpen(true);
                    }}
                    className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Pixabay
                  </button>
                </div>
                {q.mediaStatus && (
                  <span className="text-[10px] font-mono block text-neutral-500 italic">
                    {q.mediaStatus}
                  </span>
                )}
              </div>
            )}

            {/* Question Type Specific Inputs */}
            {q.type === "multiple-choice" && (
              <div className="space-y-3 pl-4 border-l-2 border-neutral-200 dark:border-neutral-850">
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correctOptionIndex === oIdx}
                      onChange={() => updateQuestion(q.id, { correctOptionIndex: oIdx })}
                      className="h-4 w-4 accent-black cursor-pointer"
                    />
                    <input
                      type="text"
                      required
                      placeholder={`Option ${oIdx + 1}`}
                      value={opt}
                      onChange={(e) =>
                        updateQuestion(q.id, {
                          options: q.options.map((o, idx) =>
                            idx === oIdx ? e.target.value : o
                          ),
                        })
                      }
                      className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded px-2.5 py-1.5 outline-none bg-transparent"
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateQuestion(q.id, {
                            options: q.options.filter((_, idx) => idx !== oIdx),
                            correctOptionIndex:
                              q.correctOptionIndex >= q.options.length - 1
                                ? 0
                                : q.correctOptionIndex,
                          })
                        }
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateQuestion(q.id, { options: [...q.options, ""] })}
                  className="text-xs text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white underline font-semibold cursor-pointer block mt-1"
                >
                  + Add Option
                </button>
              </div>
            )}

            {(q.type === "gap-fill" || q.type === "drag-drop") && (
              <div className="space-y-2 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                <textarea
                  required
                  placeholder={
                    q.type === "gap-fill"
                      ? "Sentence with gaps. E.g. The mouse <<ran>> (run) into the hole."
                      : "Drag drop text. E.g. The cows produce <<milk>> and live on the <<farm>>."
                  }
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                  rows={4}
                  className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 outline-none bg-transparent font-mono"
                />
              </div>
            )}

            {q.type === "categorization" && (
              <div className="space-y-4 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                    Categories (Comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Herbivores, Carnivores"
                    value={q.categories}
                    onChange={(e) => updateQuestion(q.id, { categories: e.target.value })}
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none"
                  />
                </div>

                {activeCats.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block border-b pb-1">
                      Categorization Columns (Items separated by ##)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeCats.map((cat) => (
                        <div
                          key={cat}
                          className="border rounded p-3 bg-neutral-50 dark:bg-neutral-955/20 space-y-1.5"
                        >
                          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-350 block">
                            Category: {cat}
                          </span>
                          <textarea
                            required
                            placeholder="Cow ## Sheep ## Rabbit"
                            value={q.categorizationMap[cat] || ""}
                            onChange={(e) => updateCategorizationMap(q.id, cat, e.target.value)}
                            rows={3}
                            className="w-full text-xs border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {q.type === "clickable-choice" && (
              <div className="space-y-4 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                    Clickable Option Buttons Bank (Comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yes, No, Unsure"
                    value={q.choices}
                    onChange={(e) => updateQuestion(q.id, { choices: e.target.value })}
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                    Statements List (One statement per line, formatted with Statement##Option)
                  </label>
                  <textarea
                    required
                    placeholder="Is 7 a prime number?##Yes&#13;Is 8 a prime number?##No"
                    value={q.statements}
                    onChange={(e) => updateQuestion(q.id, { statements: e.target.value })}
                    rows={4}
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 outline-none bg-transparent font-mono"
                  />
                </div>
              </div>
            )}

            {q.type === "matching" && (
              <div className="space-y-4 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                <div className="space-y-2.5">
                  {q.matchingPairs.map((pair) => (
                    <div
                      key={pair.id}
                      className="p-3 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-950/10 flex flex-col md:flex-row gap-3 items-end animate-fade-in"
                    >
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] uppercase tracking-wider font-semibold text-neutral-450 block">
                          Left Column Text
                        </label>
                        <input
                          type="text"
                          placeholder="Text label"
                          value={pair.leftText}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              matchingPairs: q.matchingPairs.map((p) =>
                                p.id === pair.id ? { ...p, leftText: e.target.value } : p
                              ),
                            })
                          }
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-2.5 py-1 outline-none bg-transparent"
                        />
                      </div>

                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] uppercase tracking-wider font-semibold text-neutral-450 block font-mono">
                          Left Media (File Upload)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. apple.jpg"
                            value={pair.leftMedia}
                            onChange={(e) =>
                              updateQuestion(q.id, {
                                matchingPairs: q.matchingPairs.map((p) =>
                                  p.id === pair.id ? { ...p, leftMedia: e.target.value } : p
                                ),
                              })
                            }
                            className="flex-1 text-[11px] border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 outline-none bg-transparent font-mono"
                          />
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleMediaUpload(
                                  file,
                                  (fn) =>
                                    updateQuestion(q.id, {
                                      matchingPairs: q.matchingPairs.map((p) =>
                                        p.id === pair.id ? { ...p, leftMedia: fn } : p
                                      ),
                                    }),
                                  (st) =>
                                    updateQuestion(q.id, {
                                      matchingPairs: q.matchingPairs.map((p) =>
                                        p.id === pair.id ? { ...p, leftMediaStatus: st } : p
                                      ),
                                    })
                                );
                              }
                            }}
                            className="hidden"
                            id={`pair-upload-${pair.id}`}
                          />
                          <label
                            htmlFor={`pair-upload-${pair.id}`}
                            className="border border-neutral-350 dark:border-neutral-700 px-2 py-1 rounded text-[10px] font-bold font-mono uppercase hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer shrink-0"
                          >
                            Upload
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (!exerciseId.trim()) {
                                alert("Please specify the Worksheet ID at the top of the form before searching Pixabay.");
                                  return;
                              }
                              setActiveMediaTarget(() => (fn: string) => {
                                const newPairs = q.matchingPairs.map((p) =>
                                  p.id === pair.id ? { ...p, leftMedia: fn } : p
                                );
                                updateQuestion(q.id, { matchingPairs: newPairs });
                              });
                              setActiveQuery(pair.leftText || "");
                              setIsPixabayOpen(true);
                            }}
                            className="border border-neutral-350 dark:border-neutral-700 px-2 py-1 rounded text-[10px] font-bold font-mono uppercase hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer shrink-0 flex items-center gap-0.5"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Pixabay
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] uppercase tracking-wider font-semibold text-neutral-450 block">
                          Right Target Match
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Matching text"
                          value={pair.rightText}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              matchingPairs: q.matchingPairs.map((p) =>
                                p.id === pair.id ? { ...p, rightText: e.target.value } : p
                              ),
                            })
                          }
                          className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-2.5 py-1 outline-none bg-transparent"
                        />
                      </div>

                      {q.matchingPairs.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(q.id, {
                              matchingPairs: q.matchingPairs.filter((p) => p.id !== pair.id),
                            })
                          }
                          className="text-neutral-450 hover:text-red-500 rounded p-1 mb-1 cursor-pointer"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateQuestion(q.id, {
                      matchingPairs: [
                        ...q.matchingPairs,
                        {
                          id: crypto.randomUUID(),
                          leftText: "",
                          leftMedia: "",
                          leftMediaStatus: "",
                          rightText: "",
                        },
                      ],
                    })
                  }
                  className="text-xs text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white underline font-semibold cursor-pointer block mt-1"
                >
                  + Add Matching Pair
                </button>
              </div>
            )}

            {q.type === "instruction" && (
              <div className="space-y-2 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                  Instruction Cards Text (Supports Markdown/Whitespace prewrap)
                </label>
                <textarea
                  required
                  placeholder="Type directions, section warnings, or readings here..."
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                  rows={4}
                  className="w-full text-xs border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 outline-none bg-transparent"
                />
              </div>
            )}

            {q.type === "open-question" && (
              <div className="space-y-3 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                    Keywords for correct checking (Separated by ##, e.g. ##apple##2 ##fruit ##pear)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ##apple##2 ##fruit ##pear"
                    value={q.keywords}
                    onChange={(e) => updateQuestion(q.id, { keywords: e.target.value })}
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none font-mono"
                  />
                  <span className="text-[9px] text-neutral-455 italic block leading-relaxed">
                    Case-insensitive. Prepend each keyword with ##. Optional score weights can be specified after the keyword, e.g., <code>##apple##2</code> (awarding 2x weight value).
                  </span>
                </div>
              </div>
            )}

            {q.type === "ordering" && (
              <div className="space-y-3 pl-4 border-l-2 border-neutral-250 dark:border-neutral-800">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                    Correct Ordered Sentence Text
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The quick brown fox jumps over the lazy dog"
                    value={q.orderingSentence}
                    onChange={(e) => updateQuestion(q.id, { orderingSentence: e.target.value })}
                    className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-3 py-1.5 outline-none"
                  />
                  <span className="text-[9px] text-neutral-450 italic block">
                    Words will be automatically shuffled. The student must reconstruct this exact sentence sequence.
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Quick Add Buttons at bottom */}
      <div className="p-4 border border-dashed rounded flex flex-wrap gap-2 items-center justify-center bg-neutral-50/50 dark:bg-neutral-950/10">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500 mr-2">
          + Add task:
        </span>
        <button
          type="button"
          onClick={() => addQuestion("multiple-choice")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
        >
          Multiple Choice
        </button>
        <button
          type="button"
          onClick={() => addQuestion("gap-fill")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
        >
          Write Into Gap
        </button>
        <button
          type="button"
          onClick={() => addQuestion("drag-drop")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
        >
          Drag & Drop
        </button>
        <button
          type="button"
          onClick={() => addQuestion("categorization")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
        >
          Categorization Sorting
        </button>
        <button
          type="button"
          onClick={() => addQuestion("clickable-choice")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
        >
          Clickable Choice
        </button>
        <button
          type="button"
          onClick={() => addQuestion("matching")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
        >
          Connections Match
        </button>
        <button
          type="button"
          onClick={() => addQuestion("open-question")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
        >
          Open Question
        </button>
        <button
          type="button"
          onClick={() => addQuestion("ordering")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
        >
          Word Ordering
        </button>
        <button
          type="button"
          onClick={() => addQuestion("media")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs border-dashed"
        >
          Solely Media
        </button>
        <button
          type="button"
          onClick={() => addQuestion("instruction")}
          className="px-2.5 py-1 border bg-white dark:bg-neutral-900 rounded text-xs font-mono font-semibold uppercase hover:bg-neutral-100 transition cursor-pointer shadow-2xs border-dashed"
        >
          Instructions Card
        </button>
      </div>

      <PixabaySearchModal
        exerciseId={exerciseId}
        isOpen={isPixabayOpen}
        onClose={() => setIsPixabayOpen(false)}
        onSelect={(fn) => {
          if (activeMediaTarget) {
            activeMediaTarget(fn);
          }
        }}
        defaultQuery={activeQuery}
      />
    </div>
  );
}
