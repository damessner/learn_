"use client";

import React, { useState, useTransition } from "react";
import { createCourse } from "@/lib/actions/course";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CreateCourseForm() {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      setError(null);
      const result = await createCourse(title.trim(), description.trim() || undefined);
      if (result?.error) {
        setError(result.error);
      } else {
        setTitle("");
        setDescription("");
        setShowForm(false);
        router.refresh();
      }
    });
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded text-xs font-mono uppercase font-semibold hover:opacity-90 transition shadow shrink-0 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        Create Course
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        required
        disabled={isPending}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Course title"
        className="text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white w-48"
      />
      <input
        type="text"
        disabled={isPending}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white w-56"
      />
      <button
        type="submit"
        disabled={isPending || !title.trim()}
        className="flex items-center gap-1 bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 rounded text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shrink-0 uppercase font-mono"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setShowForm(false);
          setError(null);
        }}
        disabled={isPending}
        className="text-xs font-mono text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition cursor-pointer px-2 py-1.5"
      >
        Cancel
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </form>
  );
}
