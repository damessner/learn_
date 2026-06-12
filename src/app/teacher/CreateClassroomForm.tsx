"use client";

import React, { useState } from "react";
import { createClassroom } from "@/app/actions";
import { Plus } from "lucide-react";

export default function CreateClassroomForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await createClassroom(name);
      if (res?.error) {
        setError(res.error);
      } else {
        setName("");
      }
    } catch (err) {
      setError("Failed to create classroom.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Create a Classroom
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          required
          disabled={loading}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Classroom Name (e.g. Grade 4 English)"
          className="flex-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1 bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 rounded text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shrink-0 uppercase font-mono"
        >
          <Plus className="w-3.5 h-3.5" />
          Create
        </button>
      </div>
      {error && <p className="text-xs text-red-650 dark:text-red-400">{error}</p>}
    </form>
  );
}
