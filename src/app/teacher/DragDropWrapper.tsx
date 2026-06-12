"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addExerciseToCourse } from "@/app/actions";
import { FolderOpen, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { getExerciseTypeLabel } from "@/lib/exerciseLabels";
import CreateCourseForm from "./CreateCourseForm";
import DeleteCourseButton from "./DeleteCourseButton";
import DeleteExerciseButton from "./DeleteExerciseButton";

export default function DragDropWrapper({
  courses,
  standaloneExercises,
}: {
  courses: {
    id: string;
    title: string;
    description: string | null;
    order: number;
    exercises: {
      id: string;
      title: string;
      type: string;
      order: number;
    }[];
  }[];
  standaloneExercises: {
    id: string;
    title: string;
    type: string;
  }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [droppingToCourse, setDroppingToCourse] = useState<string | null>(null);
  const [dragOverCourse, setDragOverCourse] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, exerciseId: string) => {
    e.dataTransfer.setData("text/plain", exerciseId);
    e.dataTransfer.effectAllowed = "move";
    // Reduce opacity on drag start
    const target = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      target.style.opacity = "0.5";
    });
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>, courseId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCourse(courseId);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>, courseId: string) => {
    const relatedTarget = e.relatedTarget as Node;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverCourse(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>, courseId: string) => {
    e.preventDefault();
    setDragOverCourse(null);
    const exerciseId = e.dataTransfer.getData("text/plain");
    if (!exerciseId) return;

    setDroppingToCourse(courseId);
    startTransition(async () => {
      await addExerciseToCourse(exerciseId, courseId);
      setDroppingToCourse(null);
      router.refresh();
    });
  };

  return (
    <>
      {/* Courses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-neutral-500" />
            Courses ({courses.length})
          </h2>
          <CreateCourseForm />
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded text-neutral-500">
            No courses created yet. Click &ldquo;+ Create Course&rdquo; above
            to organize your worksheets.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {courses.map((course) => {
              const isDropTarget = dragOverCourse === course.id;
              const isLoading = droppingToCourse === course.id;
              return (
                <details
                  key={course.id}
                  className={`group border border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm overflow-hidden ${
                    isDropTarget ? "ring-2 ring-blue-400 ring-offset-2" : ""
                  }`}
                  onDragOver={(e) => handleDragOver(e, course.id)}
                  onDragLeave={(e) => handleDragLeave(e, course.id)}
                  onDrop={(e) => handleDrop(e, course.id)}
                >
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 transition">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <FolderOpen className="w-6 h-6 text-neutral-400 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 truncate">
                          {course.title}
                        </h3>
                        {course.description && (
                          <p className="text-xs text-neutral-500 truncate mt-0.5">
                            {course.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {isLoading && (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      )}
                      <span className="text-xs bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded font-mono font-bold">
                        {course.exercises.length} worksheet
                        {course.exercises.length !== 1 ? "s" : ""}
                      </span>
                      <DeleteCourseButton
                        courseId={course.id}
                        courseTitle={course.title}
                      />
                    </div>
                  </summary>

                  {/* Course exercises list */}
                  <div className="border-t border-neutral-200 dark:border-neutral-800">
                    {course.exercises.length === 0 ? (
                      <div className="text-center py-8 text-sm text-neutral-400 italic">
                        No worksheets in this course yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                        {course.exercises.map((ex, idx) => (
                          <div
                            key={ex.id}
                            className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs font-mono text-neutral-400 w-5 shrink-0">
                                {idx + 1}.
                              </span>
                              <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                                  {ex.title}
                                </span>
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {ex.id}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded shrink-0">
                                {getExerciseTypeLabel(ex.type)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                              <Link
                                href={`/teacher/preview/${ex.id}`}
                                className="inline-flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded transition text-neutral-700 dark:text-neutral-300 font-sans font-semibold text-xs"
                              >
                                Preview
                              </Link>
                              <Link
                                href={`/teacher/edit/${ex.id}`}
                                className="inline-flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-150 dark:hover:bg-neutral-850 px-2 py-1 bg-neutral-50 dark:bg-neutral-950 rounded transition text-neutral-850 dark:text-neutral-250 font-sans font-semibold text-xs"
                              >
                                Edit
                              </Link>
                              <DeleteExerciseButton
                                exerciseId={ex.id}
                                exerciseTitle={ex.title}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>

      {/* Standalone Worksheets */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
          <FileText className="w-5 h-5 text-neutral-500" />
          Standalone Worksheets ({standaloneExercises.length})
        </h2>

        {standaloneExercises.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded text-neutral-500">
            {courses.length > 0
              ? "All worksheets are organized into courses."
              : 'No worksheets created yet. Click "+ Create Worksheet" to build one.'}
          </div>
        ) : (
          <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs font-mono uppercase bg-neutral-50 dark:bg-neutral-955 border-b border-neutral-300 dark:border-neutral-800 text-neutral-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Title</th>
                    <th className="px-6 py-3 font-semibold">
                      Exercise ID / Key
                    </th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {standaloneExercises.map((ex) => (
                    <tr
                      key={ex.id}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, ex.id)}
                      onDragEnd={handleDragEnd}
                      className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 font-mono text-xs cursor-grab transition-opacity"
                    >
                      <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-neutral-100 font-sans text-sm">
                        {ex.title}
                      </td>
                      <td className="px-6 py-4 text-neutral-600 dark:text-neutral-450">
                        <code>{ex.id}</code>
                      </td>
                      <td className="px-6 py-4 text-neutral-500">
                        <span className="text-xs font-mono uppercase bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                          {getExerciseTypeLabel(ex.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Link
                          href={`/teacher/preview/${ex.id}`}
                          className="inline-flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2.5 py-1 rounded transition text-neutral-700 dark:text-neutral-300 font-sans font-semibold text-xs"
                        >
                          Preview
                        </Link>
                        <Link
                          href={`/teacher/edit/${ex.id}`}
                          className="inline-flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-150 dark:hover:bg-neutral-850 px-2.5 py-1 bg-neutral-50 dark:bg-neutral-950 rounded transition text-neutral-850 dark:text-neutral-250 font-sans font-semibold text-xs"
                        >
                          Edit
                        </Link>
                        <DeleteExerciseButton
                          exerciseId={ex.id}
                          exerciseTitle={ex.title}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
