"use client";

import React from "react";
import { Upload, X, Plus, Trash } from "lucide-react";

export interface ReadingPageCreator {
  id: string; // unique page Key
  title: string;
  text: string;
  media: string;
  mediaStatus: string;
  ttsEnabled?: boolean;
  choices: Array<{
    text: string;
    nextPageId: string;
  }>;
  questions: Array<{
    id: string;
    type: "multiple-choice" | "open-question";
    prompt: string;
    options: string[];
    correctOptionIdx: number;
    keywords: string;
  }>;
}

interface InteractiveReadingBuilderProps {
  id: string;
  readingPages: ReadingPageCreator[];
  setReadingPages: React.Dispatch<React.SetStateAction<ReadingPageCreator[]>>;
  startPageId: string;
  setStartPageId: (val: string) => void;
  handleMediaUpload: (
    file: File,
    onUploaded: (filename: string) => void,
    onStatus: (status: string) => void
  ) => Promise<void>;
}

export function InteractiveReadingBuilder({
  readingPages,
  setReadingPages,
  startPageId,
  setStartPageId,
  handleMediaUpload,
}: InteractiveReadingBuilderProps) {

  const addReadingPage = () => {
    const newId = `page-${Math.random().toString(36).substring(7)}`;
    setReadingPages((prev) => [
      ...prev,
      {
        id: newId,
        title: "",
        text: "",
        media: "",
        mediaStatus: "",
        ttsEnabled: false,
        choices: [],
        questions: [],
      },
    ]);
  };

  const removeReadingPage = (pageId: string) => {
    setReadingPages((prev) => prev.filter((p) => p.id !== pageId));
    if (startPageId === pageId) {
      setStartPageId("intro");
    }
  };

  const updateReadingPage = (pageId: string, fields: Partial<ReadingPageCreator>) => {
    setReadingPages((prev) => {
      const pageIndex = prev.findIndex((p) => p.id === pageId);
      if (pageIndex === -1) return prev;

      const updated = [...prev];
      const targetPage = { ...updated[pageIndex], ...fields };

      // Handle ID change propagation in paths
      if (fields.id && fields.id !== pageId) {
        return prev.map((p) => {
          if (p.id === pageId) {
            return targetPage;
          }
          const updatedChoices = p.choices.map((c) =>
            c.nextPageId === pageId ? { ...c, nextPageId: fields.id! } : c
          );
          return { ...p, choices: updatedChoices };
        });
      }

      updated[pageIndex] = targetPage;
      return updated;
    });
  };

  const addReadingPageQuestion = (pageId: string) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          questions: [
            ...(p.questions || []),
            {
              id: Math.random().toString(36).substring(7),
              type: "multiple-choice" as const,
              prompt: "",
              options: ["", ""],
              correctOptionIdx: 0,
              keywords: "",
            },
          ],
        };
      })
    );
  };

  const removeReadingPageQuestion = (pageId: string, qId: string) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          questions: p.questions.filter((q) => q.id !== qId),
        };
      })
    );
  };

  const updateReadingPageQuestion = (
    pageId: string,
    qId: string,
    fields: Partial<ReadingPageCreator["questions"][number]>
  ) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const updatedQs = p.questions.map((q) =>
          q.id === qId ? { ...q, ...fields } : q
        );
        return { ...p, questions: updatedQs as ReadingPageCreator["questions"] };
      })
    );
  };

  const addReadingPageChoice = (pageId: string) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          choices: [
            ...(p.choices || []),
            {
              text: "",
              nextPageId: "",
            },
          ],
        };
      })
    );
  };

  const removeReadingPageChoice = (pageId: string, choiceIdx: number) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          choices: p.choices.filter((_, idx) => idx !== choiceIdx),
        };
      })
    );
  };

  const updateReadingPageChoice = (
    pageId: string,
    choiceIdx: number,
    fields: Partial<ReadingPageCreator["choices"][number]>
  ) => {
    setReadingPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const updatedChoices = p.choices.map((c, idx) =>
          idx === choiceIdx ? { ...c, ...fields } : c
        );
        return { ...p, choices: updatedChoices };
      })
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Start page selector */}
      <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-2">
          📖 Choose Your Adventure Config
        </h3>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
            Starting Story Page Key
          </label>
          <select
            value={startPageId}
            onChange={(e) => setStartPageId(e.target.value)}
            className="w-full max-w-xs text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2.5 py-1.5 outline-none font-mono font-bold"
          >
            {readingPages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.title ? `(${p.title})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pages header with add button */}
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wide text-neutral-600 dark:text-neutral-350">
          Book Pages Trail ({readingPages.length})
        </h3>
        <button
          type="button"
          onClick={addReadingPage}
          className="flex items-center gap-1 text-xs border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer select-none uppercase font-mono"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Story Page
        </button>
      </div>

      {/* List of reading pages */}
      {readingPages.map((p, pIdx) => (
        <div
          key={p.id}
          className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-5 relative"
        >
          {/* Page header controls */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-250 dark:border-neutral-750">
                Page {pIdx + 1}
              </span>
              <input
                type="text"
                required
                placeholder="Page ID Key (e.g. entry, escape-path)"
                value={p.id}
                onChange={(e) => {
                  const cleaned = e.target.value.toLowerCase().replace(/[^a-zA-Z0-9-]/g, "");
                  updateReadingPage(p.id, { id: cleaned });
                }}
                className="text-xs border-b border-dashed border-neutral-400 focus:border-black outline-none font-mono font-bold w-48 bg-transparent"
              />
            </div>
            {readingPages.length > 1 && (
              <button
                type="button"
                onClick={() => removeReadingPage(p.id)}
                className="text-neutral-400 hover:text-red-500 cursor-pointer transition"
              >
                <Trash className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Title and Media Illustration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                  Page Title Header
                </label>
                <label className="flex items-center gap-1 text-[10px] font-mono font-bold text-neutral-450 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.ttsEnabled || false}
                    onChange={(e) => updateReadingPage(p.id, { ttsEnabled: e.target.checked })}
                    className="h-3.5 w-3.5 cursor-pointer accent-purple-650"
                  />
                  <span>🔊 English TTS</span>
                </label>
              </div>
              <input
                type="text"
                placeholder="e.g. Inside the Giant Castle"
                value={p.title}
                onChange={(e) => updateReadingPage(p.id, { title: e.target.value })}
                className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none"
              />
            </div>

            {/* Image illustration uploader */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
                Optional Illustration Picture (e.g. castle.png)
              </label>
              <div className="flex flex-col md:flex-row gap-3 items-center">
                <input
                  type="text"
                  placeholder="Image filename (e.g. forest.png)"
                  value={p.media}
                  onChange={(e) => updateReadingPage(p.id, { media: e.target.value })}
                  className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none font-mono"
                />
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleMediaUpload(
                          file,
                          (fn) => updateReadingPage(p.id, { media: fn }),
                          (st) => updateReadingPage(p.id, { mediaStatus: st })
                        );
                      }
                    }}
                    className="hidden"
                    id={`page-upload-${p.id}`}
                  />
                  <label
                    htmlFor={`page-upload-${p.id}`}
                    className="flex items-center gap-1 border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded text-xs font-semibold hover:bg-neutral-100 transition cursor-pointer select-none font-mono uppercase"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Browse Image
                  </label>
                </div>
              </div>
              {p.mediaStatus && (
                <span className="text-[10px] font-mono block text-neutral-500 italic">
                  {p.mediaStatus}
                </span>
              )}
            </div>
          </div>

          {/* Main Story Content Text */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
              Main Story Paragraph text
            </label>
            <textarea
              required
              rows={3}
              placeholder="Write the text describing this scene/page in the story adventure..."
              value={p.text}
              onChange={(e) => updateReadingPage(p.id, { text: e.target.value })}
              className="w-full text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1.5 outline-none"
            />
          </div>

          {/* Required Page Tasks (Unlock gate) */}
          <div className="p-4 bg-neutral-50/50 dark:bg-neutral-950/10 border border-neutral-200 dark:border-neutral-800 rounded space-y-3">
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-neutral-500">
                🔒 Required tasks to unlock pathways ({p.questions.length})
              </span>
              <button
                type="button"
                onClick={() => addReadingPageQuestion(p.id)}
                className="text-[10px] text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white underline font-bold"
              >
                + Add Task
              </button>
            </div>

            {p.questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="p-3 border rounded border-neutral-250 dark:border-neutral-750 bg-white dark:bg-neutral-900 space-y-3"
              >
                <div className="flex items-center justify-between border-b pb-1">
                  <span className="text-[10px] font-mono font-bold text-neutral-500">
                    Task {qIdx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeReadingPageQuestion(p.id, q.id)}
                    className="text-neutral-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                      Task Question / Prompt
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Find the correct passcode"
                      value={q.prompt}
                      onChange={(e) => updateReadingPageQuestion(p.id, q.id, { prompt: e.target.value })}
                      className="w-full text-xs border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2.5 py-1 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                      Task Answer Type
                    </label>
                    <select
                      value={q.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        updateReadingPageQuestion(p.id, q.id, {
                          type: e.target.value as "multiple-choice" | "open-question",
                          options: e.target.value === "multiple-choice" ? ["", ""] : undefined,
                        })
                      }
                      className="w-full text-xs border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2.5 py-1 outline-none"
                    >
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="open-question">Open Question</option>
                    </select>
                  </div>
                </div>

                {q.type === "multiple-choice" ? (
                  <div className="space-y-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450">
                        Options List (Mark correct radio button)
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateReadingPageQuestion(p.id, q.id, {
                            options: [...q.options, ""],
                          })
                        }
                        className="text-[9px] text-neutral-600 hover:text-black underline font-bold"
                      >
                        + Add Option
                      </button>
                    </div>

                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${p.id}-${q.id}`}
                            checked={q.correctOptionIdx === oIdx}
                            onChange={() => updateReadingPageQuestion(p.id, q.id, { correctOptionIdx: oIdx })}
                            className="accent-black cursor-pointer"
                          />
                          <input
                            type="text"
                            required
                            placeholder={`Option ${oIdx + 1}`}
                            value={opt}
                            onChange={(e) => {
                              const updatedOpts = q.options.map((o, idx) =>
                                idx === oIdx ? e.target.value : o
                              );
                              updateReadingPageQuestion(p.id, q.id, { options: updatedOpts });
                            }}
                            className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2 py-1 outline-none"
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updatedOpts = q.options.filter((_, idx) => idx !== oIdx);
                                const newCorrect = q.correctOptionIdx >= updatedOpts.length ? 0 : q.correctOptionIdx;
                                updateReadingPageQuestion(p.id, q.id, {
                                  options: updatedOpts,
                                  correctOptionIdx: newCorrect,
                                });
                              }}
                              className="text-neutral-400 hover:text-red-500"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    <label className="text-[9px] font-semibold uppercase tracking-wider text-neutral-450 block">
                      Accepted Answer Keywords (separated by ##, e.g. keys##key##gold)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. passcode##gate##open"
                      value={q.keywords}
                      onChange={(e) => updateReadingPageQuestion(p.id, q.id, { keywords: e.target.value })}
                      className="w-full text-xs border border-neutral-300 dark:border-neutral-750 bg-transparent rounded px-2.5 py-1 outline-none font-mono"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pathway Choices (Adventure paths) */}
          <div className="p-4 bg-neutral-50/50 dark:bg-neutral-950/10 border border-neutral-200 dark:border-neutral-800 rounded space-y-3">
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-neutral-500">
                🗺️ Choose Your Path Choices ({p.choices.length})
              </span>
              <button
                type="button"
                onClick={() => addReadingPageChoice(p.id)}
                className="text-[10px] text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white underline font-bold"
              >
                + Add Choice Path
              </button>
            </div>

            {p.choices.map((choice, cIdx) => (
              <div key={cIdx} className="flex flex-col md:flex-row gap-3 items-center bg-white dark:bg-neutral-900 p-2.5 border rounded border-neutral-250 dark:border-neutral-750">
                <input
                  type="text"
                  required
                  placeholder="Choice option text (e.g. Open the wooden door)"
                  value={choice.text}
                  onChange={(e) => updateReadingPageChoice(p.id, cIdx, { text: e.target.value })}
                  className="flex-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded px-2.5 py-1 outline-none"
                />

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold text-neutral-450">Leads to Page:</span>
                  <select
                    required
                    value={choice.nextPageId}
                    onChange={(e) => updateReadingPageChoice(p.id, cIdx, { nextPageId: e.target.value })}
                    className="text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-2.5 py-1 outline-none font-mono font-bold"
                  >
                    <option value="">-- Choose Page --</option>
                    {readingPages.map((pg) => (
                      <option key={pg.id} value={pg.id}>
                        {pg.id} {pg.title ? `(${pg.title})` : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeReadingPageChoice(p.id, cIdx)}
                    className="text-neutral-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {p.choices.length === 0 && (
              <p className="text-[10px] text-green-650 dark:text-green-400 italic">
                No choice paths defined: this page will serve as a Story Adventure ending.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
