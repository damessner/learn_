"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportClassroomButton() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/teacher/classrooms/import", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to import classroom");
        }

        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to import classroom";
        setError(message);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Import Classroom
      </h3>
      <button
        onClick={handleImport}
        disabled={importing}
        className="w-full text-center px-4 py-2 border border-neutral-350 dark:border-neutral-800 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
      >
        {importing ? "Importing..." : "📥 Import JSON File"}
      </button>
      {error && <p className="text-[10px] text-red-500 font-mono">{error}</p>}
    </div>
  );
}
