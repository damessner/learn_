"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { joinLiveSession } from "@/lib/actions/live-quiz";
import { Loader2 } from "lucide-react";

interface JoinClientFormProps {
  userId?: string;
  defaultNickname: string;
}

export default function JoinClientForm({ userId, defaultNickname }: JoinClientFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState(searchParams.get("pin") || "");
  const [nickname, setNickname] = useState(defaultNickname);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !nickname.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await joinLiveSession(pin, nickname, userId);
      if (res.error) {
        setError(res.error);
      } else if (res.success && res.sessionId && res.participantId) {
        // Navigate to student play screen
        router.push(`/student/live-quiz/play/${res.sessionId}?participantId=${res.participantId}`);
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* PIN Input */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
          Game PIN
        </label>
        <input
          type="text"
          required
          maxLength={6}
          pattern="\d*"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="e.g. 123456"
          className="w-full text-center text-lg font-extrabold tracking-widest border border-neutral-300 dark:border-neutral-750 rounded-xl p-3 bg-transparent outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
        />
      </div>

      {/* Nickname Input */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
          Nickname
        </label>
        <input
          type="text"
          required
          maxLength={15}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Enter nickname"
          className="w-full text-center text-sm font-semibold border border-neutral-300 dark:border-neutral-750 rounded-xl p-3 bg-transparent outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-650 dark:text-red-400 font-semibold text-center">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !pin || !nickname}
        className="w-full bg-purple-650 hover:bg-purple-700 text-white font-bold font-mono text-xs py-3.5 rounded-xl uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Joining Session...
          </>
        ) : (
          "OK, Go! 🎮"
        )}
      </button>

      {userId && (
        <p className="text-[10px] text-center text-neutral-400 italic">
          Logged in student. Result will save to your gradebook automatically.
        </p>
      )}
    </form>
  );
}
