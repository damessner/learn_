"use client";

import React, { useState } from "react";
import { resetStudentPassword } from "@/lib/actions/classroom";
import { Key } from "lucide-react";

interface ResetPasswordButtonProps {
  studentId: string;
  studentName: string;
}

export default function ResetPasswordButton({ studentId, studentName }: ResetPasswordButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    const defaultNewPass = "Reset123!";
    const confirmMsg = `Reset password for "${studentName}"? The student's new password will be set to: ${defaultNewPass}`;
    if (!confirm(confirmMsg)) {
      return;
    }

    setLoading(false);
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const res = await resetStudentPassword(studentId, defaultNewPass);
      if (res?.error) {
        setError(res.error);
      } else {
        setMessage(`Password reset successfully to: ${defaultNewPass}`);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleReset}
        disabled={loading}
        title="Reset student password to default (Reset123!)"
        className="flex items-center gap-1 px-1.5 py-1 text-[10px] uppercase font-mono tracking-wider bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:border-neutral-700 rounded text-neutral-600 dark:text-neutral-300 transition"
      >
        <Key className="w-3 h-3" />
        Reset Password
      </button>
      {message && <span className="text-[10px] text-green-600 font-mono font-semibold">{message}</span>}
      {error && <span className="text-[10px] text-red-500 font-mono">{error}</span>}
    </div>
  );
}
