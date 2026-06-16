"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getConversationList,
  getConversationDetail,
  sendChatMessageAction,
  startSocraticChatAction,
  startLearningSessionAction,
  submitLearningAnswersAction,
  getUserQuotaAction,
} from "@/lib/actions/aloys";

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  type: string;
  metadataJson: string | null;
  createdAt: Date;
}

interface QuotaInfo {
  dailyRemaining: number;
  dailyLimit: number;
  weeklyRemaining: number;
  weeklyLimit: number;
  dailyResetInMs: number;
  weeklyResetInMs: number;
  role: string;
}

interface SocraticClientPageProps {
  initialConversations: Conversation[];
  initialQuota: QuotaInfo;
}

export function SocraticClientPage({
  initialConversations,
  initialQuota,
}: SocraticClientPageProps) {
  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [activeConversation, setActiveConversation] = useState<{
    id: string;
    title: string;
    messages: Message[];
  } | null>(null);

  const [quota, setQuota] = useState<QuotaInfo>(initialQuota);
  const [topic, setTopic] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Record<number, number>>>({}); // messageId -> { questionIdx -> optionIdx }
  const [isPending, startTransition] = useTransition();
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll quota and time remaining calculations
  const [dailyTimeText, setDailyTimeText] = useState("");
  const [weeklyTimeText, setWeeklyTimeText] = useState("");

  useEffect(() => {
    let dailyMs = quota.dailyResetInMs;
    let weeklyMs = quota.weeklyResetInMs;

    const updateTimers = () => {
      if (dailyMs > 0) {
        const h = Math.floor(dailyMs / (1000 * 60 * 60));
        const m = Math.floor((dailyMs % (1000 * 60 * 60)) / (1000 * 60));
        setDailyTimeText(`resets in ${h}h ${m}m`);
        dailyMs -= 60000;
      } else {
        setDailyTimeText("resetting daily quota...");
      }

      if (weeklyMs > 0) {
        const d = Math.floor(weeklyMs / (1000 * 60 * 60 * 24));
        const h = Math.floor((weeklyMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setWeeklyTimeText(`resets in ${d}d ${h}h`);
        weeklyMs -= 60000;
      } else {
        setWeeklyTimeText("resetting weekly quota...");
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 60000);
    return () => clearInterval(interval);
  }, [quota]);

  // Load a conversation detail
  const loadConversation = async (id: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const detail = await getConversationDetail(id);
      setActiveConversation({
        id: detail.id,
        title: detail.title,
        messages: detail.messages.map((m) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
      });
      setActiveConversationId(id);
    } catch (err: any) {
      setError(err.message || "Failed to load conversation details");
    } finally {
      setLoadingMessages(false);
    }
  };

  // Refetches quota
  const refreshQuota = async () => {
    try {
      const q = await getUserQuotaAction();
      setQuota(q);
    } catch (e) {
      console.error(e);
    }
  };

  // Starts a new Socratic Chat
  const handleStartChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await startSocraticChatAction(topic);
        setTopic("");
        // Reload lists
        const list = await getConversationList();
        setConversations(list);
        await refreshQuota();
        await loadConversation(result.conversationId);
      } catch (err: any) {
        setError(err.message || "Failed to start chat session");
      }
    });
  };

  // Starts a Socratic Lesson (Learning Mode)
  const handleStartLesson = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await startLearningSessionAction(topic);
        setTopic("");
        const list = await getConversationList();
        setConversations(list);
        await refreshQuota();
        await loadConversation(result.conversationId);
      } catch (err: any) {
        setError(err.message || "Failed to start learning session");
      }
    });
  };

  // Sends message in normal chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeConversationId) return;
    const msgText = chatInput.trim();
    setChatInput("");
    setError(null);

    // Optimistic user message update
    const tempUserMsg: Message = {
      id: "temp-user",
      conversationId: activeConversationId,
      role: "user",
      content: msgText,
      type: "CHAT",
      metadataJson: null,
      createdAt: new Date(),
    };

    setActiveConversation((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...prev.messages, tempUserMsg],
      };
    });

    try {
      const responseMsg = await sendChatMessageAction(activeConversationId, msgText);
      await refreshQuota();
      // Replace optimistic and append reply
      setActiveConversation((prev) => {
        if (!prev) return null;
        const filtered = prev.messages.filter((m) => m.id !== "temp-user");
        return {
          ...prev,
          messages: [...filtered, { ...tempUserMsg, id: "actual-user" }, { ...responseMsg, createdAt: new Date(responseMsg.createdAt) }],
        };
      });
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      // Remove optimistic user message on error
      setActiveConversation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.filter((m) => m.id !== "temp-user"),
        };
      });
    }
  };

  // Submits multiple choice answers
  const handleSubmitAnswers = async (messageId: string) => {
    if (!activeConversationId) return;
    const answers = selectedAnswers[messageId] || {};
    setError(null);

    startTransition(async () => {
      try {
        const responseMsg = await submitLearningAnswersAction(
          activeConversationId,
          messageId,
          answers
        );
        // Reload details to display assessment and feedback
        await loadConversation(activeConversationId);
      } catch (err: any) {
        setError(err.message || "Failed to submit answers");
      }
    });
  };

  // Triggers follow-up topic exploration lesson directly
  const handleSelectSuggestion = async (suggestedTopic: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startLearningSessionAction(suggestedTopic);
        const list = await getConversationList();
        setConversations(list);
        await refreshQuota();
        await loadConversation(result.conversationId);
      } catch (err: any) {
        setError(err.message || "Failed to start suggested learning session");
      }
    });
  };

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-0">
      {/* LEFT COLUMN: Sidebar with Systems status and input */}
      <div className="md:col-span-1 flex flex-col space-y-6 overflow-y-auto pr-2">
        {/* Aloys System Info / Contingents */}
        <div className="border border-black dark:border-white p-5 bg-white dark:bg-black/10 select-none">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[#ff2a2e] mb-4 flex items-center">
            <span className="inline-block w-2 h-2 bg-[#ff2a2e] mr-2 animate-pulse" />
            ALOYS.SYS // HELPING CONTINGENT
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center text-xs font-mono mb-1">
                <span>DAILY CONTINGENT</span>
                <span className="font-bold">
                  {quota.role === "TEACHER" || quota.role === "ADMIN"
                    ? "UNLIMITED"
                    : `${quota.dailyRemaining} / ${quota.dailyLimit}`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-900 overflow-hidden">
                <div
                  className="h-full bg-black dark:bg-white transition-all duration-300"
                  style={{
                    width:
                      quota.role === "TEACHER" || quota.role === "ADMIN"
                        ? "100%"
                        : `${(quota.dailyRemaining / quota.dailyLimit) * 100}%`,
                  }}
                />
              </div>
              {quota.role !== "TEACHER" && quota.role !== "ADMIN" && (
                <span className="text-[10px] font-mono text-neutral-400 block mt-1">
                  {dailyTimeText}
                </span>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-mono mb-1">
                <span>WEEKLY CONTINGENT</span>
                <span className="font-bold">
                  {quota.role === "TEACHER" || quota.role === "ADMIN"
                    ? "UNLIMITED"
                    : `${quota.weeklyRemaining} / ${quota.weeklyLimit}`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-900 overflow-hidden">
                <div
                  className="h-full bg-black dark:bg-white transition-all duration-300"
                  style={{
                    width:
                      quota.role === "TEACHER" || quota.role === "ADMIN"
                        ? "100%"
                        : `${(quota.weeklyRemaining / quota.weeklyLimit) * 100}%`,
                  }}
                />
              </div>
              {quota.role !== "TEACHER" && quota.role !== "ADMIN" && (
                <span className="text-[10px] font-mono text-neutral-400 block mt-1">
                  {weeklyTimeText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Start a Socratic Session */}
        <div className="border border-black dark:border-white p-5 bg-white dark:bg-black/10">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest mb-3">
            CONSULT ALOYS
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                Enter topic area or question:
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Mitochondria, Solar System, etc."
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                disabled={isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleStartLesson()}
                disabled={isPending || !topic.trim()}
                className="w-full border border-black dark:border-white bg-black dark:bg-white text-white dark:text-black font-mono text-[10px] uppercase tracking-wider py-2.5 rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition disabled:opacity-40 cursor-pointer"
              >
                Start Lesson
              </button>
              <button
                type="button"
                onClick={() => handleStartChat()}
                disabled={isPending || !topic.trim()}
                className="w-full border border-neutral-300 dark:border-neutral-800 bg-transparent text-black dark:text-white font-mono text-[10px] uppercase tracking-wider py-2.5 rounded-none hover:border-black dark:hover:border-white transition disabled:opacity-40 cursor-pointer"
              >
                Socratic Chat
              </button>
            </div>
          </form>
        </div>

        {/* Previous consultations */}
        <div className="border border-black dark:border-white p-5 flex-1 flex flex-col min-h-0 bg-white dark:bg-black/10">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest mb-3 select-none">
            CONSULTATION LOGS
          </h2>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {conversations.length === 0 ? (
              <span className="text-[10px] font-mono text-neutral-500 block italic py-4 select-none">
                No logs recorded yet.
              </span>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeConversationId;
                return (
                  <button
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className={`w-full text-left p-3 font-mono text-[11px] border border-neutral-200 dark:border-neutral-800 transition select-none flex flex-col space-y-1 rounded-none cursor-pointer ${
                      isActive
                        ? "bg-neutral-100 dark:bg-neutral-800 border-black dark:border-white font-bold"
                        : "hover:border-neutral-400 dark:hover:border-neutral-700 bg-transparent"
                    }`}
                  >
                    <span className="truncate">{c.title}</span>
                    <span className="text-[9px] text-neutral-400">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Chat / Interactive assessment log */}
      <div className="md:col-span-2 border border-black dark:border-white flex flex-col h-full bg-white dark:bg-black/10 min-h-0">
        {error && (
          <div className="bg-[#ff2a2e]/10 border-b border-[#ff2a2e] text-[#ff2a2e] font-mono text-[11px] p-3">
            [ERROR] {error}
          </div>
        )}

        {/* Header bar */}
        <div className="border-b border-black dark:border-white px-5 py-3 flex items-center justify-between select-none">
          <span className="font-mono text-xs font-bold uppercase tracking-wider">
            {activeConversation
              ? `LOG: ${activeConversation.title}`
              : "TERMINAL: LOGS NOT CONNECTED"}
          </span>
          <span className="font-mono text-[10px] text-neutral-400">
            {activeConversation ? "READY" : "STANDBY"}
          </span>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center font-mono text-xs text-neutral-500 animate-pulse">
              RETRIEVING ENCRYPTED DIALOGUE...
            </div>
          ) : !activeConversation ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 select-none">
              <span className="text-3xl">🩺</span>
              <p className="font-mono text-xs text-neutral-400 max-w-sm leading-relaxed">
                Consult with Dr. Aloys. Select a past conversation from the logs or type a new topic area in the panel to begin a guided Socratic lesson.
              </p>
            </div>
          ) : (
            activeConversation.messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className="space-y-1">
                  <div className="flex items-center space-x-2 font-mono text-[9px] text-neutral-400 select-none">
                    <span>{isUser ? "// STUDENT" : "// DR. ALOYS"}</span>
                    <span>•</span>
                    <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>

                  {m.type === "CHAT" && (
                    <div
                      className={`font-mono text-xs p-4 rounded-none leading-relaxed border ${
                        isUser
                          ? "bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 ml-6 text-neutral-700 dark:text-neutral-300"
                          : "bg-white dark:bg-black/50 border-black dark:border-white mr-6 text-black dark:text-white"
                      }`}
                    >
                      {m.content}
                    </div>
                  )}

                  {m.type === "LEARN_TEXT" && (
                    <div className="bg-white dark:bg-black/50 border border-black dark:border-white p-5 mr-6 rounded-none space-y-3 font-mono text-xs leading-relaxed text-black dark:text-white">
                      <div className="border-b border-neutral-300 dark:border-neutral-800 pb-2 mb-2 flex justify-between items-center text-[10px] text-neutral-400 tracking-wider uppercase select-none">
                        <span>Report / Reading Material</span>
                        <span>Aloys Founder Log</span>
                      </div>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  )}

                  {m.type === "LEARN_QUESTIONS" && (
                    <div className="bg-white dark:bg-black/50 border border-black dark:border-white p-5 mr-6 rounded-none space-y-5 font-mono text-xs text-black dark:text-white">
                      <div className="border-b border-neutral-300 dark:border-neutral-800 pb-2 mb-2 flex justify-between items-center text-[10px] text-neutral-400 tracking-wider uppercase select-none">
                        <span>Understanding Check</span>
                        <span>Assessment Suite</span>
                      </div>
                      
                      {(() => {
                        const metadata = JSON.parse(m.metadataJson || "{}");
                        const questions = metadata.questions as Array<{
                          question: string;
                          options: string[];
                          correctIndex: number;
                        }>;

                        // Check if this lesson has been answered (i.e. does an assessment feedback message follow it?)
                        const isAnswered = activeConversation.messages.some(
                          (msg) => msg.type === "LEARN_ANSWERS"
                        );

                        if (!questions) return null;

                        return (
                          <div className="space-y-6">
                            {questions.map((q, qIdx) => {
                              const qKey = `${m.id}-${qIdx}`;
                              const userSelection =
                                selectedAnswers[m.id]?.[qIdx];
                              
                              return (
                                <div key={qIdx} className="space-y-2">
                                  <p className="font-bold">
                                    {qIdx + 1}. {q.question}
                                  </p>
                                  <div className="grid grid-cols-1 gap-2 pl-2">
                                    {q.options.map((opt, oIdx) => {
                                      const isSelected = userSelection === oIdx;
                                      return (
                                        <button
                                          key={oIdx}
                                          disabled={isAnswered || isPending}
                                          onClick={() => {
                                            setSelectedAnswers((prev) => {
                                              const currentAnswers = prev[m.id] || {};
                                              return {
                                                ...prev,
                                                [m.id]: {
                                                  ...currentAnswers,
                                                  [qIdx]: oIdx,
                                                },
                                              };
                                            });
                                          }}
                                          className={`w-full text-left p-2.5 font-mono text-[11px] border transition flex items-center space-x-3 rounded-none cursor-pointer ${
                                            isSelected
                                              ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white"
                                              : "bg-transparent border-neutral-300 dark:border-neutral-800 hover:border-neutral-600 dark:hover:border-neutral-400"
                                          }`}
                                        >
                                          <span className="font-mono text-[9px] uppercase tracking-widest select-none">
                                            {isSelected ? "[X]" : "[ ]"}
                                          </span>
                                          <span>{opt}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}

                            {!isAnswered && (
                              <button
                                onClick={() => handleSubmitAnswers(m.id)}
                                disabled={
                                  isPending ||
                                  Object.keys(selectedAnswers[m.id] || {}).length <
                                    questions.length
                                }
                                className="w-full bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-mono text-[10px] uppercase tracking-wider py-3 rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition disabled:opacity-30 cursor-pointer"
                              >
                                {isPending ? "Grading..." : "Submit Assessment"}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {m.type === "LEARN_ANSWERS" && (
                    <div className="bg-white dark:bg-black/50 border border-[#ff2a2e] p-5 mr-6 rounded-none space-y-4 font-mono text-xs text-black dark:text-white">
                      <div className="border-b border-[#ff2a2e]/30 pb-2 mb-2 flex justify-between items-center text-[10px] text-[#ff2a2e] tracking-wider uppercase select-none">
                        <span>Diagnostic Results</span>
                        <span>Assessment Feedback</span>
                      </div>
                      
                      <div className="whitespace-pre-wrap">{m.content}</div>

                      {(() => {
                        const metadata = JSON.parse(m.metadataJson || "{}");
                        const suggestions = (metadata.suggestions as string[]) || [];

                        if (suggestions.length === 0) return null;

                        return (
                          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800">
                            <span className="text-[10px] text-neutral-400 uppercase block mb-2 select-none">
                              Suggested Exploration Paths:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {suggestions.map((sugTopic, sIdx) => (
                                <button
                                  key={sIdx}
                                  disabled={isPending}
                                  onClick={() => handleSelectSuggestion(sugTopic)}
                                  className="border border-neutral-300 dark:border-neutral-800 text-[10px] font-mono py-1.5 px-3 rounded-none uppercase hover:border-[#ff2a2e] hover:text-[#ff2a2e] transition disabled:opacity-40 cursor-pointer"
                                >
                                  [+] {sugTopic}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Chat Footer Input for normal chats */}
        {activeConversation &&
          activeConversation.messages.length > 0 &&
          activeConversation.messages[activeConversation.messages.length - 1].type === "CHAT" && (
            <form
              onSubmit={handleSendMessage}
              className="border-t border-black dark:border-white p-4 flex items-center space-x-3 bg-neutral-50 dark:bg-black/20"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Aloys a follow-up question..."
                className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-3 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={isPending || !chatInput.trim()}
                className="bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-mono text-[10px] uppercase tracking-wider py-3 px-6 rounded-none hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition disabled:opacity-40 cursor-pointer"
              >
                Send
              </button>
            </form>
          )}
      </div>
    </div>
  );
}
