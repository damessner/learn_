"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { joinClassroom } from "@/lib/actions/classroom";
import { LogIn, AlertCircle, CheckCircle } from "lucide-react";

export default function JoinClassroomForm() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await joinClassroom(joinCode);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setSuccess(`Joined "${res.classroomName}" successfully!`);
        setJoinCode("");
        router.refresh();
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <LogIn className="w-4 h-4 text-neutral-500" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
          Join a Classroom
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            required
            disabled={loading}
            placeholder="Enter 6-character join code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="flex-1 text-sm font-mono border border-neutral-300 dark:border-neutral-700 rounded px-3 py-2 bg-transparent outline-none focus:border-black dark:focus:border-white uppercase tracking-widest"
          />
          <button
            type="submit"
            disabled={loading || joinCode.trim().length === 0}
            className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded text-xs font-mono uppercase font-semibold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shrink-0"
          >
            {loading ? "Joining..." : "Join"}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded text-xs text-green-700 dark:text-green-300">
            <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />
            <span>{success}</span>
          </div>
        )}
      </form>
    </div>
  );
}
