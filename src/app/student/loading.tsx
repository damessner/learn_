import React from "react";

export default function StudentLoading() {
  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="border-b pb-4 space-y-2">
        <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-800 rounded font-mono" />
        <div className="h-4 w-96 bg-neutral-100 dark:bg-neutral-900 rounded" />
      </div>

      {/* Alert Center Skeleton */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-900/30 p-5 space-y-3">
        <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="space-y-2">
          <div className="h-10 w-full bg-neutral-100 dark:bg-neutral-900 rounded" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="space-y-6">
        <div className="h-6 w-40 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-32 border border-neutral-200 dark:border-neutral-800 rounded p-6 space-y-3 bg-neutral-50/20 dark:bg-neutral-900/10">
            <div className="h-5 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-32 bg-neutral-150 dark:bg-neutral-850 rounded" />
          </div>
          <div className="h-32 border border-neutral-200 dark:border-neutral-800 rounded p-6 space-y-3 bg-neutral-50/20 dark:bg-neutral-900/10">
            <div className="h-5 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-32 bg-neutral-150 dark:bg-neutral-850 rounded" />
          </div>
        </div>
      </div>
    </main>
  );
}
