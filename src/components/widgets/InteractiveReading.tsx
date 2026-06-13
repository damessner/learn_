"use client";

import React, { useState, useEffect, useMemo } from "react";
import { WidgetProps, InteractiveReadingConfig } from "./types";
import { Check, ArrowRight, Award } from "lucide-react";
import { MediaEmbed } from "./MediaEmbed";

export const InteractiveReading: React.FC<WidgetProps<InteractiveReadingConfig>> = ({
  config,
  assetsPath,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  // Current active page ID
  const [currentPageId, setCurrentPageId] = useState<string>(
    savedState?.currentPageId || config.startPage
  );

  // Visited pages trail
  const [visitedPages, setVisitedPages] = useState<string[]>(
    savedState?.visitedPages || [config.startPage]
  );

  // User input answers: pageId -> questionId -> answer text or choice index
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>(
    savedState?.answers || {}
  );

  // Solved status: pageId -> questionId -> boolean
  const [solvedQuestions, setSolvedQuestions] = useState<Record<string, Record<string, boolean>>>(
    savedState?.solvedQuestions || {}
  );

  // General completed state
  const [isCompleted, setIsCompleted] = useState<boolean>(
    savedState?.isCompleted || false
  );

  // Get active page config
  const page = useMemo(() => {
    return config.pages[currentPageId] || config.pages[config.startPage];
  }, [config.pages, currentPageId, config.startPage]);

  // Total questions in the book config
  const totalQuestions = useMemo(() => {
    let count = 0;
    Object.values(config.pages).forEach((p) => {
      if (p.questions) count += p.questions.length;
    });
    return count;
  }, [config.pages]);

  // Questions on current page
  const pageQuestions = useMemo(() => page?.questions || [], [page?.questions]);

  // Determine if current page is unlocked (all questions on it are solved)
  const isPageUnlocked = useMemo(() => {
    if (pageQuestions.length === 0) return true;
    const pageSolved = solvedQuestions[currentPageId] || {};
    return pageQuestions.every((q) => pageSolved[q.id] === true);
  }, [pageQuestions, solvedQuestions, currentPageId]);

  // Handle single question answer check
  const handleCheckQuestion = (q: InteractiveReadingConfig["pages"][string]["questions"][number], studentAnswer: string) => {
    if (isReadOnly) return;

    let correct = false;
    if (q.type === "multiple-choice") {
      const idx = parseInt(studentAnswer);
      correct = idx === q.correctOptionIdx;
    } else if (q.type === "open-question") {
      const cleanAns = studentAnswer.trim().toLowerCase();
      const keywords = q.keywords || [];
      correct = keywords.some(
        (kw: string) => cleanAns.includes(kw.trim().toLowerCase())
      );
    }

    setSolvedQuestions((prev) => {
      const pageSolved = prev[currentPageId] || {};
      const updated = {
        ...prev,
        [currentPageId]: {
          ...pageSolved,
          [q.id]: correct,
        },
      };

      // Recalculate score and check if page transitions
      return updated;
    });
  };

  // Check answers of all questions on current page
  const checkAllPageAnswers = () => {
    pageQuestions.forEach((q) => {
      const ans = answers[currentPageId]?.[q.id] || "";
      handleCheckQuestion(q, ans);
    });
  };

  // Report state to parent runner
  useEffect(() => {
    // Calculate total points earned in this play
    let points = 0;
    Object.keys(solvedQuestions).forEach((pId) => {
      const pageSolved = solvedQuestions[pId] || {};
      Object.values(pageSolved).forEach((val) => {
        if (val) points++;
      });
    });

    // Score is (points / totalQuestions) * 100
    const score = totalQuestions > 0 ? (points / totalQuestions) * 100 : 100;

    // Check if reached an ending page (a page with no choices)
    const hasChoices = page?.choices && page.choices.length > 0;
    const reachedEnd = isPageUnlocked && !hasChoices;
    const complete = reachedEnd || isCompleted;

    onChange(
      {
        currentPageId,
        visitedPages,
        answers,
        solvedQuestions,
        isCompleted: complete,
      },
      complete,
      score
    );
  }, [currentPageId, visitedPages, answers, solvedQuestions, isCompleted, isPageUnlocked, page, totalQuestions, onChange]);

  // Navigate to another page via choice path
  const handleChoosePath = (nextPageId: string) => {
    if (!isPageUnlocked && !isReadOnly) return;
    if (!config.pages[nextPageId]) return;

    setCurrentPageId(nextPageId);
    setVisitedPages((prev) => {
      if (prev.includes(nextPageId)) return prev;
      return [...prev, nextPageId];
    });
  };

  // Restart book story
  const restartBook = () => {
    setCurrentPageId(config.startPage);
    setVisitedPages([config.startPage]);
    setAnswers({});
    setSolvedQuestions({});
    setIsCompleted(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Book Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 rounded">
            Interactive Book
          </span>
          <h3 className="text-base font-bold text-neutral-850 dark:text-neutral-200 mt-1">
            {config.title}
          </h3>
          {config.description && (
            <p className="text-xs text-neutral-550 mt-0.5">{config.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded">
            Pages visited: {visitedPages.length}
          </div>
          {totalQuestions > 0 && (
            <div className="bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded">
              Tasks solved: {Object.values(solvedQuestions).flatMap(Object.values).filter(Boolean).length} / {totalQuestions}
            </div>
          )}
        </div>
      </div>

      {/* Book Double-Page Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white dark:bg-neutral-900 border border-neutral-250 dark:border-neutral-800 rounded-lg shadow-sm overflow-hidden">
        {/* Left Side: Story / Text / Image (7 cols) */}
        <div className="md:col-span-7 p-6 space-y-4 border-r border-neutral-150 dark:border-neutral-800">
          {page?.title && (
            <h4 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-1 text-neutral-800 dark:text-neutral-250">
              {page.title}
            </h4>
          )}

          {page?.media && (
            <div className="relative border rounded overflow-hidden max-h-[40vh] bg-neutral-50 dark:bg-neutral-95/20 dark:bg-neutral-950/20 p-2">
              <MediaEmbed src={page.media} assetsPath={assetsPath} />
            </div>
          )}

          <div className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line">
            {page?.text}
          </div>
        </div>

        {/* Right Side: Questions & Path Selection (5 cols) */}
        <div className="md:col-span-5 p-6 bg-neutral-50/45 dark:bg-neutral-950/10 space-y-5">
          {/* Section: Page Tasks (Unlock criteria) */}
          {pageQuestions.length > 0 && (
            <div className="space-y-4">
              <h5 className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 border-b pb-1">
                🔒 Required Tasks to unlock path
              </h5>

              <div className="space-y-3.5">
                {pageQuestions.map((q, idx) => {
                  const isSolved = solvedQuestions[currentPageId]?.[q.id] === true;
                  const currentVal = answers[currentPageId]?.[q.id] || "";

                  return (
                    <div
                      key={q.id}
                      className={`p-3 border rounded text-xs space-y-2 transition-all ${
                        isSolved
                          ? "border-green-200 bg-green-50/10 dark:bg-green-950/5"
                          : "border-neutral-200 bg-white dark:bg-neutral-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-350">
                          {idx + 1}. {q.prompt}
                        </span>
                        {isSolved && <Check className="w-4 h-4 text-green-650 shrink-0" />}
                      </div>

                      {q.type === "multiple-choice" ? (
                        <div className="space-y-1.5 pt-1">
                          {q.options?.map((opt: string, oIdx: number) => {
                            const isSelected = currentVal === String(oIdx);
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                disabled={isSolved || isReadOnly}
                                onClick={() => {
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [currentPageId]: {
                                      ...(prev[currentPageId] || {}),
                                      [q.id]: String(oIdx),
                                    },
                                  }));
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded border text-[11px] transition ${
                                  isSelected
                                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black font-semibold"
                                    : "border-neutral-200 dark:border-neutral-750 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="pt-1">
                          <input
                            type="text"
                            disabled={isSolved || isReadOnly}
                            placeholder="Type your answer..."
                            value={currentVal}
                            onChange={(e) => {
                              setAnswers((prev) => ({
                                ...prev,
                                [currentPageId]: {
                                  ...(prev[currentPageId] || {}),
                                  [q.id]: e.target.value,
                                },
                              }));
                            }}
                            className="w-full text-base md:text-sm border border-neutral-300 dark:border-neutral-750 rounded px-2.5 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isPageUnlocked && !isReadOnly && (
                <button
                  type="button"
                  onClick={checkAllPageAnswers}
                  className="w-full bg-black text-white dark:bg-white dark:text-black py-2 rounded text-xs font-semibold hover:opacity-90 transition shadow-sm cursor-pointer"
                >
                  Verify Answers
                </button>
              )}
            </div>
          )}

          {/* Section: Pathway Selection ( unlocked choices ) */}
          {isPageUnlocked && (
            <div className="space-y-3 animate-fade-in">
              <h5 className="text-[10px] font-mono font-bold uppercase tracking-wider text-green-650 dark:text-green-400 border-b pb-1">
                🔓 Choose your adventure path
              </h5>

              {page?.choices && page.choices.length > 0 ? (
                <div className="space-y-2">
                  {page.choices.map((choice, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => handleChoosePath(choice.nextPageId)}
                      className="w-full text-left p-3 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-lg hover:border-black dark:hover:border-white transition flex items-center justify-between text-xs cursor-pointer group shadow-sm"
                    >
                      <span className="font-semibold group-hover:underline">
                        {choice.text}
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 border border-green-300 bg-green-50/10 dark:bg-green-950/5 rounded text-center space-y-2">
                  <Award className="w-8 h-8 text-green-500 mx-auto" />
                  <h6 className="font-bold text-green-700 dark:text-green-350">The End!</h6>
                  <p className="text-[11px] text-neutral-550">
                    You have successfully completed this branch of the adventure.
                  </p>
                  {!isReadOnly && (
                    <button
                      onClick={restartBook}
                      className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 underline block mx-auto pt-1 hover:text-black"
                    >
                      Read again / Try other paths
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review Mode Trail Display */}
      {isReadOnly && (
        <div className="p-4 border rounded bg-neutral-50 dark:bg-neutral-950/20 space-y-2 text-xs">
          <span className="font-bold font-mono uppercase tracking-wider text-neutral-500 block">
            Adventure Map Path Traveled
          </span>
          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px]">
            {visitedPages.map((pId, idx) => (
              <React.Fragment key={pId}>
                {idx > 0 && <span className="text-neutral-450">→</span>}
                <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-800 rounded font-semibold">
                  {config.pages[pId]?.title || pId}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveReading;
