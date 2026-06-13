"use client";

import React, { useState } from "react";
import { bulkImportStudents } from "@/lib/actions/classroom";
import { Users, AlertCircle, CheckCircle } from "lucide-react";

interface BulkImportFormProps {
  classroomId: string;
}

export default function BulkImportForm({ classroomId }: BulkImportFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [usernames, setUsernames] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    importedCount: number;
    enrolledCount: number;
    defaultPassword: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await bulkImportStudents(classroomId, usernames, customPassword);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setResult({
          importedCount: res.importedCount ?? 0,
          enrolledCount: res.enrolledCount ?? 0,
          defaultPassword: res.defaultPassword ?? customPassword,
        });
        setUsernames("");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold font-mono text-sm uppercase tracking-wide flex items-center gap-2 text-neutral-800 dark:text-neutral-250">
          <Users className="w-4 h-4 text-neutral-500" />
          Bulk Import Pupils
        </h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-semibold font-mono uppercase text-neutral-500 hover:text-black dark:hover:text-white transition"
        >
          {isOpen ? "Hide Form" : "Show Form"}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-neutral-500 leading-normal">
            Paste pupil names or usernames separated by commas, semicolons, or newlines. 
            If the usernames do not exist in the system, accounts will be created for them with a default password.
          </p>

          <textarea
            value={usernames}
            onChange={(e) => setUsernames(e.target.value)}
            placeholder="e.g. johndoe, janesmith, alexjones"
            disabled={loading}
            rows={4}
            className="w-full text-xs font-mono p-3 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 rounded focus:outline-none focus:border-black dark:focus:border-white transition"
            required
          />

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block">
              Default Password (required)
            </label>
            <input
              type="text"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              placeholder="Enter secure password (min 8 chars)"
              disabled={loading}
              minLength={8}
              required
              className="w-full text-xs font-mono p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 rounded focus:outline-none focus:border-black dark:focus:border-white transition"
            />
            <p className="text-[10px] text-neutral-400">Required. Minimum 8 characters. No insecure default is used.</p>
          </div>

          <button
            type="submit"
            disabled={loading || !usernames.trim() || customPassword.trim().length < 8}
            className="px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded text-xs font-mono uppercase font-semibold hover:opacity-90 transition shadow disabled:opacity-50"
          >
            {loading ? "Importing..." : "Run Import"}
          </button>

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-1 p-3 text-xs bg-green-50 text-green-700 border border-green-200 rounded space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />
                <span className="font-bold">Bulk Import Complete!</span>
              </div>
              <ul className="pl-6 list-disc space-y-0.5">
                <li>Created {result.importedCount} new user account(s).</li>
                <li>Enrolled {result.enrolledCount} user(s) into this class.</li>
                <li>
                  Default password for newly created accounts:{" "}
                  <code className="bg-green-100 dark:bg-green-950 font-mono font-bold px-1 rounded text-green-800 dark:text-green-300">
                    {result.defaultPassword}
                  </code>
                </li>
              </ul>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
