"use client";

import React from "react";
import { FileText } from "lucide-react";

interface VocabularyBuilderProps {
  vocabRawText: string;
  setVocabRawText: (text: string) => void;
}

export function VocabularyBuilder({ vocabRawText, setVocabRawText }: VocabularyBuilderProps) {
  return (
    <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wide flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-green-500" />
          Vocabulary Word List Builder
        </h3>
        <p className="text-xs text-neutral-450 mt-1 font-sans">
          Enter your vocabulary pairs below. Place each pair on a new line, using an equals sign (<code>=</code>) to separate the term and its translation.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
          Copy & Paste Vocabulary List
        </label>
        <textarea
          required
          rows={15}
          value={vocabRawText}
          onChange={(e) => setVocabRawText(e.target.value)}
          placeholder={`apple = Apfel\nhorse = Pferd\nchair = Stuhl\nsun = Sonne`}
          className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-3 bg-transparent font-mono outline-none focus:border-black dark:focus:border-white leading-relaxed"
        />
      </div>

      {vocabRawText.trim() && (
        <div className="p-3 bg-neutral-50 dark:bg-neutral-950/40 border rounded text-[11px] font-mono space-y-1">
          <span className="font-bold text-neutral-500 block">Parsed Words Preview:</span>
          <div className="max-h-36 overflow-y-auto divide-y">
            {vocabRawText
              .split("\n")
              .map((line: string) => line.trim())
              .filter(Boolean)
              .map((line: string, idx: number) => {
                const parts = line.split("=");
                const word = parts[0]?.trim() || "";
                const translation = parts[1]?.trim() || "";
                return (
                  <div key={idx} className="py-1 flex justify-between gap-4">
                    <span className="font-medium text-neutral-800 dark:text-neutral-250">
                      {word || <span className="text-red-500">(missing)</span>}
                    </span>
                    <span className="text-neutral-450">→</span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {translation || <span className="text-red-500">(missing)</span>}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
