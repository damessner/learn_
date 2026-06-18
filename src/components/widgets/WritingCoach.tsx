import React, { useState, useEffect, useRef } from "react";
import { WidgetProps, WritingCoachConfig } from "./types";
import { getWritingCoachFeedback } from "@/lib/actions/ai-coach";
import { GeminiFeedbackResponse } from "@/lib/gemini";
import { Sparkles, CheckCircle, AlertTriangle, HelpCircle, Loader2, History, ChevronDown, ChevronUp } from "lucide-react";

interface FeedbackHistoryEntry {
  timestamp: string;
  text: string;
  criteriaResults: Array<{
    id: string;
    name: string;
    status: "completed" | "needs_work" | "not_addressed";
    feedback: string;
  }>;
  overallFeedback: string;
  completedCount: number;
}

export const WritingCoach: React.FC<WidgetProps<WritingCoachConfig>> = ({
  config,
  assetsPath,
  savedState,
  onChange,
  isReadOnly = false,
}) => {
  const [text, setText] = useState<string>(savedState?.text || "");
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackHistoryEntry[]>(savedState?.feedbackHistory || []);
  const [latestFeedback, setLatestFeedback] = useState<GeminiFeedbackResponse | null>(savedState?.latestFeedback || null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Stable onChange ref
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Compute stats
  const totalCriteria = config.criteria.length;
  const completedCriteriaCount = latestFeedback
    ? latestFeedback.criteria.filter((c) => c.status === "completed").length
    : 0;

  // Track state changes and report back to assignment runner
  useEffect(() => {
    // Score is based on number of completed criteria
    const score = totalCriteria > 0 
      ? Math.round((completedCriteriaCount / totalCriteria) * 100) 
      : 100;
    
    // We consider the task complete if the student has typed something
    const isComplete = text.trim().length > 0;

    onChangeRef.current(
      {
        text,
        feedbackHistory,
        latestFeedback,
      },
      isComplete,
      score
    );
  }, [text, feedbackHistory, latestFeedback, completedCriteriaCount, totalCriteria]);

  const handleGetFeedback = async () => {
    if (feedbackHistory.length >= 3) {
      setError("You have reached the limit of 3 feedback requests for this text.");
      return;
    }

    if (!text.trim()) {
      setError("Please write some text first before asking the coach.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const criteriaList = config.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      }));

      const res = await getWritingCoachFeedback(
        text,
        config.prompt,
        criteriaList,
        config.systemPrompt
      );

      if (res.error) {
        setError(res.error);
      } else if (res.feedback) {
        const coachFeedback = res.feedback;
        setLatestFeedback(coachFeedback);

        // Add to feedback history
        const completedCount = coachFeedback.criteria.filter(
          (c) => c.status === "completed"
        ).length;

        const newEntry: FeedbackHistoryEntry = {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text,
          criteriaResults: coachFeedback.criteria.map((c) => {
            const original = config.criteria.find((crit) => crit.id === c.id);
            return {
              id: c.id,
              name: original?.name || "Criterion",
              status: c.status,
              feedback: c.feedback,
            };
          }),
          overallFeedback: coachFeedback.overallFeedback,
          completedCount,
        };

        setFeedbackHistory((prev) => [newEntry, ...prev]);
      }
    } catch (err: unknown) {
      setError("Failed to get feedback from Writing Coach: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />;
      case "needs_work":
        return <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />;
      case "not_addressed":
      default:
        return <HelpCircle className="w-5 h-5 text-neutral-450 dark:text-neutral-500 shrink-0" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-900/40";
      case "needs_work":
        return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/40";
      case "not_addressed":
      default:
        return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-450 border-neutral-200 dark:border-neutral-700/50";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "needs_work":
        return "Needs Work";
      case "not_addressed":
      default:
        return "Not Met";
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left panel: Prompt + Text Area */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        {/* Prompt Header */}
        <div className="p-5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-purple-650 dark:text-purple-400 uppercase tracking-wide">
            <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
            Writing Coach Assignment
          </div>
          <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
            {config.title || "Writing Task"}
          </h3>
          {config.description && (
            <p className="text-xs text-neutral-500 dark:text-neutral-450">
              {config.description}
            </p>
          )}
          <div className="border-t border-neutral-100 dark:border-neutral-800/60 pt-3 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {config.prompt}
          </div>
          {config.media && (
            <div className="mt-4 max-w-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-850">
              <img
                src={`${assetsPath}${config.media}`}
                alt="Prompt visual"
                className="w-full max-h-64 object-cover"
              />
            </div>
          )}
        </div>

        {/* Text Editor */}
        <div className="flex-1 flex flex-col border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800/80">
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-500">
              Your Essay / Response
            </span>
            <span className="text-xs font-mono font-semibold text-neutral-500">
              {wordCount} {wordCount === 1 ? "word" : "words"} | {text.length} chars
            </span>
          </div>

          <textarea
            disabled={isReadOnly || loading}
            autoCorrect="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            placeholder="Write your draft here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full flex-1 p-5 text-sm bg-transparent outline-none resize-none min-h-[300px] leading-relaxed text-neutral-800 dark:text-neutral-200 focus:ring-0 placeholder:text-neutral-400 font-sans"
          />

          {!isReadOnly && (
            <div className="p-4 border-t border-neutral-100 dark:border-neutral-850 bg-neutral-50/20 dark:bg-neutral-900/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-xs text-neutral-450 dark:text-neutral-550 leading-normal max-w-sm">
                {feedbackHistory.length >= 3 ? (
                  <span className="text-red-650 dark:text-red-400 font-semibold">
                    🔒 Feedback limit reached (3/3). Please read the suggestions and submit your final text.
                  </span>
                ) : (
                  <span>
                    Ask the coach for feedback. You have used{" "}
                    <strong>{feedbackHistory.length} of 3</strong> requests.
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={handleGetFeedback}
                disabled={loading || !text.trim() || feedbackHistory.length >= 3}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-semibold uppercase font-mono rounded-lg transition disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 self-end shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing draft...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Get Coach Feedback
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Right panel: Criteria Checklist & Coach Feedback */}
      <div className="lg:col-span-5 flex flex-col space-y-4">
        {/* Criteria status widget */}
        <div className="p-5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl shadow-sm space-y-4">
          <div className="space-y-3 border-b dark:border-neutral-800/80 pb-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm font-mono uppercase tracking-wide">
                Learning Goals
              </h4>
              {latestFeedback && (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-650 dark:text-neutral-350">
                  {completedCriteriaCount} / {totalCriteria} met
                </span>
              )}
            </div>

            {latestFeedback && (
              <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 dark:bg-purple-500 transition-all duration-500 rounded-full"
                  style={{ width: `${(completedCriteriaCount / totalCriteria) * 100}%` }}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            {config.criteria.map((c) => {
              const feedbackMatch = latestFeedback?.criteria?.find(
                (fc) => fc.id === c.id
              );
              const status = feedbackMatch?.status || "not_addressed";

              return (
                <div key={c.id} className="group space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-sm text-neutral-850 dark:text-neutral-200">
                        {c.name}
                      </div>
                      <div className="text-xs text-neutral-450 dark:text-neutral-500">
                        {c.description}
                      </div>
                    </div>
                    {latestFeedback ? (
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 border rounded-full text-[9px] uppercase font-mono font-bold tracking-wider ${getStatusBadgeClass(status)}`}>
                        {getStatusIcon(status)}
                        {getStatusLabel(status)}
                      </div>
                    ) : (
                      c.tip && (
                        <div className="text-[10px] italic font-mono text-neutral-400 shrink-0">
                          Goal Tip
                        </div>
                      )
                    )}
                  </div>

                  {/* Goal Tips or AI Feedback */}
                  {feedbackMatch?.feedback ? (
                    <div className="text-xs text-purple-750 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-950/10 border border-purple-100/50 dark:border-purple-900/20 p-2.5 rounded-lg leading-relaxed">
                      {feedbackMatch.feedback}
                    </div>
                  ) : (
                    c.tip && (
                      <div className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/40 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/30">
                        💡 <span className="font-medium">Tip:</span> {c.tip}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Coach Overall advice */}
        {latestFeedback && (
          <div className="p-5 border border-purple-200 dark:border-purple-900/40 bg-purple-50/15 dark:bg-purple-950/5 rounded-xl shadow-sm space-y-3">
            <h4 className="font-bold text-sm font-mono uppercase tracking-wide text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
              Coach&apos;s Advice
            </h4>
            <p className="text-xs text-neutral-750 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {latestFeedback.overallFeedback}
            </p>
          </div>
        )}

        {/* History of feedback attempts */}
        {feedbackHistory.length > 0 && (
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition"
            >
              <span className="font-bold text-sm font-mono uppercase tracking-wide flex items-center gap-2">
                <History className="w-4 h-4 text-neutral-550" />
                Revision History ({feedbackHistory.length})
              </span>
              {showHistory ? (
                <ChevronUp className="w-4 h-4 text-neutral-450" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-450" />
              )}
            </button>

            {showHistory && (
              <div className="border-t border-neutral-100 dark:border-neutral-800/80 divide-y divide-neutral-100 dark:divide-neutral-850 max-h-[300px] overflow-y-auto">
                {feedbackHistory.map((entry, idx) => (
                  <div key={idx} className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-500 dark:text-neutral-450 font-mono">
                        Draft revision {feedbackHistory.length - idx}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                        {entry.timestamp} | {entry.completedCount}/{totalCriteria} goals
                      </span>
                    </div>
                    <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded border border-neutral-100 dark:border-neutral-800/40 text-neutral-600 dark:text-neutral-350 leading-relaxed max-h-[100px] overflow-y-auto font-mono whitespace-pre-wrap">
                      {entry.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
