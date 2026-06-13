"use client";

import React, { useState } from "react";
import { assignExercise } from "@/lib/actions/assignment";
import { assignCourse } from "@/lib/actions/course";

interface ClassroomOption {
  id: string;
  name: string;
}

interface ExerciseOption {
  id: string;
  title: string;
  type: string;
}

interface CourseOption {
  id: string;
  title: string;
}

interface AssignExerciseFormProps {
  classrooms: ClassroomOption[];
  exercises: ExerciseOption[];
  courses: CourseOption[];
}

type Mode = "exercise" | "course";

export default function AssignExerciseForm({
  classrooms,
  exercises,
  courses,
}: AssignExerciseFormProps) {
  const [mode, setMode] = useState<Mode>("exercise");

  // Exercise assignment state
  const [classroomIds, setClassroomIds] = useState<string[]>([]);
  const [exerciseId, setExerciseId] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Course assignment state
  const [courseClassroomIds, setCourseClassroomIds] = useState<string[]>([]);
  const [courseId, setCourseId] = useState("");
  const [courseDueDate, setCourseDueDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    success?: boolean;
    error?: string;
  } | null>(null);

  const handleExerciseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (classroomIds.length === 0 || !exerciseId) return;

    setLoading(true);
    setStatus(null);

    try {
      const results = await Promise.all(
        classroomIds.map((id) =>
          assignExercise(id, exerciseId, dueDate || undefined)
        )
      );

      const errors = results.filter((res) => res && res.error);

      if (errors.length > 0) {
        setStatus({
          error: `Failed to assign to some classrooms: ${errors
            .map((err) => err.error)
            .join(", ")}`,
        });
      } else {
        setStatus({ success: true });
        setExerciseId("");
        setDueDate("");
        setClassroomIds([]);
        setTimeout(() => setStatus(null), 3000);
      }
    } catch {
      setStatus({ error: "Failed to create assignment." });
    } finally {
      setLoading(false);
    }
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (courseClassroomIds.length === 0 || !courseId) return;

    setLoading(true);
    setStatus(null);

    try {
      const results = await Promise.all(
        courseClassroomIds.map((id) =>
          assignCourse(id, courseId, courseDueDate || undefined)
        )
      );

      const errors = results.filter((res) => res && res.error);

      if (errors.length > 0) {
        setStatus({
          error: `Failed to assign to some classrooms: ${errors
            .map((err) => err.error)
            .join(", ")}`,
        });
      } else {
        setStatus({ success: true });
        setCourseId("");
        setCourseDueDate("");
        setCourseClassroomIds([]);
        setTimeout(() => setStatus(null), 3000);
      }
    } catch {
      setStatus({ error: "Failed to assign course." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
          Assign to Classrooms
        </h3>
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode("exercise");
              setStatus(null);
            }}
            className={`text-[10px] font-mono uppercase font-semibold px-2.5 py-1 rounded transition cursor-pointer ${
              mode === "exercise"
                ? "bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Exercise
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("course");
              setStatus(null);
            }}
            className={`text-[10px] font-mono uppercase font-semibold px-2.5 py-1 rounded transition cursor-pointer ${
              mode === "course"
                ? "bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Course
          </button>
        </div>
      </div>

      {mode === "exercise" ? (
        <form onSubmit={handleExerciseSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
              Select Classrooms (Select multiple to bulk assign)
            </label>
            <div className="flex flex-wrap gap-2 border border-neutral-200 dark:border-neutral-800 rounded p-3 bg-neutral-50/50 dark:bg-neutral-950/20">
              {classrooms.map((c) => {
                const isChecked = classroomIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold cursor-pointer transition select-none font-mono ${
                      isChecked
                        ? "bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-105 dark:text-black dark:border-neutral-105 shadow-sm"
                        : "border-neutral-300 dark:border-neutral-750 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={loading}
                      onChange={() => {
                        if (isChecked) {
                          setClassroomIds(classroomIds.filter((id) => id !== c.id));
                        } else {
                          setClassroomIds([...classroomIds, c.id]);
                        }
                      }}
                      className="sr-only"
                    />
                    {c.name}
                  </label>
                );
              })}
              {classrooms.length === 0 && (
                <span className="text-xs text-neutral-450 italic">No classrooms available.</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                Select Exercise
              </label>
              <select
                required
                disabled={loading}
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              >
                <option value="">-- Choose Exercise --</option>
                {exercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                Due Date (Optional)
              </label>
              <input
                type="date"
                disabled={loading}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-755 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="submit"
              disabled={loading || classroomIds.length === 0 || !exerciseId}
              className="bg-neutral-905 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-black px-4 py-2 rounded text-xs font-semibold transition disabled:opacity-50 cursor-pointer uppercase font-mono"
            >
              {loading ? "Assigning..." : "Assign Exercise"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCourseSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450 block">
              Select Classrooms (Select multiple to bulk assign)
            </label>
            <div className="flex flex-wrap gap-2 border border-neutral-200 dark:border-neutral-800 rounded p-3 bg-neutral-50/50 dark:bg-neutral-950/20">
              {classrooms.map((c) => {
                const isChecked = courseClassroomIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold cursor-pointer transition select-none font-mono ${
                      isChecked
                        ? "bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-105 dark:text-black dark:border-neutral-105 shadow-sm"
                        : "border-neutral-300 dark:border-neutral-750 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={loading}
                      onChange={() => {
                        if (isChecked) {
                          setCourseClassroomIds(
                            courseClassroomIds.filter((id) => id !== c.id)
                          );
                        } else {
                          setCourseClassroomIds([...courseClassroomIds, c.id]);
                        }
                      }}
                      className="sr-only"
                    />
                    {c.name}
                  </label>
                );
              })}
              {classrooms.length === 0 && (
                <span className="text-xs text-neutral-450 italic">No classrooms available.</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                Select Course
              </label>
              <select
                required
                disabled={loading}
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              >
                <option value="">-- Choose Course --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                Due Date (Optional)
              </label>
              <input
                type="date"
                disabled={loading}
                value={courseDueDate}
                onChange={(e) => setCourseDueDate(e.target.value)}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-755 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="submit"
              disabled={loading || courseClassroomIds.length === 0 || !courseId}
              className="bg-neutral-905 hover:bg-neutral-800 text-white dark:bg-neutral-105 dark:hover:bg-neutral-200 dark:text-black px-4 py-2 rounded text-xs font-semibold transition disabled:opacity-50 cursor-pointer uppercase font-mono"
            >
              {loading ? "Assigning..." : "Assign Course"}
            </button>
          </div>
        </form>
      )}

      {status?.success && (
        <span className="text-xs font-mono text-green-650 bg-green-50 dark:bg-green-950/20 px-2 py-1 rounded">
          {mode === "exercise"
            ? "Success! Exercise assigned."
            : "Success! Course assigned."}
        </span>
      )}
      {status?.error && (
        <span className="text-xs font-mono text-red-650 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded">
          {status.error}
        </span>
      )}
    </div>
  );
}
