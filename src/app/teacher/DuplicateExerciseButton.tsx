"use client";

import React, { useState, useTransition } from "react";
import { duplicateExercise } from "@/lib/actions/exercise";
import { Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DuplicateExerciseButton({
  exerciseId,
  exerciseTitle,
}: {
  exerciseId: string;
  exerciseTitle: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [newId, setNewId] = useState(`${exerciseId}-copy`);
  const [newTitle, setNewTitle] = useState(`${exerciseTitle} (Copy)`);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDuplicate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await duplicateExercise(exerciseId, newId.toLowerCase().trim(), newTitle.trim());
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
        setShowModal(false);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1 border border-neutral-305 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2.5 py-1 rounded transition text-neutral-700 dark:text-neutral-300 font-sans font-semibold text-xs cursor-pointer disabled:opacity-50"
      >
        <Copy className="w-3 h-3" />
        Clone
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded p-6 max-w-md w-full mx-4 shadow-xl space-y-4">
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              Clone Worksheet
            </h3>
            
            <form onSubmit={handleDuplicate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  New ID (kebab-case)
                </label>
                <input
                  type="text"
                  required
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
                  New Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-red-650">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-mono font-semibold border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-mono font-semibold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded hover:bg-neutral-800 dark:hover:bg-neutral-200 transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  {isPending ? "Cloning..." : "Clone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
