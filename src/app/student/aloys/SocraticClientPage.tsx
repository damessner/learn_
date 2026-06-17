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
  dailyResetInMs: number;
  windowInputRemaining: number;
  windowInputLimit: number;
  windowQuizRemaining: number;
  windowQuizLimit: number;
  windowResetInMs: number;
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
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Record<number, number>>>({});
  const [isPending, startTransition] = useTransition();
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state for ChatGPT-style sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Poll quota and time remaining calculations
  const [dailyTimeText, setDailyTimeText] = useState("");
  const [inputTimeText, setInputTimeText] = useState("");
  const [quizTimeText, setQuizTimeText] = useState("");

  useEffect(() => {
    let dailyMs = quota.dailyResetInMs;
    let windowMs = quota.windowResetInMs;

    const formatTime = (ms: number): string => {
      if (ms <= 0) return "0s";
      const totalSeconds = Math.floor(ms / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      if (h > 0) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const updateTimers = () => {
      if (dailyMs > 0) {
        setDailyTimeText(`Daily resets in: ${formatTime(dailyMs)}`);
        dailyMs -= 1000;
      } else {
        setDailyTimeText("resetting daily quota...");
      }

      if (quota.windowInputRemaining === 0) {
        if (windowMs > 0) {
          setInputTimeText(`Next slot available in: ${formatTime(windowMs)}`);
        } else {
          setInputTimeText("window slot available");
        }
      } else {
        setInputTimeText("");
      }

      if (quota.windowQuizRemaining === 0) {
        if (windowMs > 0) {
          setQuizTimeText(`Next slot available in: ${formatTime(windowMs)}`);
        } else {
          setQuizTimeText("window slot available");
        }
      } else {
        setQuizTimeText("");
      }

      windowMs -= 1000;
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load conversation details");
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
        const list = await getConversationList();
        setConversations(list);
        await refreshQuota();
        await loadConversation(result.conversationId);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to start chat session");
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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to start learning session");
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message");
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
          await submitLearningAnswersAction(
          activeConversationId,
          messageId,
          answers
        );
        // Reload details to display assessment and feedback
        await loadConversation(activeConversationId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit answers");
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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to start suggested learning session");
      }
    });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    const el = document.getElementById("messages-end");
    el?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length]);

  // Returns to empty ChatGPT-style landing page
  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveConversation(null);
    setChatInput("");
    setTopic("");
    setError(null);
    setSidebarOpen(false);
  };

  // Redo a lesson from quiz history (starts a fresh learning session)
  const handleRedoLesson = (convTitle: string) => {
    const extractedTopic = convTitle.replace(/^Lesson:\s*/i, "").trim();
    if (!extractedTopic) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await startLearningSessionAction(extractedTopic);
        const list = await getConversationList();
        setConversations(list);
        await refreshQuota();
        await loadConversation(result.conversationId);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to start redo session");
      }
    });
  };

  // Derived data for sidebar
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const lessonConversations = filteredConversations.filter((c) =>
    c.title.startsWith("Lesson:")
  );
  const chatConversations = filteredConversations.filter((c) =>
    !c.title.startsWith("Lesson:")
  );

  const groupByDate = (convs: Conversation[]): Record<string, Conversation[]> => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    const groups: Record<string, Conversation[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    };

    for (const c of convs) {
      const d = new Date(c.createdAt);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const time = dayStart.getTime();

      if (time === today.getTime()) groups.Today.push(c);
      else if (time === yesterday.getTime()) groups.Yesterday.push(c);
      else if (time >= weekStart.getTime()) groups["This Week"].push(c);
      else groups.Earlier.push(c);
    }

    const result: Record<string, Conversation[]> = {};
    for (const [key, value] of Object.entries(groups)) {
      if (value.length > 0) result[key] = value;
    }
    return result;
  };

  const groupedChats = groupByDate(chatConversations);

  const quotaBarWidth = (remaining: number, limit: number) =>
    `${(remaining / limit) * 100}%`;

  return (
    <>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="flex h-full relative">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ===== SIDEBAR ===== */}
        <aside
          className={`
            w-[280px] lg:w-[300px] flex-shrink-0
            border-r border-black dark:border-white
            bg-white dark:bg-black
            flex-col
            ${sidebarOpen ? "fixed inset-y-0 left-0 z-50 flex" : "hidden"}
            md:relative md:inset-auto md:z-auto md:flex
          `}
        >
          {/* + New Chat button */}
          <div className="p-3 border-b border-black dark:border-white">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-300 dark:border-neutral-800 font-mono text-[10px] uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-neutral-900 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Search bar */}
          <div className="px-3 py-2 border-b border-black dark:border-white">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 px-3 py-2 font-mono text-[11px] focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>

          {/* Chat History (grouped by date) */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {Object.keys(groupedChats).length === 0 && searchQuery === "" && conversations.length === 0 && (
              <div className="text-[10px] font-mono text-neutral-500 italic py-4 text-center select-none">
                No conversations yet.
              </div>
            )}
            {Object.keys(groupedChats).length === 0 && searchQuery !== "" && (
              <div className="text-[10px] font-mono text-neutral-500 italic py-4 text-center select-none">
                No conversations match your search.
              </div>
            )}
            {Object.entries(groupedChats).map(([group, convs]) => (
              <div key={group} className="mb-3">
                <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 select-none">
                  {group}
                </div>
                {convs.map((c) => {
                  const isActive = c.id === activeConversationId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { loadConversation(c.id); setSidebarOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 font-mono text-[11px] transition select-none flex flex-col cursor-pointer ${
                        isActive
                          ? "bg-neutral-100 dark:bg-neutral-800 font-bold"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <span className="truncate leading-tight">{c.title}</span>
                      <span className="text-[9px] text-neutral-400 mt-0.5">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Quiz History */}
          {lessonConversations.length > 0 && (
            <div className="border-t border-black dark:border-white">
              <div className="px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 select-none">
                Quiz History
              </div>
              <div className="px-2 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
                {lessonConversations.map((c) => {
                  const isActive = c.id === activeConversationId;
                  return (
                    <div
                      key={c.id}
                      className={`px-3 py-2 font-mono text-[11px] flex items-center gap-2 ${
                        isActive ? "bg-neutral-100 dark:bg-neutral-800" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="truncate block leading-tight">{c.title}</span>
                        <span className="text-[9px] text-neutral-400 mt-0.5">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { loadConversation(c.id); setSidebarOpen(false); }}
                          className="text-[9px] font-mono px-2 py-1 border border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition cursor-pointer"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleRedoLesson(c.title)}
                          disabled={isPending}
                          className="text-[9px] font-mono px-2 py-1 border border-[#ff2a2e] text-[#ff2a2e] hover:bg-[#ff2a2e]/10 transition disabled:opacity-40 cursor-pointer"
                        >
                          Redo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quota Footer — compact */}
          <div className="border-t border-black dark:border-white p-3 space-y-2">
            <div>
              <div className="flex justify-between items-center text-[9px] font-mono mb-0.5">
                <span>DAILY</span>
                <span className="font-bold">
                  {quota.role === "TEACHER" || quota.role === "ADMIN"
                    ? "∞"
                    : `${quota.dailyRemaining}/${quota.dailyLimit}`}
                </span>
              </div>
              <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-900 overflow-hidden">
                <div
                  className="h-full bg-black dark:bg-white transition-all duration-300"
                  style={{
                    width:
                      quota.role === "TEACHER" || quota.role === "ADMIN"
                        ? "100%"
                        : quotaBarWidth(quota.dailyRemaining, quota.dailyLimit),
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center text-[9px] font-mono mb-0.5">
                <span>INPUT</span>
                <span className="font-bold">
                  {quota.role === "TEACHER" || quota.role === "ADMIN"
                    ? "∞"
                    : `${quota.windowInputRemaining}/${quota.windowInputLimit}`}
                </span>
              </div>
              <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-900 overflow-hidden">
                <div
                  className="h-full bg-black dark:bg-white transition-all duration-300"
                  style={{
                    width:
                      quota.role === "TEACHER" || quota.role === "ADMIN"
                        ? "100%"
                        : quotaBarWidth(quota.windowInputRemaining, quota.windowInputLimit),
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center text-[9px] font-mono mb-0.5">
                <span>QUIZ</span>
                <span className="font-bold">
                  {quota.role === "TEACHER" || quota.role === "ADMIN"
                    ? "∞"
                    : `${quota.windowQuizRemaining}/${quota.windowQuizLimit}`}
                </span>
              </div>
              <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-900 overflow-hidden">
                <div
                  className="h-full bg-black dark:bg-white transition-all duration-300"
                  style={{
                    width:
                      quota.role === "TEACHER" || quota.role === "ADMIN"
                        ? "100%"
                        : quotaBarWidth(quota.windowQuizRemaining, quota.windowQuizLimit),
                  }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* ===== MAIN CONTENT AREA ===== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header bar */}
          <div className="border-b border-black dark:border-white px-4 py-3 flex items-center gap-3 select-none">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition cursor-pointer"
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>

            {activeConversation ? (
              <>
                <span className="font-mono text-xs font-bold uppercase tracking-wider truncate">
                  {activeConversation.title}
                </span>
                <span className="font-mono text-[10px] text-neutral-400 ml-auto">
                  READY
                </span>
              </>
            ) : (
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                ALOYS
              </span>
            )}
          </div>

          {/* Error toast */}
          {error && (
            <div
              className="mx-4 mt-2 px-4 py-2.5 bg-[#ff2a2e]/10 border border-[#ff2a2e]/30 text-[#ff2a2e] font-mono text-[11px] rounded-lg animate-[fadeIn_0.2s_ease-out] flex items-center gap-2"
              style={{ animation: "fadeIn 0.2s ease-out" }}
            >
              <span className="w-1.5 h-1.5 bg-[#ff2a2e] rounded-full flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* EMPTY STATE — ChatGPT-style landing page */}
          {!activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 overflow-y-auto">
              <div className="max-w-xl w-full flex flex-col items-center text-center space-y-6">
                {/* Logo */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-5xl">🩺</span>
                  <span className="font-mono text-4xl font-bold tracking-tight">
                    Aloys
                  </span>
                </div>

                <p className="font-mono text-base text-neutral-500">
                  What would you like to learn today?
                </p>

                {/* Topic input + action buttons */}
                <div className="w-full space-y-4">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ask Aloys anything..."
                    className="w-full border border-neutral-300 dark:border-neutral-700 px-5 py-3.5 bg-white dark:bg-neutral-900 font-mono text-sm focus:outline-none focus:border-black dark:focus:border-white"
                    disabled={isPending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && topic.trim()) handleStartLesson();
                    }}
                  />

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleStartLesson()}
                      disabled={isPending || !topic.trim()}
                      className="px-6 py-2.5 bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-mono text-[10px] uppercase tracking-wider hover:opacity-80 transition disabled:opacity-40 cursor-pointer"
                    >
                      Start Lesson
                    </button>
                    <button
                      onClick={() => handleStartChat()}
                      disabled={isPending || !topic.trim()}
                      className="px-6 py-2.5 border border-neutral-300 dark:border-neutral-800 bg-transparent text-black dark:text-white font-mono text-[10px] uppercase tracking-wider hover:border-black dark:hover:border-white transition disabled:opacity-40 cursor-pointer"
                    >
                      Socratic Chat
                    </button>
                  </div>
                </div>

                {/* Suggested topic chips */}
                <div className="flex flex-wrap gap-2 justify-center pt-1">
                  {["Mitochondria", "Solar System", "Ancient Rome", "Fractions"].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSelectSuggestion(s)}
                      disabled={isPending}
                      className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] hover:border-neutral-500 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition disabled:opacity-40 cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT — message list + input bar */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="max-w-3xl mx-auto">
                  {loadingMessages ? (
                    <div className="h-full flex items-center justify-center font-mono text-xs text-neutral-500 animate-pulse">
                      RETRIEVING ENCRYPTED DIALOGUE...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeConversation.messages.map((m) => {
                        const isUser = m.role === "user";
                        return (
                          <div key={m.id} style={{ animation: "fadeIn 0.3s ease-out" }}>
                            <div
                              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                            >
                              {/* CHAT bubble */}
                              {m.type === "CHAT" && (
                                <div
                                  className={`max-w-[80%] px-4 py-3 font-mono text-xs leading-relaxed ${
                                    isUser
                                      ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded-2xl rounded-br-md"
                                      : "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white rounded-2xl rounded-bl-md border border-neutral-200 dark:border-neutral-700"
                                  }`}
                                >
                                  {m.content}
                                </div>
                              )}

                              {/* LEARN_TEXT styled content card */}
                              {m.type === "LEARN_TEXT" && (
                                <div className="max-w-[88%] bg-white dark:bg-black/50 border border-black dark:border-white p-5 space-y-3 font-mono text-xs leading-relaxed text-black dark:text-white">
                                  <div className="border-b border-neutral-300 dark:border-neutral-800 pb-2 mb-2 flex justify-between items-center text-[10px] text-neutral-400 tracking-wider uppercase select-none">
                                    <span>Report / Reading Material</span>
                                    <span>Aloys Founder Log</span>
                                  </div>
                                  <div className="whitespace-pre-wrap">{m.content}</div>
                                </div>
                              )}

                              {/* LEARN_QUESTIONS interactive quiz */}
                              {m.type === "LEARN_QUESTIONS" && (
                                <div className="max-w-[88%] bg-white dark:bg-black/50 border border-black dark:border-white p-5 space-y-5 font-mono text-xs text-black dark:text-white">
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

                                    // Check if this lesson has been answered
                                    const isAnswered = activeConversation.messages.some(
                                      (msg) => msg.type === "LEARN_ANSWERS"
                                    );

                                    if (!questions) return null;

                                    return (
                                      <div className="space-y-6">
                                        {questions.map((q, qIdx) => {
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
                                                      className={`w-full text-left p-2.5 font-mono text-[11px] border transition flex items-center space-x-3 cursor-pointer ${
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
                                            className="w-full bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white font-mono text-[10px] uppercase tracking-wider py-3 hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition disabled:opacity-30 cursor-pointer"
                                          >
                                            {isPending ? "Grading..." : "Submit Assessment"}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* LEARN_ANSWERS feedback */}
                              {m.type === "LEARN_ANSWERS" && (
                                <div className="max-w-[88%] bg-white dark:bg-black/50 border border-[#ff2a2e] p-5 space-y-4 font-mono text-xs text-black dark:text-white">
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
                                              className="border border-neutral-300 dark:border-neutral-800 text-[10px] font-mono py-1.5 px-3 uppercase hover:border-[#ff2a2e] hover:text-[#ff2a2e] transition disabled:opacity-40 cursor-pointer"
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

                            {/* Timestamp below message */}
                            <div
                              className={`flex mt-1 font-mono text-[9px] text-neutral-400 select-none ${
                                isUser ? "justify-end mr-1" : "justify-start ml-1"
                              }`}
                            >
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        );
                      })}
                      <div id="messages-end" />
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Input bar pinned at bottom */}
              {activeConversation.messages.length > 0 &&
                activeConversation.messages[activeConversation.messages.length - 1].type === "CHAT" && (
                <div className="border-t border-black dark:border-white p-4 bg-white dark:bg-black/5">
                  <form
                    onSubmit={handleSendMessage}
                    className="max-w-3xl mx-auto flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Message Aloys..."
                      className="flex-1 border border-neutral-300 dark:border-neutral-800 px-5 py-3 bg-white dark:bg-neutral-900 font-mono text-sm focus:outline-none focus:border-black dark:focus:border-white"
                      disabled={isPending}
                    />
                    <button
                      type="submit"
                      disabled={isPending || !chatInput.trim()}
                      className="p-3 bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white hover:opacity-80 transition disabled:opacity-40 cursor-pointer flex-shrink-0"
                      aria-label="Send message"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
