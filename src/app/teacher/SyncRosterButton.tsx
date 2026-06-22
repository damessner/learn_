"use client";

import React, { useState } from "react";
import { syncClassroomRoster } from "@/lib/actions/classroom";
import { RefreshCw } from "lucide-react";

interface SyncRosterButtonProps {
  classroomId: string;
}

export default function SyncRosterButton({ classroomId }: SyncRosterButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const res = await syncClassroomRoster(classroomId);
      if (res.error) {
        setStatus(`Error: ${res.error}`);
      } else if (res.success) {
        setStatus(`Synced: ${res.enrolledCount} new student(s).`);
        setTimeout(() => setStatus(null), 3000);
      }
    } catch {
      setStatus("Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1 px-2 py-0.5 border border-neutral-300 dark:border-neutral-800 bg-transparent text-neutral-600 dark:text-neutral-300 font-mono text-[9px] uppercase tracking-wider rounded-none hover:border-black dark:hover:border-white disabled:opacity-50 transition cursor-pointer"
      >
        <RefreshCw className={`w-2.5 h-2.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Teams Roster"}
      </button>
      {status && (
        <span className="text-[9px] font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-850 px-1.5 py-0.5">
          {status}
        </span>
      )}
    </div>
  );
}
