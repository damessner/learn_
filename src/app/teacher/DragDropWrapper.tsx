"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addExerciseToCourse, assignCourse, unassignCourse } from "@/lib/actions/course";
import { FolderOpen, FileText, Loader2, Check, X } from "lucide-react";
import Link from "next/link";
import { getExerciseTypeLabel, getExerciseTypeSymbol, getWorksheetUniqueCode } from "@/lib/exerciseLabels";
import CreateCourseForm from "./CreateCourseForm";
import DeleteCourseButton from "./DeleteCourseButton";
import DeleteExerciseButton from "./DeleteExerciseButton";
import DuplicateExerciseButton from "./DuplicateExerciseButton";
import { assignExercise } from "@/lib/actions/assignment";

interface BuildStatus {
  status: string;
  progress: number;
  message: string;
}

interface ClassroomOption {
  id: string;
  name: string;
}

export default function DragDropWrapper({
  courses,
  allExercises,
  classrooms,
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
    courseAssignments: {
      id: string;
      classroom: { id: string; name: string };
    }[];
  }[];
  allExercises: {
    id: string;
    title: string;
    type: string;
    courseId: string | null;
  }[];
  classrooms: ClassroomOption[];
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isPending, startTransition] = useTransition();
  const [droppingToCourse, setDroppingToCourse] = useState<string | null>(null);
  const [dragOverCourse, setDragOverCourse] = useState<string | null>(null);
  const [buildStatuses, setBuildStatuses] = useState<Record<string, BuildStatus>>({});

  // Exercise assignment state
  const [assigningExercise, setAssigningExercise] = useState<{ id: string; title: string } | null>(null);
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Course assignment state
  const [assigningCourse, setAssigningCourse] = useState<{ id: string; title: string } | null>(null);
  const [courseSelectedClassrooms, setCourseSelectedClassrooms] = useState<string[]>([]);
  const [courseDueDate, setCourseDueDate] = useState("");
  const [courseAssignLoading, setCourseAssignLoading] = useState(false);
  const [courseAssignError, setCourseAssignError] = useState<string | null>(null);
  const [courseAssignSuccess, setCourseAssignSuccess] = useState(false);
  const [unassigningCourseAssignment, setUnassigningCourseAssignment] = useState<string | null>(null);

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
        router.refresh();
      }
    } catch {
      setAssignError("Failed to assign exercise.");
    } finally {
      setAssignLoading(false);
    }
  };


  const handleCourseAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningCourse || courseSelectedClassrooms.length === 0) return;

    setCourseAssignLoading(true);
    setCourseAssignError(null);
    setCourseAssignSuccess(false);

    try {
      const results = await Promise.all(
        courseSelectedClassrooms.map((classId) =>
          assignCourse(classId, assigningCourse.id, courseDueDate || undefined)
        )
      );

      const errors = results.filter((res) => res && res.error);
      if (errors.length > 0) {
        setCourseAssignError(
          `Failed to assign to some classrooms: ${errors.map((err) => err.error).join(", ")}`
        );
      } else {
        setCourseAssignSuccess(true);
        setCourseSelectedClassrooms([]);
        setCourseDueDate("");
        setTimeout(() => {
          setAssigningCourse(null);
          setCourseAssignSuccess(false);
        }, 1500);
        router.refresh();
      }
    } catch {
      setCourseAssignError("Failed to assign course.");
    } finally {
      setCourseAssignLoading(false);
    }
  };

  const handleUnassignCourse = async (courseAssignmentId: string) => {
    setUnassigningCourseAssignment(courseAssignmentId);
    const result = await unassignCourse(courseAssignmentId);
    if (result?.error) {
      console.error(result.error);
    }
    setUnassigningCourseAssignment(null);
    router.refresh();
  };

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/exercises/build-statuses");
        if (res.ok && active) {
          const data = await res.json();
          setBuildStatuses(data.statuses || {});
        }
      } catch (err) {
        console.error("Failed to fetch build statuses:", err);
      }
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragLeave = (e: React.DragEvent<HTMLElement>, _courseId: string) => {
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
                      <button
                        onClick={() => {
                          setAssigningCourse({ id: course.id, title: course.title });
                          setCourseSelectedClassrooms([]);
                          setCourseDueDate("");
                          setCourseAssignError(null);
                          setCourseAssignSuccess(false);
                        }}
                        className="text-[10px] font-bold font-mono uppercase tracking-wider border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded transition text-neutral-700 dark:text-neutral-300 cursor-pointer"
                      >
                        Assign
                      </button>
                      <DeleteCourseButton
                        courseId={course.id}
                        courseTitle={course.title}
                      />
                    </div>
                  </summary>

                  {/* Assigned classrooms */}
                  {course.courseAssignments.length > 0 && (
                    <div className="border-t border-neutral-200 dark:border-neutral-800 px-5 py-2 flex flex-wrap items-center gap-2 bg-neutral-50/30 dark:bg-neutral-950/10">
                      <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-500 shrink-0">
                        Assigned to:
                      </span>
                      {course.courseAssignments.map((ca) => (
                        <span
                          key={ca.id}
                          className="inline-flex items-center gap-1.5 text-[10px] bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono"
                        >
                          {ca.classroom.name}
                          <button
                            onClick={() => handleUnassignCourse(ca.id)}
                            disabled={unassigningCourseAssignment === ca.id}
                            className="hover:text-red-600 dark:hover:text-red-400 cursor-pointer disabled:opacity-50"
                            title="Unassign course"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

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
                              <span className="text-base shrink-0 select-none" title={getExerciseTypeLabel(ex.type)}>
                                {getExerciseTypeSymbol(ex.type)}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                                    {ex.title}
                                  </span>
                                  <span className="text-[9px] font-bold font-mono bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0" title={`Unique Identifier: ${getWorksheetUniqueCode(ex.id)}`}>
                                    ID: {getWorksheetUniqueCode(ex.id)}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {ex.id}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded shrink-0">
                                {getExerciseTypeLabel(ex.type)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                              {ex.type === "live-quiz" && (
                                <Link
                                  href={`/teacher/live-quiz/host/${ex.id}`}
                                  className="inline-flex items-center gap-1 bg-purple-650 hover:bg-purple-700 text-white dark:bg-purple-600 dark:hover:bg-purple-500 px-2 py-1 rounded transition font-sans font-semibold text-xs shadow-sm"
                                >
                                  Host Live
                                </Link>
                              )}
                              <button
                                onClick={() => setAssigningExercise(ex)}
                                className="inline-flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded transition text-neutral-700 dark:text-neutral-300 font-sans font-semibold text-xs cursor-pointer"
                              >
                                Add to Class
                              </button>
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
                              <DuplicateExerciseButton
                                exerciseId={ex.id}
                                exerciseTitle={ex.title}
                              />
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

      {/* All Worksheets Library */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-mono uppercase tracking-wide border-b pb-2 flex items-center gap-2">
          <FileText className="w-5 h-5 text-neutral-500" />
          All Worksheets ({allExercises.length})
        </h2>

        {allExercises.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded text-neutral-500">
            No worksheets created yet. Click &ldquo;+ Create Worksheet&rdquo; to build one.
          </div>
        ) : (
          <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs font-mono uppercase bg-neutral-50 dark:bg-neutral-955 border-b border-neutral-300 dark:border-neutral-800 text-neutral-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Title</th>
                    <th className="px-6 py-3 font-semibold">Exercise ID / Key</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Course</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {allExercises.map((ex) => {
                    const course = courses.find((c) => c.id === ex.courseId);
                    return (
                      <tr
                        key={ex.id}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, ex.id)}
                        onDragEnd={handleDragEnd}
                        className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 font-mono text-xs cursor-grab transition-opacity"
                      >
                        <td className="px-6 py-4 font-semibold text-neutral-900 dark:text-neutral-100 font-sans text-sm">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-base shrink-0 select-none" title={getExerciseTypeLabel(ex.type)}>
                                {getExerciseTypeSymbol(ex.type)}
                              </span>
                              <span className="text-[9px] font-bold font-mono bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0" title={`Unique Identifier: ${getWorksheetUniqueCode(ex.id)}`}>
                                ID: {getWorksheetUniqueCode(ex.id)}
                              </span>
                              <span>{ex.title}</span>
                              {buildStatuses[ex.id]?.status === "processing" && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-purple-650 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded animate-pulse">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin text-purple-500" />
                                  Building ({buildStatuses[ex.id].progress}%)
                                </span>
                              )}
                            </div>
                            {buildStatuses[ex.id]?.status === "processing" && (
                              <div className="space-y-1 mt-0.5">
                                <div className="text-[10px] text-neutral-450 dark:text-neutral-500 font-mono">
                                  {buildStatuses[ex.id].message}
                                </div>
                                <div className="w-48 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                                    style={{ width: `${buildStatuses[ex.id].progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-neutral-600 dark:text-neutral-450">
                          <code>{ex.id}</code>
                        </td>
                        <td className="px-6 py-4 text-neutral-500">
                          <span className="text-xs font-mono uppercase bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                            {getExerciseTypeLabel(ex.type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400">
                          {course ? (
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {course.title}
                            </span>
                          ) : (
                            <span className="text-neutral-400 italic">None (Standalone)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          {buildStatuses[ex.id]?.status === "processing" ? (
                            <span className="text-[11px] text-neutral-400 italic font-mono font-medium">
                              Building assets...
                            </span>
                          ) : (
                            <>
                              {ex.type === "live-quiz" && (
                                <Link
                                  href={`/teacher/live-quiz/host/${ex.id}`}
                                  className="inline-flex items-center gap-1 bg-purple-650 hover:bg-purple-700 text-white dark:bg-purple-600 dark:hover:bg-purple-500 px-2.5 py-1 rounded transition font-sans font-semibold text-xs shadow-sm"
                                >
                                  Host Live
                                </Link>
                              )}
                              <button
                                onClick={() => setAssigningExercise(ex)}
                                className="inline-flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2.5 py-1 rounded transition text-neutral-700 dark:text-neutral-300 font-sans font-semibold text-xs cursor-pointer"
                              >
                                Add to Class
                              </button>
                              <Link
                                href={`/teacher/preview/${ex.id}`}
                                className="inline-flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2.5 py-1 rounded transition text-neutral-700 dark:text-neutral-300 font-sans font-semibold text-xs"
                              >
                                Preview
                              </Link>
                              <Link
                                href={`/teacher/edit/${ex.id}`}
                                className="inline-flex items-center gap-1 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-150 dark:hover:bg-neutral-850 px-2.5 py-1 bg-neutral-50 dark:bg-neutral-955 rounded transition text-neutral-850 dark:text-neutral-250 font-sans font-semibold text-xs"
                              >
                                Edit
                              </Link>
                              <DuplicateExerciseButton
                                exerciseId={ex.id}
                                exerciseTitle={ex.title}
                              />
                              <DeleteExerciseButton
                                exerciseId={ex.id}
                                exerciseTitle={ex.title}
                              />
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Course Assignment Modal dialog */}
      {assigningCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded p-6 shadow-2xl space-y-5 animate-fade-in relative animate-duration-200">
            <button
              onClick={() => setAssigningCourse(null)}
              className="absolute right-4 top-4 text-neutral-500 hover:text-black dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-sm font-bold font-mono uppercase text-neutral-800 dark:text-neutral-300">
                Assign Course
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Course: <strong>{assigningCourse.title}</strong>
              </p>
            </div>

            {courseAssignSuccess ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-green-700 dark:text-green-400 space-y-2">
                <Check className="w-10 h-10 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-full p-2 animate-bounce" />
                <span className="font-mono font-bold text-xs uppercase">Course Assigned!</span>
              </div>
            ) : (
              <form onSubmit={handleCourseAssignSubmit} className="space-y-4 font-mono text-xs">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    Select Classroom(s)
                  </label>
                  {classrooms.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">No classrooms available.</p>
                  ) : (
                    <div className="border border-neutral-300 dark:border-neutral-800 rounded p-3 max-h-36 overflow-y-auto space-y-2">
                      {classrooms.map((cls) => {
                        const checked = courseSelectedClassrooms.includes(cls.id);
                        return (
                          <label
                            key={cls.id}
                            className="flex items-center gap-2 cursor-pointer select-none text-neutral-750 dark:text-neutral-300"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setCourseSelectedClassrooms((prev) =>
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

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    Due Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={courseDueDate}
                    onChange={(e) => setCourseDueDate(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 p-2.5 font-mono text-xs focus:outline-none focus:border-black dark:focus:border-white rounded-none"
                  />
                </div>

                {courseAssignError && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded flex items-center gap-2">
                    <X className="w-3.5 h-3.5 shrink-0 text-red-500" />
                    <span className="text-[10px]">{courseAssignError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssigningCourse(null)}
                    className="px-4 py-2 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-bold uppercase text-[10px] rounded cursor-pointer text-neutral-700 dark:text-neutral-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={courseAssignLoading || courseSelectedClassrooms.length === 0}
                    className="px-5 py-2 bg-black text-white dark:bg-white dark:text-black hover:opacity-90 font-bold uppercase text-[10px] rounded cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {courseAssignLoading ? "Assigning..." : "Assign Course"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Classroom Assignment Modal dialog */}
      {assigningExercise && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded p-6 shadow-2xl space-y-5 animate-fade-in relative animate-duration-200">
            <button
              onClick={() => setAssigningExercise(null)}
              className="absolute right-4 top-4 text-neutral-500 hover:text-black dark:hover:text-white cursor-pointer"
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
                    className="px-4 py-2 border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-bold uppercase text-[10px] rounded cursor-pointer text-neutral-700 dark:text-neutral-300"
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
    </>
  );
}
