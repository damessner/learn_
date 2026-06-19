import React from "react";
import { Sparkles, BrainCircuit } from "lucide-react";

export interface WordOfTheDayData {
  word: string;
  translation: string;
  definition: string;
  example: string;
  mnemonic: string;
}

interface WordOfTheDayCardProps {
  data: WordOfTheDayData;
}

export function WordOfTheDayCard({ data }: WordOfTheDayCardProps) {
  const { word, translation, definition, example, mnemonic } = data;

  // Helper to bold/underline the target word in the example sentence
  const highlightWord = (sentence: string, target: string) => {
    if (!sentence || !target) return sentence;
    const regex = new RegExp(`\\b(${target}|${target}s|${target}ed|${target}ing)\\b`, "gi");
    const parts = sentence.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <strong
              key={i}
              className="font-extrabold text-neutral-900 dark:text-neutral-50 underline decoration-indigo-500 decoration-2 underline-offset-2"
            >
              {part}
            </strong>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-850">
      {/* Word Header and translation */}
      <div className="p-6 md:w-1/3 flex flex-col justify-center bg-neutral-50/50 dark:bg-neutral-950/20 shrink-0">
        <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          Word of the Day
        </span>
        <h2 className="text-3xl font-black font-mono uppercase tracking-tight text-neutral-900 dark:text-neutral-50 truncate" title={word}>
          {word}
        </h2>
        <div className="mt-2.5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-750">
            🇩🇪 {translation}
          </span>
        </div>
      </div>

      {/* Details (Definition, Example, Mnemonic) */}
      <div className="p-6 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div>
            <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-1">
              Definition
            </span>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
              {definition}
            </p>
          </div>
          
          <div>
            <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-1">
              Example
            </span>
            <p className="text-sm text-neutral-650 dark:text-neutral-350 italic leading-relaxed">
              &ldquo;{highlightWord(example, word)}&rdquo;
            </p>
          </div>
        </div>

        {/* Neuroscience Mnemonic helper */}
        <div className="bg-indigo-50/40 dark:bg-indigo-950/15 border border-indigo-100/70 dark:border-indigo-900/30 p-3 rounded flex items-start gap-3 mt-1">
          <BrainCircuit className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-indigo-655 dark:text-indigo-400 block">
              Neuro-Tip: Memory Hook
            </span>
            <p className="text-xs text-neutral-650 dark:text-neutral-400 leading-relaxed">
              {mnemonic}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
