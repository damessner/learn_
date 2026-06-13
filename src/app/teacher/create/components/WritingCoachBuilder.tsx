"use client";

import React from "react";
import { Sparkles, Trash2, PlusCircle, HelpCircle, Wand2, Loader2 } from "lucide-react";
import { improveCriterionAction } from "@/lib/actions/ai-coach";
import { randomUUID } from "@/lib/uuid";

export interface CreatorCriterion {
  id: string;
  name: string;
  description: string;
  tip?: string;
}

interface WritingCoachBuilderProps {
  coachPrompt: string;
  setCoachPrompt: (prompt: string) => void;
  coachSystemPrompt: string;
  setCoachSystemPrompt: (prompt: string) => void;
  coachCriteria: CreatorCriterion[];
  setCoachCriteria: React.Dispatch<React.SetStateAction<CreatorCriterion[]>>;
}

export function WritingCoachBuilder({
  coachPrompt,
  setCoachPrompt,
  coachSystemPrompt,
  setCoachSystemPrompt,
  coachCriteria,
  setCoachCriteria,
}: WritingCoachBuilderProps) {

  const [improvingIds, setImprovingIds] = React.useState<Record<string, boolean>>({});

  const handleAutoImprove = async (id: string, name: string, description: string) => {
    if (!name.trim() || !description.trim()) {
      alert("Please provide a goal name and description first, so the AI knows what to improve.");
      return;
    }

    setImprovingIds((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await improveCriterionAction(name, description);
      if (res.error) {
        alert(res.error);
      } else if (res.data) {
        updateCriterion(id, "description", res.data.description);
        updateCriterion(id, "tip", res.data.tip);
      }
    } catch (err: unknown) {
      alert("Failed to improve goal: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImprovingIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const addCriterion = () => {
    setCoachCriteria((prev) => [
      ...prev,
      {
        id: randomUUID(),
        name: "",
        description: "",
        tip: "",
      },
    ]);
  };

  const removeCriterion = (id: string) => {
    setCoachCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCriterion = (id: string, field: keyof CreatorCriterion, value: string) => {
    setCoachCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  return (
    <div className="space-y-6">
      {/* Prompt Setup */}
      <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-sm font-bold font-mono uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
            Writing Task Configuration
          </h3>
          <p className="text-xs text-neutral-450 mt-1 font-sans">
            Define the essay topic, question, or letter instructions for the students.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
              Writing Prompt (Instructions for Students)
            </label>
            <textarea
              required
              rows={5}
              value={coachPrompt}
              onChange={(e) => setCoachPrompt(e.target.value)}
              placeholder="e.g. Write a short letter (50-80 words) to your friend telling them about your summer holiday. Tell them where you went, what the weather was like, and what you did."
              className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-3 bg-transparent outline-none focus:border-black dark:focus:border-white leading-relaxed font-sans"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              Custom Coach Context / Persona (Optional)
              <span className="group relative cursor-pointer text-neutral-400 hover:text-black">
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-neutral-900 text-white text-[9px] font-normal leading-normal rounded shadow-md z-20 normal-case font-sans">
                  Custom instructions for Gemini. e.g. &quot;Ensure students use the past simple tense&quot; or &quot;Keep grading tone positive and light.&quot;
                </span>
              </span>
            </label>
            <textarea
              rows={3}
              value={coachSystemPrompt}
              onChange={(e) => setCoachSystemPrompt(e.target.value)}
              placeholder="e.g. Encourage students to use past simple verbs like went, stayed, swam. Focus feedback on clarity and tense correctness."
              className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-3 bg-transparent outline-none focus:border-black dark:focus:border-white leading-relaxed font-sans"
            />
          </div>
        </div>
      </div>

      {/* Criteria Setup */}
      <div className="p-6 border rounded border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <div className="border-b pb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold font-mono uppercase tracking-wide">
              Evaluation Criteria & Learning Goals
            </h3>
            <p className="text-xs text-neutral-450 mt-1 font-sans">
              List the aspects Gemini should assess. Students will see tips and status checks for each.
            </p>
          </div>
          <button
            type="button"
            onClick={addCriterion}
            className="px-3 py-1.5 border border-purple-300 hover:bg-purple-50 hover:border-purple-400 dark:border-purple-900/60 dark:hover:bg-purple-950/20 text-purple-750 dark:text-purple-300 text-xs font-semibold uppercase font-mono rounded-lg transition active:scale-95 flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            Add Goal
          </button>
        </div>

        {coachCriteria.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg text-xs text-neutral-400">
            No feedback criteria defined yet. Click &quot;Add Goal&quot; to create one.
          </div>
        ) : (
          <div className="space-y-4">
            {coachCriteria.map((criterion, idx) => (
              <div
                key={criterion.id}
                className="p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/20 dark:bg-neutral-900/20 rounded-xl space-y-3 relative group"
              >
                <div className="flex items-center justify-between border-b dark:border-neutral-800/80 pb-2">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-purple-550">
                    Goal #{idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={improvingIds[criterion.id] || !criterion.name.trim() || !criterion.description.trim()}
                      onClick={() => handleAutoImprove(criterion.id, criterion.name, criterion.description)}
                      className="inline-flex items-center gap-1 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border border-purple-250 dark:border-purple-900 bg-purple-50/50 hover:bg-purple-100/60 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 text-purple-750 dark:text-purple-300 disabled:opacity-40 transition active:scale-95 disabled:scale-100 cursor-pointer"
                    >
                      {improvingIds[criterion.id] ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Improving...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3 h-3 text-purple-600" />
                          Auto-Improve Goal
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCriterion(criterion.id)}
                      className="p-1 text-neutral-450 hover:text-red-650 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      Goal Name (Short Title)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Past Simple Tense"
                      value={criterion.name}
                      onChange={(e) => updateCriterion(criterion.id, "name", e.target.value)}
                      className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      Student-Facing Tip (Optional hint)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Use past simple verbs like went, swam, played."
                      value={criterion.tip || ""}
                      onChange={(e) => updateCriterion(criterion.id, "tip", e.target.value)}
                      className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    AI Instructions (What the coach checks for)
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Verify that the student writes at least 2 sentences in the simple past tense to describe what they did (went, saw, played)."
                    value={criterion.description}
                    onChange={(e) => updateCriterion(criterion.id, "description", e.target.value)}
                    className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded p-2.5 bg-transparent outline-none focus:border-black dark:focus:border-white font-sans leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
