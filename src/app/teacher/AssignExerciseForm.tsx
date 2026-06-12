"use client";

import React, { useState } from "react";
import { assignExercise, assignCourse } from "@/app/actions";
import { Calendar } from "lucide-react";

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
  const [classroomId, setClassroomId] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Course assignment state
  const [courseClassroomId, setCourseClassroomId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseDueDate, setCourseDueDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    success?: boolean;
    error?: string;
  } | null>(null);

  const handleExerciseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classroomId || !exerciseId) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await assignExercise(
        classroomId,
        exerciseId,
        dueDate || undefined
      );
      if (res?.error) {
        setStatus({ error: res.error });
      } else {
        setStatus({ success: true });
        setExerciseId("");
        setDueDate("");
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err) {
      setStatus({ error: "Failed to create assignment." });
    } finally {
      setLoading(false);
    }
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseClassroomId || !courseId) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await assignCourse(
        courseClassroomId,
        courseId,
        courseDueDate || undefined
      );
      if (res?.error) {
        setStatus({ error: res.error });
      } else {
        setStatus({ success: true });
        setCourseId("");
        setCourseDueDate("");
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err) {
      setStatus({ error: "Failed to assign course." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Assign to a Classroom
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Select Class
              </label>
              <select
                required
                disabled={loading}
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              >
                <option value="">-- Choose Class --</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
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
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
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
              disabled={loading || !classroomId || !exerciseId}
              className="bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 cursor-pointer uppercase font-mono"
            >
              {loading ? "Assigning..." : "Assign Exercise"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCourseSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Select Class
              </label>
              <select
                required
                disabled={loading}
                value={courseClassroomId}
                onChange={(e) => setCourseClassroomId(e.target.value)}
                className="w-full text-sm border border-neutral-300 dark:border-neutral-750 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
              >
                <option value="">-- Choose Class --</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
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
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
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
              disabled={loading || !courseClassroomId || !courseId}
              className="bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 cursor-pointer uppercase font-mono"
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
