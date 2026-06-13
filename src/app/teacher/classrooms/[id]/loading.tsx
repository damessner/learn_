import React from "react";

export default function ClassroomLoading() {
  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-8 animate-pulse">
      {/* Navigation Skeleton */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      </div>

      {/* Classroom Info Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-8 w-64 bg-neutral-250 dark:bg-neutral-800 rounded" />
        </div>
        <div className="h-16 w-64 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded" />
      </div>

      {/* Columns Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-32 border border-neutral-200 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/10 rounded" />
        <div className="h-32 border border-neutral-200 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/10 rounded" />
      </div>

      {/* Matrix Table Skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-40 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-64 w-full border border-neutral-250 dark:border-neutral-800 bg-neutral-50/20 dark:bg-neutral-950/20 rounded" />
      </div>
    </main>
  );
}
