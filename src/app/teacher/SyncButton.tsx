"use client";

import React, { useState } from "react";
import { triggerManualSync } from "@/app/actions";
import { RefreshCw } from "lucide-react";

export default function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const res = await triggerManualSync();
      if ('error' in res && res.error) {
        setStatus(`Error: ${res.error}`);
      } else if ('syncedCount' in res) {
        setStatus(`Synced: ${res.syncedCount} found, ${res.deletedCount} removed.`);
        // Auto clear status after 3 seconds
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err) {
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
        className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded text-xs font-mono uppercase font-semibold cursor-pointer disabled:opacity-50 transition"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Exercises"}
      </button>
      {status && (
        <span className="text-xs font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-850 px-2 py-1 rounded">
          {status}
        </span>
      )}
    </div>
  );
}
