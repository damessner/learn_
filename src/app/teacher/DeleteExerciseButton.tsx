"use client";

import React, { useState, useTransition } from "react";
import { deleteExercise } from "@/app/actions";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DeleteExerciseButton({
  exerciseId,
  exerciseTitle,
}: {
  exerciseId: string;
  exerciseTitle: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteExercise(exerciseId);
      if (result?.success) {
        router.refresh();
      }
      setShowConfirm(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 px-2.5 py-1 rounded transition text-red-600 dark:text-red-400 font-sans font-semibold text-xs cursor-pointer disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
        Delete
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Delete &ldquo;{exerciseTitle}&rdquo;?
            </p>
            <p className="text-xs text-neutral-500">
              This will permanently delete the worksheet and all its data. This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-mono font-semibold border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-mono font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
