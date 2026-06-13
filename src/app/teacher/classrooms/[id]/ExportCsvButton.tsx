"use client";

import React from "react";
import { Download } from "lucide-react";

interface ExportCsvButtonProps {
  students: {
    username: string;
    grades: Record<string, { score: number; points: number; maxPoints: number } | null>;
  }[];
  assignments: {
    id: string;
    title: string;
  }[];
  classroomName: string;
}

export default function ExportCsvButton({ students, assignments, classroomName }: ExportCsvButtonProps) {
  const handleExport = () => {
    // Generate headers
    const headers = ["Student Name"];
    assignments.forEach((a) => {
      headers.push(`"${a.title.replace(/"/g, '""')} Score (%)"`, `"${a.title.replace(/"/g, '""')} Points"`);
    });
    headers.push("Average Score (%)", "Total Points");

    // Generate rows
    const rows = students.map((s) => {
      const row = [`"${s.username.replace(/"/g, '""')}"`];
      let totalScoreSum = 0;
      let totalScoreCount = 0;
      let totalPoints = 0;

      assignments.forEach((a) => {
        const grade = s.grades[a.id];
        if (grade) {
          row.push(`${grade.score}`, `"${grade.points}/${grade.maxPoints}"`);
          totalScoreSum += grade.score;
          totalScoreCount++;
          totalPoints += grade.points;
        } else {
          row.push("—", "0");
        }
      });

      const avgScore = totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount) : 0;
      row.push(`${avgScore}`, `${totalPoints}`);
      return row.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${classroomName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider font-mono border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1.5 rounded transition text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </button>
  );
}
