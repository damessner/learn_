"use client";

import React, { useState } from "react";
import { Brain, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { generateClassroomDiagnosticAction } from "@/lib/actions/classroom";

interface ClassroomDiagnosticCardProps {
  classroomId: string;
  initialDiagnostic: string | null;
  initialDiagnosticDate: Date | null;
}

export default function ClassroomDiagnosticCard({
  classroomId,
  initialDiagnostic,
  initialDiagnosticDate,
}: ClassroomDiagnosticCardProps) {
  const [diagnostic] = useState<string | null>(initialDiagnostic);
  const [diagnosticDate] = useState<Date | null>(initialDiagnosticDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateClassroomDiagnosticAction(classroomId);
      if (res.error) {
        setError(res.error);
      } else {
        window.location.reload();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to contact AI diagnostics coach.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("###")) {
        return (
          <h4 key={idx} className="text-xs font-black font-mono uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mt-5 mb-2.5">
            {trimmed.replace(/^###\s*/, "")}
          </h4>
        );
      }
      if (trimmed.startsWith("##")) {
        return (
          <h3 key={idx} className="text-sm font-black font-mono uppercase tracking-wide text-neutral-900 dark:text-neutral-100 mt-5 mb-3">
            {trimmed.replace(/^##\s*/, "")}
          </h3>
        );
      }
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const content = trimmed.replace(/^[-*]\s*/, "");
        return (
          <li key={idx} className="text-xs text-neutral-700 dark:text-neutral-300 ml-4 list-disc mb-1.5 leading-relaxed">
            {parseInlineMarkdown(content)}
          </li>
        );
      }
      if (trimmed.match(/^\d+\.\s/)) {
        const content = trimmed.replace(/^\d+\.\s*/, "");
        return (
          <li key={idx} className="text-xs text-neutral-700 dark:text-neutral-300 ml-4 list-decimal mb-1.5 leading-relaxed">
            {parseInlineMarkdown(content)}
          </li>
        );
      }
      if (trimmed === "") {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-xs text-neutral-650 dark:text-neutral-350 leading-relaxed mb-2">
          {parseInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-extrabold text-neutral-900 dark:text-neutral-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="border border-neutral-350 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900 shadow-sm flex flex-col">
      {/* Header Bar */}
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-850 flex items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-950/20">
        <div className="flex items-center gap-2.5">
          <Brain className="w-5 h-5 text-indigo-500 animate-pulse" />
          <div>
            <h3 className="font-bold text-sm font-mono uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
              AI Classroom Learning Assistant
            </h3>
            <p className="text-[10px] text-neutral-500 font-medium">
              Neuroscience-aligned lesson adjustments & class-wide struggle diagnostic
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 border border-neutral-350 dark:border-neutral-750 bg-white dark:bg-neutral-950 text-neutral-850 dark:text-neutral-150 font-mono text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded hover:border-black dark:hover:border-white disabled:opacity-50 transition cursor-pointer select-none shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing..." : diagnostic ? "Refresh Insights" : "Generate Insights"}
        </button>
      </div>

      {/* Body Area */}
      <div className="p-5 flex-1">
        {error && (
          <div className="p-4 border border-red-200/50 dark:border-red-900/35 rounded bg-red-500/5 text-red-700 dark:text-red-400 text-xs flex items-start gap-2.5 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold font-mono uppercase block text-[10px] tracking-wider mb-0.5">
                Diagnostics Error
              </span>
              <p>{error}</p>
            </div>
          </div>
        )}

        {diagnostic ? (
          <div className="space-y-4">
            {diagnosticDate && (
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-neutral-450 font-bold uppercase tracking-wide">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                Latest diagnostics compiled on {new Date(diagnosticDate).toLocaleString("en-GB")}
              </div>
            )}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-850 space-y-4">
              {renderMarkdown(diagnostic)}
            </div>
          </div>
        ) : (
          <div className="py-10 text-center space-y-3">
            <Brain className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto animate-pulse" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                No classroom diagnostic report generated yet.
              </p>
              <p className="text-[10px] text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Click the generate button above to analyze your pupils&apos; performance trends and get tailored neuroscience-backed lesson adjustments.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
