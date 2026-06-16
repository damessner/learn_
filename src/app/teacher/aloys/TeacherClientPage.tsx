"use client";

import React, { useState } from "react";
import { getConversationDetail } from "@/lib/actions/aloys";

interface ConversationItem {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    username: string;
  };
}

interface Message {
  id: string;
  role: string;
  content: string;
  type: string;
  metadataJson: string | null;
  createdAt: Date;
}

interface TeacherClientPageProps {
  initialConversations: ConversationItem[];
}

export function TeacherClientPage({
  initialConversations,
}: TeacherClientPageProps) {
  const [conversations] = useState<ConversationItem[]>(initialConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConvDetail, setActiveConvDetail] = useState<{
    id: string;
    title: string;
    studentName: string;
    messages: Message[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewConversationLogs = async (id: string, studentName: string) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getConversationDetail(id);
      setActiveConvDetail({
        id: detail.id,
        title: detail.title,
        studentName,
        messages: detail.messages.map((m) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
      });
      setActiveConvId(id);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve conversation logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col space-y-6 min-h-0">
      {/* Header */}
      <div className="border border-black dark:border-white p-5 bg-white dark:bg-black/10 select-none">
        <h1 className="font-mono text-xl font-bold uppercase tracking-widest text-[#ff2a2e] flex items-center">
          <span className="inline-block w-2.5 h-2.5 bg-[#ff2a2e] mr-2 animate-pulse" />
          SOCRATIC INTERACTION LOGS
        </h1>
        <p className="text-[10px] font-mono text-neutral-400 mt-1 uppercase">
          Teacher Console // Audit Pupil conversations with Dr. Aloys
        </p>
      </div>

      {error && (
        <div className="bg-[#ff2a2e]/10 border border-[#ff2a2e] text-[#ff2a2e] font-mono text-[11px] p-3">
          [ERROR] {error}
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0 overflow-hidden">
        {/* Left Side: Conversation log select */}
        <div className="md:col-span-1 border border-black dark:border-white p-5 bg-white dark:bg-black/10 flex flex-col min-h-0">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest mb-3 select-none">
            // ACTIVE DIALOGUE ENTRIES
          </h2>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {conversations.length === 0 ? (
              <span className="text-[10px] font-mono text-neutral-500 italic block select-none">
                No pupil dialogues recorded in your classrooms.
              </span>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeConvId;
                return (
                  <button
                    key={c.id}
                    onClick={() => viewConversationLogs(c.id, c.student.username)}
                    className={`w-full text-left p-3 font-mono text-[11px] border border-neutral-200 dark:border-neutral-800 transition select-none flex flex-col space-y-1 rounded-none cursor-pointer ${
                      isActive
                        ? "bg-neutral-100 dark:bg-neutral-800 border-black dark:border-white font-bold"
                        : "hover:border-neutral-400 dark:hover:border-neutral-700 bg-transparent"
                    }`}
                  >
                    <span className="truncate">{c.title}</span>
                    <div className="flex justify-between items-center text-[9px] text-neutral-400">
                      <span>PUPIL: {c.student.username}</span>
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Transcript panel */}
        <div className="md:col-span-2 border border-black dark:border-white flex flex-col bg-white dark:bg-black/10 min-h-0">
          <div className="border-b border-black dark:border-white px-5 py-3 flex items-center justify-between select-none">
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              {activeConvDetail
                ? `TRANSCRIPT: ${activeConvDetail.studentName} - ${activeConvDetail.title}`
                : "AUDIT VIEWER"}
            </span>
            <span className="font-mono text-[10px] text-neutral-400">
              {activeConvDetail ? "MONITORING DIALOGUE" : "STANDBY"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {loading ? (
              <div className="h-full flex items-center justify-center font-mono text-xs text-neutral-500 animate-pulse">
                RETRIEVING ENCRYPTED INTERACTION LOGS...
              </div>
            ) : !activeConvDetail ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 select-none">
                <span className="text-2xl">🩺</span>
                <p className="font-mono text-xs text-neutral-400 max-w-xs leading-relaxed">
                  Select a student dialogue entry from the left logs list to audit their Socratic dialogue and learning mode assessments.
                </p>
              </div>
            ) : (
              activeConvDetail.messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="flex items-center space-x-2 font-mono text-[9px] text-neutral-400 select-none">
                      <span>{isUser ? "// STUDENT" : "// DR. ALOYS"}</span>
                      <span>•</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                    </div>

                    {m.type === "CHAT" && (
                      <div className="font-mono text-xs p-4 rounded-none leading-relaxed border bg-white dark:bg-black/50 border-neutral-300 dark:border-neutral-800 mr-6 text-neutral-700 dark:text-neutral-300">
                        {m.content}
                      </div>
                    )}

                    {m.type === "LEARN_TEXT" && (
                      <div className="bg-white dark:bg-black/50 border border-neutral-300 dark:border-neutral-800 p-5 mr-6 rounded-none space-y-3 font-mono text-xs leading-relaxed text-black dark:text-white">
                        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-2 flex justify-between items-center text-[10px] text-neutral-400 tracking-wider uppercase select-none">
                          <span>Reading Material / Explanation</span>
                        </div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    )}

                    {m.type === "LEARN_QUESTIONS" && (
                      <div className="bg-white dark:bg-black/50 border border-neutral-300 dark:border-neutral-800 p-5 mr-6 rounded-none space-y-5 font-mono text-xs text-black dark:text-white">
                        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-2 flex justify-between items-center text-[10px] text-neutral-400 tracking-wider uppercase select-none">
                          <span>Comprehension Questions</span>
                        </div>
                        {(() => {
                          const metadata = JSON.parse(m.metadataJson || "{}");
                          const questions = metadata.questions as Array<{
                            question: string;
                            options: string[];
                            correctIndex: number;
                          }>;

                          if (!questions) return null;

                          return (
                            <div className="space-y-6">
                              {questions.map((q, qIdx) => (
                                <div key={qIdx} className="space-y-2">
                                  <p className="font-bold">
                                    {qIdx + 1}. {q.question}
                                  </p>
                                  <div className="grid grid-cols-1 gap-2 pl-2">
                                    {q.options.map((opt, oIdx) => {
                                      const isCorrect = q.correctIndex === oIdx;
                                      return (
                                        <div
                                          key={oIdx}
                                          className={`p-2.5 font-mono text-[11px] border flex items-center space-x-3 rounded-none ${
                                            isCorrect
                                              ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400"
                                              : "bg-transparent border-neutral-200 dark:border-neutral-800 text-neutral-500"
                                          }`}
                                        >
                                          <span className="font-mono text-[9px] uppercase tracking-widest select-none">
                                            {isCorrect ? "[CORRECT]" : "[ ]"}
                                          </span>
                                          <span>{opt}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {m.type === "LEARN_ANSWERS" && (
                      <div className="bg-white dark:bg-black/50 border border-[#ff2a2e]/50 p-5 mr-6 rounded-none space-y-4 font-mono text-xs text-black dark:text-white">
                        <div className="border-b border-[#ff2a2e]/30 pb-2 mb-2 flex justify-between items-center text-[10px] text-[#ff2a2e] tracking-wider uppercase select-none">
                          <span>Assessment Attempt Feedback</span>
                        </div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
