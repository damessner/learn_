"use client";

import React, { useState } from "react";
import { addStudentToClassroomByUsername } from "@/lib/actions/classroom";
import { UserPlus, AlertCircle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface AddStudentFormProps {
  classroomId: string;
}

export default function AddStudentForm({ classroomId }: AddStudentFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await addStudentToClassroomByUsername(classroomId, cleanUsername);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setSuccess(true);
        setUsername("");
        router.refresh();
        // Hide success alert after 4 seconds
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900/30 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-neutral-500" />
        <h3 className="font-bold font-mono text-sm uppercase tracking-wide text-neutral-800 dark:text-neutral-250">
          Add Pupil by Username
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-neutral-500 leading-normal">
          Type an existing student&apos;s username to enroll them directly into this class.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. janesmith"
            disabled={loading}
            required
            className="flex-1 text-xs font-mono p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-955 text-neutral-900 dark:text-neutral-100 rounded focus:outline-none focus:border-black dark:focus:border-white transition animate-none"
          />
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded text-xs font-mono uppercase font-semibold hover:opacity-90 transition shadow disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 text-xs bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-2.5 text-xs bg-green-50 dark:bg-green-950/20 text-green-750 dark:text-green-300 border border-green-200 dark:border-green-900/50 rounded">
            <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />
            <span>Pupil successfully added!</span>
          </div>
        )}
      </form>
    </div>
  );
}
