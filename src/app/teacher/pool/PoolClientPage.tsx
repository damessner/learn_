"use client";

import React, { useState, useTransition, useMemo } from "react";
import { rateExerciseAction } from "@/lib/actions/exercise";
import { assignExercise } from "@/lib/actions/assignment";
import {
  Search,
  Star,
  Filter,
  Compass,
  ArrowLeft,
  Check,
  X,
  ExternalLink,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";

interface SerializedExercise {
  id: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  badgeName: string;
  badgeEmoji: string;
  updatedAt: string;
  creator: { id: string; username: string } | null;
  ratingsCount: number;
  averageRating: number;
  myRating: number;
  pupilAvgScore: number | null;
  pupilAvgDuration: number | null;
  pupilFeedbackTags: Array<{ name: string; count: number }>;
}

interface ClassroomOption {
  id: string;
  name: string;
}

interface PoolClientPageProps {
  initialExercises: SerializedExercise[];
  classrooms: ClassroomOption[];
  currentUserId: string;
}

export default function PoolClientPage({
  initialExercises,
  classrooms,
  currentUserId,
}: PoolClientPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [creatorFilter, setCreatorFilter] = useState("all"); // "all", "me", "others"
  const [sortBy, setSortBy] = useState("rating"); // "rating", "title", "recent"

  // Quick Assign Modal State
  const [assigningExercise, setAssigningExercise] = useState<SerializedExercise | null>(null);
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Star Hover State per Exercise (stores { [exerciseId]: hoverValue })
  const [starHovers, setStarHovers] = useState<Record<string, number>>({});

  // Error/Success messages for rating
  const [ratingStatus, setRatingStatus] = useState<Record<string, { success?: boolean; error?: string }>>({});

  // Bulk Assign State
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);

  // Import State
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      setImportError(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/teacher/exercises/import", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to import worksheet");
        }

        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to import worksheet";
        setImportError(message);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const handleToggleSelectExercise = (id: string) => {
    setSelectedExerciseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedExerciseIds.length === 0 || selectedClassrooms.length === 0) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(false);

    try {
      const promises: Promise<{ error?: string } | void>[] = [];
      selectedExerciseIds.forEach((exerciseId) => {
        selectedClassrooms.forEach((classId) => {
          promises.push(assignExercise(classId, exerciseId, dueDate || undefined));
        });
      });

      const results = await Promise.all(promises);
      const errors = results.filter((res): res is { error: string } => !!(res && res.error));

      if (errors.length > 0) {
        setAssignError(
          `Failed to assign some worksheets: ${errors.map((err) => err.error).join(", ")}`
        );
      } else {
        setAssignSuccess(true);
        setSelectedExerciseIds([]);
        setSelectedClassrooms([]);
        setDueDate("");
        setTimeout(() => {
          setAssignSuccess(false);
          router.refresh();
        }, 2000);
      }
    } catch {
      setAssignError("Failed to assign exercises.");
    } finally {
      setAssignLoading(false);
    }
  };

  // Filter & Sort Exercises
  const filteredExercises = useMemo(() => {
    return initialExercises
      .filter((ex) => {
        // Search query check
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          ex.title.toLowerCase().includes(query) ||
          ex.description.toLowerCase().includes(query) ||
          ex.tags.some((t) => t.toLowerCase().includes(query));

        // Type check
        const matchesType = selectedType === "all" || ex.type === selectedType;

        // Creator check
        let matchesCreator = true;
        if (creatorFilter === "me") {
          matchesCreator = ex.creator?.id === currentUserId;
        } else if (creatorFilter === "others") {
          matchesCreator = ex.creator?.id !== currentUserId;
        }

        return matchesQuery && matchesType && matchesCreator;
      })
      .sort((a, b) => {
        if (sortBy === "rating") {
          return b.averageRating - a.averageRating || b.ratingsCount - a.ratingsCount;
        }
        if (sortBy === "recent") {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return a.title.localeCompare(b.title);
      });
  }, [initialExercises, searchQuery, selectedType, creatorFilter, sortBy, currentUserId]);

  // Handle rating click
  const handleRate = async (exerciseId: string, stars: number) => {
    setRatingStatus((prev) => ({ ...prev, [exerciseId]: {} }));

    startTransition(async () => {
      try {
        const res = await rateExerciseAction(exerciseId, stars);
        if (res?.error) {
          setRatingStatus((prev) => ({
            ...prev,
            [exerciseId]: { error: res.error },
          }));
        } else if (res?.success) {
          setRatingStatus((prev) => ({
            ...prev,
            [exerciseId]: { success: true },
          }));
          router.refresh();
          // Clear status after 3 seconds
          setTimeout(() => {
            setRatingStatus((prev) => {
              const next = { ...prev };
              delete next[exerciseId];
              return next;
            });
          }, 3000);
        }
      } catch {
        setRatingStatus((prev) => ({
          ...prev,
          [exerciseId]: { error: "An unexpected error occurred." },
        }));
      }
    });
  };

  // Handle classroom assignment submission
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningExercise || selectedClassrooms.length === 0) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(false);

    try {
      const results = await Promise.all(
        selectedClassrooms.map((classId) =>
          assignExercise(classId, assigningExercise.id, dueDate || undefined)
        )
      );

      const errors = results.filter((res) => res && res.error);

      if (errors.length > 0) {
        setAssignError(
          `Failed to assign to some classrooms: ${errors.map((err) => err.error).join(", ")}`
        );
      } else {
        setAssignSuccess(true);
        setSelectedClassrooms([]);
        setDueDate("");
        // Close modal after delay
        setTimeout(() => {
          setAssigningExercise(null);
          setAssignSuccess(false);
        }, 1500);
      }
    } catch {
      setAssignError("Failed to assign exercise.");
    } finally {
      setAssignLoading(false);
    }
  };

  const exerciseTypes = useMemo(() => {
    const types = new Set(initialExercises.map((e) => e.type));
    return Array.from(types).sort();
  }, [initialExercises]);

  return (
    <div className="space-y-8">
      {/* Header and navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-6 gap-4">
        <div className="space-y-1">
          <Link
            href="/teacher"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <h1 className="text-2xl font-black font-mono uppercase tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Compass className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
            Worksheet Pool
          </h1>
          <p className="text-xs text-neutral-500 font-mono">
            Explore worksheets, tasks, and quizzes created by all teachers in the platform.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {importError && (
            <span className="text-xs text-red-550 font-mono">{importError}</span>
          )}
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="border border-neutral-350 dark:border-neutral-850 bg-black text-white dark:bg-white dark:text-black font-mono text-xs uppercase tracking-wider py-1.5 px-4 hover:opacity-90 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {importing ? "Importing..." : "📥 Import Worksheet"}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 border border-neutral-350 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-950/20">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search worksheets, descriptions, or tags..."
            className="w-full text-xs font-mono pl-9 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded focus:outline-none focus:border-black dark:focus:border-white transition"
          />
        </div>

        {/* Type select */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full text-xs font-mono px-3 py-2.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded focus:outline-none focus:border-black dark:focus:border-white transition cursor-pointer"
          >
            <option value="all">All Exercise Types</option>
            {exerciseTypes.map((t) => (
              <option key={t} value={t}>
                {getExerciseTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>

        {/* Sorting & Creator filter */}
        <div className="flex gap-2">
          <select
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value)}
            className="flex-1 text-xs font-mono px-2 py-2.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded focus:outline-none focus:border-black dark:focus:border-white transition cursor-pointer"
          >
            <option value="all">All Worksheets</option>
            <option value="me">Created by Me</option>
            <option value="others">Created by Others</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex-1 text-xs font-mono px-2 py-2.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded focus:outline-none focus:border-black dark:focus:border-white transition cursor-pointer"
          >
            <option value="rating">Highest Rated</option>
            <option value="recent">Most Recent</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Bulk Assign Panel */}
      {selectedExerciseIds.length > 0 && (
        <div className="p-5 border border-indigo-300 dark:border-indigo-800 rounded bg-indigo-50/50 dark:bg-indigo-950/15 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold font-mono uppercase text-indigo-900 dark:text-indigo-350">
                Bulk Assign Worksheets
              </h3>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                Selected <strong>{selectedExerciseIds.length}</strong> worksheet(s): {" "}
                <span className="text-neutral-600 dark:text-neutral-400">
                  {initialExercises.filter(ex => selectedExerciseIds.includes(ex.id)).map(ex => `"${ex.title}"`).join(", ")}
                </span>
              </p>
            </div>
            <button
              onClick={() => setSelectedExerciseIds([])}
              className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-650 hover:underline cursor-pointer select-none"
            >
              Clear Selection
            </button>
          </div>

          <form onSubmit={handleBulkAssignSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end font-mono text-xs">
            {/* Select classroom */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block">
                Select Classroom(s)
              </label>
              <div className="border border-neutral-300 dark:border-neutral-800 rounded p-2.5 max-h-28 overflow-y-auto space-y-1.5 bg-white dark:bg-neutral-900">
                {classrooms.map((cls) => {
                  const checked = selectedClassrooms.includes(cls.id);
                  return (
                    <label key={cls.id} className="flex items-center gap-2 cursor-pointer select-none text-neutral-755 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedClassrooms((prev) =>
                            checked ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                          )
                        }
                        className="accent-black dark:accent-white"
                      />
                      {cls.name}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block">
                Due Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2 py-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 justify-end">
              <button
                type="submit"
                disabled={assignLoading || selectedClassrooms.length === 0}
                className="w-full px-5 py-2.5 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 font-bold uppercase text-[10px] rounded cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {assignLoading ? "Assigning..." : "Assign Bulk Now"}
              </button>
            </div>
          </form>

          {assignError && (
            <div className="p-2.5 bg-red-50 dark:bg-red-955/20 text-red-700 dark:text-red-305 border border-red-200 dark:border-red-900/50 rounded flex items-center gap-2 text-xs">
              <X className="w-3.5 h-3.5 shrink-0 text-red-500" />
              <span>{assignError}</span>
            </div>
          )}

          {assignSuccess && (
            <div className="p-2.5 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded flex items-center gap-2 text-xs">
              <Check className="w-3.5 h-3.5 shrink-0 text-green-550" />
              <span>Bulk assignment completed successfully!</span>
            </div>
          )}
        </div>
      )}

      {/* Grid List */}
      {filteredExercises.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 text-neutral-500 font-mono text-sm space-y-2">
          <Filter className="w-8 h-8 text-neutral-400 mx-auto" />
          <p>No worksheets match your active filter settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExercises.map((ex) => {
            const hoverStars = starHovers[ex.id] ?? 0;
            const status = ratingStatus[ex.id];

            return (
              <div
                key={ex.id}
                className="flex flex-col border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md transition duration-200 overflow-hidden"
              >
                {/* Card Header Info */}
                <div className="p-5 flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-350 px-2 py-0.5 rounded">
                      {getExerciseTypeLabel(ex.type)}
                    </span>
                    <div className="flex items-center gap-2.5">
                      {ex.badgeName && (
                        <span
                          className="text-[10px] font-mono font-semibold flex items-center gap-1 text-amber-600"
                          title={`Awards: ${ex.badgeName}`}
                        >
                          <span>{ex.badgeEmoji || "🏆"}</span>
                          <span>{ex.badgeName}</span>
                        </span>
                      )}
                      <input
                        type="checkbox"
                        checked={selectedExerciseIds.includes(ex.id)}
                        onChange={() => handleToggleSelectExercise(ex.id)}
                        className="w-4 h-4 accent-black dark:accent-white cursor-pointer rounded-sm border-neutral-300 dark:border-neutral-700 shrink-0"
                        title="Select worksheet for bulk assignment"
                      />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold font-mono uppercase text-neutral-900 dark:text-neutral-100 line-clamp-1">
                    {ex.title}
                  </h3>

                  <p className="text-xs text-neutral-500 line-clamp-3 leading-relaxed">
                    {ex.description || "No description provided."}
                  </p>

                  {/* Tags */}
                  {ex.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ex.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[9px] font-mono uppercase bg-neutral-50 border border-neutral-250 text-neutral-550 px-1.5 py-0.5"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pupil Analytics Section */}
                <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/20 dark:bg-neutral-950/10 space-y-2 text-[10px] font-mono">
                  <div className="flex justify-between items-center text-neutral-500">
                    <span>Pupil Avg Score:</span>
                    <span className="font-extrabold text-neutral-800 dark:text-neutral-200">
                      {ex.pupilAvgScore !== null ? `${Math.round(ex.pupilAvgScore)}%` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-500">
                    <span>Avg Time Spent:</span>
                    <span className="font-extrabold text-neutral-800 dark:text-neutral-200">
                      {ex.pupilAvgDuration !== null
                        ? `${Math.floor(ex.pupilAvgDuration / 60)}m ${Math.round(ex.pupilAvgDuration % 60)}s`
                        : "—"}
                    </span>
                  </div>
                  {ex.pupilFeedbackTags && ex.pupilFeedbackTags.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-dashed border-neutral-200 dark:border-neutral-850">
                      <span className="text-[9px] uppercase tracking-wide text-neutral-450 font-bold block">Pupil Feedback:</span>
                      <div className="flex flex-wrap gap-1">
                        {ex.pupilFeedbackTags.map((tag) => (
                          <span
                            key={tag.name}
                            className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                          >
                            {tag.name} ({tag.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rating Bar */}
                <div className="px-5 py-3.5 bg-neutral-50/50 dark:bg-neutral-950/20 border-t border-b border-neutral-200 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    {/* Stars Presentation */}
                    <div className="flex flex-col">
                      <span className="text-[8px] font-mono text-neutral-450 uppercase tracking-wide">
                        Average Rating
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="flex text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < Math.round(ex.averageRating)
                                  ? "fill-current"
                                  : "text-neutral-300 dark:text-neutral-700"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-neutral-600 dark:text-neutral-400 mt-0.5">
                          {ex.averageRating > 0 ? ex.averageRating.toFixed(1) : "—"} ({ex.ratingsCount})
                        </span>
                      </div>
                    </div>

                    {/* Interactive rate action */}
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-mono text-neutral-450 uppercase tracking-wide">
                        Your Rating
                      </span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const starVal = i + 1;
                          const isActive = hoverStars > 0 ? starVal <= hoverStars : starVal <= ex.myRating;
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={isPending}
                              onMouseEnter={() =>
                                setStarHovers((prev) => ({ ...prev, [ex.id]: starVal }))
                              }
                              onMouseLeave={() =>
                                setStarHovers((prev) => {
                                  const next = { ...prev };
                                  delete next[ex.id];
                                  return next;
                                })
                              }
                              onClick={() => handleRate(ex.id, starVal)}
                              className="focus:outline-none transition cursor-pointer text-amber-400 disabled:opacity-40"
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  isActive
                                    ? "fill-current"
                                    : "text-neutral-300 dark:text-neutral-700"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Feedback Status */}
                  {status?.error && (
                    <p className="text-[9px] font-mono text-red-650 text-right">{status.error}</p>
                  )}
                  {status?.success && (
                    <p className="text-[9px] font-mono text-green-600 text-right">Rating updated!</p>
                  )}
                </div>

                {/* Footer Info & Actions */}
                <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                  <span>
                    By: <strong>{ex.creator?.username || "System"}</strong>
                  </span>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/teacher/preview/${ex.id}`}
                      target="_blank"
                      className="underline hover:no-underline text-neutral-600 dark:text-neutral-450 flex items-center gap-0.5"
                    >
                      Preview
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <a
                      href={`/api/teacher/exercises/${ex.id}/export`}
                      className="underline hover:no-underline text-neutral-600 dark:text-neutral-450 flex items-center gap-0.5"
                      download
                    >
                      Export
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setAssigningExercise(ex);
                        setSelectedClassrooms([]);
                        setDueDate("");
                        setAssignError(null);
                        setAssignSuccess(false);
                      }}
                      className="px-2.5 py-1 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 font-bold uppercase rounded-sm flex items-center gap-1 shadow cursor-pointer"
                    >
                      <PlusCircle className="w-3 h-3" />
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Classroom Assignment Modal dialog */}
      {assigningExercise && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded p-6 shadow-2xl space-y-5 animate-fade-in relative">
            <button
              onClick={() => setAssigningExercise(null)}
              className="absolute right-4 top-4 text-neutral-500 hover:text-black dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-sm font-bold font-mono uppercase text-neutral-800 dark:text-neutral-300">
                Assign Worksheets
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Worksheet: <strong>{assigningExercise.title}</strong>
              </p>
            </div>

            {assignSuccess ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-green-700 dark:text-green-400 space-y-2">
                <Check className="w-10 h-10 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-full p-2 animate-bounce" />
                <span className="font-mono font-bold text-xs uppercase">Successfully Assigned!</span>
              </div>
            ) : (
              <form onSubmit={handleAssignSubmit} className="space-y-4 font-mono text-xs">
                {/* Classrooms mapping */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    Select Classroom(s)
                  </label>
                  {classrooms.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">No classrooms available.</p>
                  ) : (
                    <div className="border border-neutral-300 dark:border-neutral-800 rounded p-3 max-h-36 overflow-y-auto space-y-2">
                      {classrooms.map((cls) => {
                        const checked = selectedClassrooms.includes(cls.id);
                        return (
                          <label
                            key={cls.id}
                            className="flex items-center gap-2 cursor-pointer select-none text-neutral-750 dark:text-neutral-300"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedClassrooms((prev) =>
                                  checked ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                                )
                              }
                              className="accent-black dark:accent-white"
                            />
                            {cls.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    Due Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                  />
                </div>

                {assignError && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded flex items-center gap-2">
                    <X className="w-3.5 h-3.5 shrink-0 text-red-500" />
                    <span className="text-[10px]">{assignError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssigningExercise(null)}
                    className="px-4 py-2 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-bold uppercase text-[10px] rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assignLoading || selectedClassrooms.length === 0}
                    className="px-5 py-2 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 font-bold uppercase text-[10px] rounded cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {assignLoading ? "Assigning..." : "Assign Now"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
