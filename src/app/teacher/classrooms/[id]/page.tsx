import React from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getExerciseFromDisk } from "@/lib/exercises";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { ArrowLeft, Award, FileSpreadsheet, ChevronRight } from "lucide-react";
import ExportCsvButton from "./ExportCsvButton";
import BulkImportForm from "./BulkImportForm";
import AddStudentForm from "./AddStudentForm";
import ResetPasswordButton from "./ResetPasswordButton";
import { getExerciseMaxPoints } from "@/lib/points";
import ClassroomDiagnosticCard from "./ClassroomDiagnosticCard";
import AutoRosterSync from "./AutoRosterSync";

export default async function ClassroomRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    redirect("/login");
  }

  const { id: classroomId } = await params;

  // Fetch classroom data including enrolled students, assignments, and submissions
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: {
      students: {
        include: {
          student: true,
        },
        orderBy: {
          student: {
            username: "asc"
          }
        }
      },
      assignments: {
        include: {
          exercise: true,
          submissions: {
            orderBy: {
              completedAt: "desc"
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!classroom) {
    notFound();
  }

  // Authorisation check: must be teacher of the classroom
  if (classroom.teacherId !== session.userId) {
    return (
      <>
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold font-mono text-red-650 uppercase">Access Denied</h2>
          <p className="text-sm text-neutral-500">
            You do not own this classroom.
          </p>
        </main>
      </>
    );
  }

  // Pre-calculate max points for each assignment's exercise to avoid repetitive disk calls
  const assignmentMaxPoints: Record<string, number> = {};
  classroom.assignments.forEach((assignment) => {
    const exercise = getExerciseFromDisk(assignment.exerciseId);
    assignmentMaxPoints[assignment.id] = exercise ? getExerciseMaxPoints(exercise) : 1;
  });

  // Build the student roster data structure
  const rosterStudents = classroom.students.map((cs) => {
    const grades: Record<string, { score: number; points: number; maxPoints: number; submissionId: string } | null> = {};

    classroom.assignments.forEach((assignment) => {
      // Get all submissions for this pupil and assignment
      const studentSubs = assignment.submissions.filter((s) => s.studentId === cs.studentId);
      
      if (studentSubs.length > 0) {
        // Find best attempt
        const bestSub = studentSubs.reduce((best, s) => {
          const sVal = s.teacherScore !== null ? s.teacherScore : s.effectiveScore;
          const bestVal = best.teacherScore !== null ? best.teacherScore : best.effectiveScore;
          return sVal > bestVal ? s : best;
        }, studentSubs[0]);

        // Latest submission is useful for the link destination
        const latestSub = studentSubs[0];

        const maxPts = assignmentMaxPoints[assignment.id];
        const effectiveScoreVal = bestSub.teacherScore !== null ? bestSub.teacherScore : bestSub.effectiveScore;
        const pts = Math.round((effectiveScoreVal / 100) * maxPts);

        grades[assignment.id] = {
          score: Math.round(effectiveScoreVal),
          points: pts,
          maxPoints: maxPts,
          submissionId: latestSub.id,
        };
      } else {
        grades[assignment.id] = null;
      }
    });

    // Count of assignments by category score:
    let passedCount = 0;      // >= 75
    let developingCount = 0;  // 50-74
    let strugglingCount = 0;  // < 50
    let incompleteCount = 0;  // null

    const categoryStats: Record<string, { sum: number; count: number }> = {};

    classroom.assignments.forEach((assignment) => {
      const grade = grades[assignment.id];
      if (grade) {
        if (grade.score >= 75) passedCount++;
        else if (grade.score >= 50) developingCount++;
        else strugglingCount++;

        const exType = assignment.exercise.type || "worksheet";
        if (!categoryStats[exType]) categoryStats[exType] = { sum: 0, count: 0 };
        categoryStats[exType].sum += grade.score;
        categoryStats[exType].count++;
      } else {
        incompleteCount++;
      }
    });

    // Identify struggles: any category average < 75%
    const struggles: string[] = [];
    Object.entries(categoryStats).forEach(([cat, stats]) => {
      const avg = stats.sum / stats.count;
      if (avg < 75) {
        let label = "Grammar";
        if (cat === "vocabulary") label = "Vocabulary";
        else if (cat === "writing-coach") label = "Writing Coach";
        else if (cat === "interactive-reading") label = "Reading Comprehension";
        struggles.push(label);
      }
    });

    // Pick suggestions
    let suggestion = "";
    if (classroom.assignments.length === 0) {
      suggestion = "Create and assign worksheets to start tracking insights.";
    } else if (passedCount + developingCount + strugglingCount === 0) {
      suggestion = "No assignments completed. Encourage student to submit starter tasks.";
    } else if (struggles.length > 0) {
      const primary = struggles[0];
      if (primary === "Vocabulary") {
        suggestion = "Conduct 5 minutes of spelling or vocabulary flashcard review.";
      } else if (primary === "Writing Coach") {
        suggestion = "Provide scaffolded sentence prompts and direct peer review.";
      } else if (primary === "Reading Comprehension") {
        suggestion = "Recommend branching choice-adventures to build comprehension context.";
      } else {
        suggestion = "Assign targeted gap-fills or offer 1-on-1 grammar review.";
      }
    } else {
      suggestion = "Excellent progress! Challenge with writing coach or advanced reading.";
    }

    const totalAssCount = classroom.assignments.length || 1;
    const passedPct = (passedCount / totalAssCount) * 100;
    const developingPct = (developingCount / totalAssCount) * 100;
    const strugglingPct = (strugglingCount / totalAssCount) * 100;
    const incompletePct = (incompleteCount / totalAssCount) * 100;

    return {
      id: cs.studentId,
      username: cs.student.username,
      grades,
      stats: {
        passedPct,
        developingPct,
        strugglingPct,
        incompletePct,
        struggles,
        suggestion,
      }
    };
  });

  // Calculate statistics
  const totalStudents = classroom.students.length;
  const totalAssignments = classroom.assignments.length;
  
  // Calculate average score per student
  let classAverageSum = 0;
  let classAverageCount = 0;
  rosterStudents.forEach((s) => {
    let studentScoreSum = 0;
    let studentScoreCount = 0;
    classroom.assignments.forEach((a) => {
      const grade = s.grades[a.id];
      if (grade) {
        studentScoreSum += grade.score;
        studentScoreCount++;
      }
    });
    if (studentScoreCount > 0) {
      classAverageSum += studentScoreSum / studentScoreCount;
      classAverageCount++;
    }
  });
  const overallClassAverage = classAverageCount > 0 ? Math.round(classAverageSum / classAverageCount) : null;

  // Calculate difficulty averages per assignment
  const assignmentDifficulty = classroom.assignments.map((assignment) => {
    // Find all student grades for this assignment
    const gradesForAssignment = rosterStudents
      .map((s) => s.grades[assignment.id])
      .filter((g): g is NonNullable<typeof g> => g !== null);

    const scores = gradesForAssignment.map((g) => g.score);
    const average = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return {
      id: assignment.id,
      title: assignment.exercise.title,
      average,
      submissionsCount: scores.length,
    };
  }).sort((a, b) => {
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return a.average - b.average; // Lowest score (hardest) first
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between border-b pb-4">
          <Link
            href="/teacher"
            className="flex items-center gap-1 text-xs font-semibold uppercase font-mono text-neutral-500 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-750">
            Classroom Gradebook
          </span>
        </div>

        {/* Classroom Header Cards */}
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 p-6 border border-neutral-350 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-450 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                Join Code: {classroom.joinCode}
              </span>
              <h1 className="text-2xl font-black font-mono uppercase tracking-tight text-neutral-900 dark:text-neutral-100 mt-2">
                Classroom Roster: {classroom.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-neutral-50 dark:bg-neutral-950/45 p-6 rounded border border-neutral-300 dark:border-neutral-800 self-start md:self-center shrink-0 w-full md:w-auto">
            <div className="px-4 text-center border-r border-neutral-200 dark:border-neutral-800">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider font-mono">
                Pupils
              </span>
              <span className="text-2xl font-black font-mono text-neutral-900 dark:text-neutral-100">
                {totalStudents}
              </span>
            </div>
            <div className="px-4 text-center border-r border-neutral-200 dark:border-neutral-800">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider font-mono">
                Worksheets
              </span>
              <span className="text-2xl font-black font-mono text-neutral-900 dark:text-neutral-100">
                {totalAssignments}
              </span>
            </div>
            <div className="px-4 text-center">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block tracking-wider font-mono">
                Class Average
              </span>
              <span className="text-2xl font-black font-mono text-neutral-900 dark:text-neutral-100">
                {overallClassAverage !== null ? `${overallClassAverage}%` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Bulk Import & Analytics Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <AddStudentForm classroomId={classroomId} />
            <BulkImportForm classroomId={classroomId} />
          </div>

          <div className="border border-neutral-300 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900/30 p-5 space-y-4">
            <h3 className="font-bold font-mono text-sm uppercase tracking-wide flex items-center gap-2 text-neutral-800 dark:text-neutral-250">
              <Award className="w-4 h-4 text-neutral-500" />
              Worksheet Difficulty Analysis
            </h3>
            {assignmentDifficulty.length === 0 ? (
              <p className="text-xs text-neutral-450 italic">No assigned exercises to analyze.</p>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2">
                {assignmentDifficulty.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs border-b border-neutral-200 dark:border-neutral-800 pb-1.5 font-mono">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[240px]" title={item.title}>
                      {item.title}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-450 text-[10px]">{item.submissionsCount} sub(s)</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        item.average === null
                          ? "bg-neutral-100 dark:bg-neutral-850 text-neutral-400"
                          : item.average >= 80
                          ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                          : item.average < 50
                          ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                      }`}>
                        {item.average !== null ? `${item.average}% avg` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Diagnostics & Pupil Insights */}
        {totalStudents > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left/Middle: Pupil Insights List */}
            <div className="lg:col-span-2 border border-neutral-350 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-850 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/20">
                <div>
                  <h3 className="font-bold text-sm font-mono uppercase tracking-wide text-neutral-900 dark:text-neutral-100">
                    Pupil Struggles & Progress
                  </h3>
                  <p className="text-[10px] text-neutral-550 font-medium">
                    Concise student learning stats, struggle categories, and action plans
                  </p>
                </div>
              </div>

              <div className="p-5 divide-y divide-neutral-200 dark:divide-neutral-850 max-h-[480px] overflow-y-auto pr-2 space-y-4">
                {rosterStudents.map((s) => (
                  <div key={s.id} className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Pupil details */}
                    <div className="space-y-1 min-w-0 md:w-1/4 shrink-0">
                      <Link
                        href={`/teacher/classrooms/${classroomId}/students/${s.id}`}
                        className="font-bold text-xs font-mono uppercase text-neutral-900 dark:text-neutral-100 hover:text-indigo-650 dark:hover:text-indigo-400 hover:underline block truncate"
                      >
                        {s.username}
                      </Link>
                      <div className="flex items-center gap-1.5">
                        {s.stats.struggles.length > 0 ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-red-650 dark:text-red-400 bg-red-500/5 px-1.5 py-0.5 rounded">
                            Struggling
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-green-700 dark:text-green-400 bg-green-500/5 px-1.5 py-0.5 rounded">
                            On Track
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (Minimalistic Segmented Bar) */}
                    <div className="flex-1 md:px-4">
                      <div className="flex items-center justify-between text-[9px] font-mono font-bold text-neutral-450 uppercase mb-1">
                        <span>Accuracy Matrix</span>
                        <span>
                          {Math.round(s.stats.passedPct)}% Pass
                        </span>
                      </div>
                      <div className="w-full flex h-2 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-850">
                        {s.stats.passedPct > 0 && (
                          <div
                            style={{ width: `${s.stats.passedPct}%` }}
                            className="bg-green-500 h-full"
                            title={`Passed (>=75%): ${Math.round(s.stats.passedPct)}%`}
                          />
                        )}
                        {s.stats.developingPct > 0 && (
                          <div
                            style={{ width: `${s.stats.developingPct}%` }}
                            className="bg-amber-400 h-full"
                            title={`Developing (50-74%): ${Math.round(s.stats.developingPct)}%`}
                          />
                        )}
                        {s.stats.strugglingPct > 0 && (
                          <div
                            style={{ width: `${s.stats.strugglingPct}%` }}
                            className="bg-red-500 h-full"
                            title={`Struggling (<50%): ${Math.round(s.stats.strugglingPct)}%`}
                          />
                        )}
                        {s.stats.incompletePct > 0 && (
                          <div
                            style={{ width: `${s.stats.incompletePct}%` }}
                            className="bg-neutral-300 dark:bg-neutral-700 h-full"
                            title={`Incomplete: ${Math.round(s.stats.incompletePct)}%`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Struggles & Suggestions */}
                    <div className="md:w-5/12 text-xs space-y-1">
                      {s.stats.struggles.length > 0 ? (
                        <p className="text-[10px] text-neutral-650 dark:text-neutral-400">
                          <strong className="text-red-650 dark:text-red-400">Struggles:</strong>{" "}
                          {s.stats.struggles.join(", ")}
                        </p>
                      ) : (
                        <p className="text-[10px] text-green-700 dark:text-green-400 font-semibold">
                          Excellent Mastery
                        </p>
                      )}
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-500 leading-relaxed font-mono">
                        <strong className="text-neutral-600 dark:text-neutral-400 uppercase tracking-wider text-[8px]">Suggestion:</strong>{" "}
                        {s.stats.suggestion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: AI Classroom Diagnostic Assistant */}
            <div className="lg:col-span-1">
              <ClassroomDiagnosticCard
                classroomId={classroom.id}
                initialDiagnostic={classroom.aiDiagnostic}
                initialDiagnosticDate={classroom.aiDiagnosticDate}
              />
            </div>
          </div>
        )}

        {/* Gradebook Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-mono uppercase tracking-wide flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-neutral-500" />
              Grade Matrix
            </h2>
            {totalStudents > 0 && totalAssignments > 0 && (
              <ExportCsvButton
                students={rosterStudents}
                assignments={classroom.assignments.map((a) => ({ id: a.id, title: a.exercise.title }))}
                classroomName={classroom.name}
              />
            )}
          </div>

          {totalStudents === 0 ? (
            <div className="text-center py-16 border border-dashed border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 text-neutral-500 font-mono text-sm">
              No students have joined this classroom yet.
            </div>
          ) : totalAssignments === 0 ? (
            <div className="text-center py-16 border border-dashed border-neutral-300 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 text-neutral-500 font-mono text-sm">
              No assignments created for this classroom.
            </div>
          ) : (
            <div className="border border-neutral-300 dark:border-neutral-800 rounded overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs font-mono uppercase bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-300 dark:border-neutral-850 text-neutral-550">
                    <tr>
                      <th className="sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-950 px-6 py-4 font-bold border-r border-neutral-300 dark:border-neutral-850 min-w-[200px]">
                        Pupil Name
                      </th>
                      {classroom.assignments.map((assignment) => (
                        <th
                          key={assignment.id}
                          className="px-6 py-4 font-bold text-center border-r border-neutral-300 dark:border-neutral-850 min-w-[160px] max-w-[220px]"
                        >
                          <div className="truncate font-mono" title={assignment.exercise.title}>
                            {assignment.exercise.title}
                          </div>
                          <div className="text-[9px] text-neutral-450 mt-1 font-semibold uppercase">
                            Max: {assignmentMaxPoints[assignment.id]} pts
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-4 font-bold text-center min-w-[120px]">
                        Student Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-855">
                    {rosterStudents.map((s) => {
                      let studentSum = 0;
                      let studentCount = 0;
                      
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20"
                        >
                          <td className="sticky left-0 z-10 bg-white dark:bg-neutral-900 px-6 py-4 border-r border-neutral-300 dark:border-neutral-850">
                            <div className="flex flex-col gap-2">
                              <Link
                                href={`/teacher/classrooms/${classroomId}/students/${s.id}`}
                                className="truncate font-semibold text-neutral-900 dark:text-neutral-100 hover:text-black dark:hover:text-white hover:underline flex items-center gap-0.5"
                              >
                                {s.username}
                                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              </Link>
                              <ResetPasswordButton studentId={s.id} studentName={s.username} />
                            </div>
                          </td>
                          {classroom.assignments.map((assignment) => {
                            const grade = s.grades[assignment.id];
                            if (grade) {
                              studentSum += grade.score;
                              studentCount++;
                            }

                            return (
                              <td
                                key={assignment.id}
                                className="px-6 py-4 border-r border-neutral-250 dark:border-neutral-850 text-center font-mono"
                              >
                                {grade ? (
                                  <Link
                                    href={`/submissions/${grade.submissionId}`}
                                    className="group inline-flex flex-col items-center justify-center p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition min-w-[80px]"
                                  >
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                                        grade.score >= 80
                                          ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                          : grade.score < 50
                                          ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                                          : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                                      }`}
                                    >
                                      {grade.score}%
                                    </span>
                                    <span className="text-[10px] text-neutral-450 mt-1 font-semibold group-hover:text-black dark:group-hover:text-white transition flex items-center gap-0.5">
                                      {grade.points} / {grade.maxPoints} pts
                                      <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition" />
                                    </span>
                                  </Link>
                                ) : (
                                  <span className="text-neutral-400 font-sans italic">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-center font-mono font-bold text-neutral-800 dark:text-neutral-200">
                            {studentCount > 0 ? (
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  studentSum / studentCount >= 80
                                    ? "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400"
                                    : studentSum / studentCount < 50
                                    ? "bg-red-105 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                                    : "bg-amber-100 dark:bg-amber-955/20 text-amber-800 dark:text-amber-400"
                                }`}
                              >
                                {Math.round(studentSum / studentCount)}%
                              </span>
                            ) : (
                              <span className="text-neutral-400 italic font-sans font-normal">—</span>
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
          {classroom.msGraphClassId && (
            <AutoRosterSync classroomId={classroomId} />
          )}
        </div>
      </main>
    </>
  );
}
