import React from "react";

export default function TeacherLoading() {
  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-10 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-4 w-48 bg-neutral-150 dark:bg-neutral-850 rounded" />
        </div>
        <div className="h-10 w-36 bg-neutral-200 dark:bg-neutral-850 rounded" />
      </div>

      {/* Classrooms Grid Skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-40 border border-neutral-250 dark:border-neutral-800 rounded p-6 bg-neutral-50/20 dark:bg-neutral-900/10 space-y-4">
            <div className="h-5 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-1/2 bg-neutral-150 dark:bg-neutral-850 rounded" />
            <div className="h-6 w-16 bg-neutral-100 dark:bg-neutral-900 rounded" />
          </div>
          <div className="h-40 border border-neutral-250 dark:border-neutral-800 rounded p-6 bg-neutral-50/20 dark:bg-neutral-900/10 space-y-4">
            <div className="h-5 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-1/2 bg-neutral-150 dark:bg-neutral-850 rounded" />
            <div className="h-6 w-16 bg-neutral-100 dark:bg-neutral-900 rounded" />
          </div>
          <div className="h-40 border border-neutral-250 dark:border-neutral-800 rounded p-6 bg-neutral-50/20 dark:bg-neutral-900/10 space-y-4">
            <div className="h-5 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-1/2 bg-neutral-150 dark:bg-neutral-850 rounded" />
            <div className="h-6 w-16 bg-neutral-100 dark:bg-neutral-900 rounded" />
          </div>
        </div>
      </div>
    </main>
  );
}
