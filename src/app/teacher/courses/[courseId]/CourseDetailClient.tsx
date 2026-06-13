"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  X,
  FolderOpen,
} from "lucide-react";
import {
  updateCourse,
  addExerciseToCourse,
  removeExerciseFromCourse,
  reorderCourseExercises,
  deleteCourse,
} from "@/lib/actions/course";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";

interface Course {
  id: string;
  title: string;
  description: string;
  exercises: Exercise[];
}

interface Exercise {
  id: string;
  title: string;
  type: string;
  order: number;
}

interface Props {
  course: Course;
  standaloneExercises: Exercise[];
}

export default function CourseDetailClient({
  course: initialCourse,
  standaloneExercises,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [course, setCourse] = useState<Course>(initialCourse);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await updateCourse(course.id, title, description);
      if (res.error) {
        setError(res.error);
      } else {
        setIsEditing(false);
        setCourse((prev) => ({ ...prev, title, description }));
        router.refresh();
      }
    });
  };

  const handleAddExercise = async () => {
    if (!selectedExerciseId) return;
    setError(null);

    startTransition(async () => {
      const res = await addExerciseToCourse(selectedExerciseId, course.id);
      if (res.error) {
        setError(res.error);
      } else {
        setSelectedExerciseId("");
        router.refresh();
      }
    });
  };

  const handleRemoveExercise = async (exerciseId: string) => {
    setError(null);

    startTransition(async () => {
      const res = await removeExerciseFromCourse(exerciseId);
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  // Drag-and-drop reordering state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, exerciseId: string) => {
    e.dataTransfer.setData("text/plain", exerciseId);
    setDraggedId(exerciseId);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const threshold = rect.height / 2;
    setDragOverIndex(y < threshold ? index : index + 1);
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!target.contains(relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData("text/plain");
    if (!droppedId) return;

    const exercises = [...course.exercises];
    const draggedIdx = exercises.findIndex((ex) => ex.id === droppedId);
    if (draggedIdx === -1) return;

    // Remove dragged item
    const [moved] = exercises.splice(draggedIdx, 1);

    // Adjust target index if item was removed from before the insertion point
    const targetIndex = draggedIdx < dropIndex ? dropIndex - 1 : dropIndex;
    exercises.splice(targetIndex, 0, moved);

    setCourse((prev) => ({ ...prev, exercises }));

    startTransition(async () => {
      const res = await reorderCourseExercises(course.id, exercises.map((ex) => ex.id));
      if (res.error) {
        setError(res.error);
        router.refresh();
      } else {
        router.refresh();
      }
    });

    setDraggedId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverIndex(null);
  };

  const handleDeleteCourse = async () => {
    setError(null);

    startTransition(async () => {
      const res = await deleteCourse(course.id);
      if (res.error) {
        setError(res.error);
      } else {
        router.push("/teacher");
      }
    });
  };

  const toggleEdit = () => {
    if (isEditing) {
      // Cancel editing — revert to course values
      setTitle(course.title);
      setDescription(course.description);
      setError(null);
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className="space-y-8">
      {/* Header / Breadcrumb */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <Link
            href="/teacher"
            className="text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white transition"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={toggleEdit}
              className="text-xs font-semibold uppercase font-mono border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
            >
              Edit Details
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-mono px-4 py-2 rounded flex items-center gap-2">
          <X className="w-3.5 h-3.5 shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto cursor-pointer hover:opacity-70"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Course Details Form */}
      <div className="border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900/50 shadow-sm p-6">
        {isEditing ? (
          <form onSubmit={handleUpdateCourse} className="space-y-4">
            <h2 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-neutral-500" />
              Course Details
            </h2>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="text-xs font-semibold uppercase font-mono bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 rounded hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={toggleEdit}
                className="text-xs font-semibold uppercase font-mono border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight font-mono uppercase text-neutral-900 dark:text-neutral-100">
              {course.title}
            </h1>
            {course.description ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {course.description}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">No description</p>
            )}
            <p className="text-xs font-mono text-neutral-500">
              {course.exercises.length} worksheet(s) in this course
            </p>
          </div>
        )}
      </div>

      {/* Worksheets in this Course */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-neutral-500" />
          Worksheets in this Course
        </h2>

        {course.exercises.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded text-neutral-500 text-sm">
            No worksheets in this course yet. Use the form below to add one.
          </div>
        ) : (
          <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
            <div
              onDragOver={handleContainerDragOver}
              onDragLeave={handleContainerDragLeave}
            >
              {course.exercises.map((ex, idx) => (
                <React.Fragment key={ex.id}>
                  {/* Drop indicator above this row */}
                  {dragOverIndex === idx && (
                    <div className="h-0.5 bg-blue-500" />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, ex.id)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 transition ${
                      draggedId === ex.id ? "opacity-50 cursor-grabbing" : "cursor-grab"
                    }`}
                  >
                    {/* Order indicator */}
                    <span className="text-xs font-mono text-neutral-400 w-5 shrink-0 text-center">
                      {idx + 1}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                        {ex.title}
                      </span>
                      <span className="text-[10px] uppercase font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded inline-block mt-0.5">
                        {getExerciseTypeLabel(ex.type)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/teacher/preview/${ex.id}`}
                        className="text-xs font-semibold uppercase font-mono border border-neutral-300 dark:border-neutral-700 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition"
                      >
                        Preview
                      </Link>
                      <Link
                        href={`/teacher/edit/${ex.id}`}
                        className="text-xs font-semibold uppercase font-mono border border-neutral-300 dark:border-neutral-700 px-2 py-1 bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleRemoveExercise(ex.id)}
                        disabled={isPending}
                        className="text-xs font-semibold uppercase font-mono border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-50 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              ))}
              {/* Drop indicator after last row */}
              {dragOverIndex === course.exercises.length && (
                <div className="h-0.5 bg-blue-500" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Worksheet */}
      <div className="border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900/50 shadow-sm p-5">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wide border-b pb-2 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-neutral-500" />
          Add Worksheet to Course
        </h3>

        {standaloneExercises.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">
            No standalone worksheets available. Create a new worksheet first.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="flex-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white text-neutral-900 dark:text-neutral-100"
            >
              <option value="">Select a worksheet...</option>
              {standaloneExercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({getExerciseTypeLabel(ex.type)})
                </option>
              ))}
            </select>
            <button
              onClick={handleAddExercise}
              disabled={!selectedExerciseId || isPending}
              className="flex items-center gap-1 text-xs font-semibold uppercase font-mono bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 rounded hover:opacity-90 transition disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to Course
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 dark:border-red-900 rounded bg-white dark:bg-neutral-900/50 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wide border-b border-red-200 dark:border-red-900 pb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
          <Trash2 className="w-4 h-4" />
          Danger Zone
        </h3>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs font-semibold uppercase font-mono border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
          >
            Delete Course
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              Are you sure you want to delete this course? All worksheets will
              be unlinked from the course but will not be deleted.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteCourse}
                disabled={isPending}
                className="text-xs font-semibold uppercase font-mono bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Yes, Delete Course"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs font-semibold uppercase font-mono border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
