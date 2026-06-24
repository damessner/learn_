"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { joinLiveSession } from "@/lib/actions/live-quiz";
import { Loader2 } from "lucide-react";

interface JoinClientFormProps {
  userId?: string;
  defaultNickname: string;
}

// Live-quiz PINs are always exactly 6 digits (see security section #7 of README).
const PIN_LENGTH = 6;

export default function JoinClientForm({ userId, defaultNickname }: JoinClientFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState(searchParams.get("pin") || "");
  const [nickname, setNickname] = useState(defaultNickname);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The submit button is only enabled when the PIN is the exact expected length
  // and the nickname is non-empty. This gives the user immediate feedback that
  // the PIN is incomplete without waiting for the server to reject it.
  const isPinComplete = pin.length === PIN_LENGTH;
  const isNicknameValid = nickname.trim().length > 0;
  const canSubmit = isPinComplete && isNicknameValid && !loading;

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip non-digits, cap at PIN_LENGTH, and don't allow leading whitespace.
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const res = await joinLiveSession(pin, nickname, userId);
      if (res.error) {
        setError(res.error);
      } else if (res.success && res.sessionId && res.participantId && res.participantToken) {
        // Navigate to student play screen
        const params = new URLSearchParams({
          participantId: res.participantId,
          participantToken: res.participantToken,
        });
        router.push(`/student/live-quiz/play/${res.sessionId}?${params.toString()}`);
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
          Game PIN ({pin.length}/{PIN_LENGTH})
        </label>
        <input
          type="text"
          required
          maxLength={PIN_LENGTH}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          value={pin}
          onChange={handlePinChange}
          placeholder="123456"
          className="w-full text-center text-lg font-extrabold tracking-widest border border-neutral-300 dark:border-neutral-750 rounded-xl p-3 bg-transparent outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
          aria-invalid={!isPinComplete && pin.length > 0 ? "true" : undefined}
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
        disabled={!canSubmit}
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
