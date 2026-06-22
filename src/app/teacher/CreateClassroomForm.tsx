"use client";

import React, { useState, useEffect } from "react";
import { createClassroom, fetchTeacherTeams } from "@/lib/actions/classroom";
import { Plus } from "lucide-react";

export default function CreateClassroomForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState("");
  const [teams, setTeams] = useState<{ id: string; displayName: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const res = await fetchTeacherTeams();
        if (res.teams) {
          setTeams(res.teams);
        }
      } catch {
        // Fail silently if Microsoft is not linked
      }
    };
    loadTeams();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await createClassroom(name, selectedTeamId || undefined);
      if (res?.error) {
        setError(res.error);
      } else {
        setName("");
        setSelectedTeamId("");
        onSuccess?.();
      }
    } catch {
      setError("Failed to create classroom.");
    } finally {
      setLoading(false);
    }
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    if (teamId) {
      const selected = teams.find((t) => t.id === teamId);
      if (selected && !name.trim()) {
        setName(selected.displayName);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Create a Classroom
      </h3>

      {teams.length > 0 && (
        <div className="space-y-1.5">
          <label
            htmlFor="teams-select"
            className="text-[9px] font-bold font-mono uppercase tracking-widest text-neutral-500 block"
          >
            Link with Microsoft Teams Class (Optional)
          </label>
          <select
            id="teams-select"
            disabled={loading}
            value={selectedTeamId}
            onChange={(e) => handleTeamChange(e.target.value)}
            className="w-full text-xs font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded px-3 py-2 outline-none focus:border-black dark:focus:border-white transition"
          >
            <option value="">-- Do not link to a Teams class --</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          required
          disabled={loading}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Classroom Name (e.g. Grade 4 English)"
          className="flex-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 bg-transparent outline-none focus:border-black dark:focus:border-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1 bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 rounded text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 cursor-pointer shrink-0 uppercase font-mono"
        >
          <Plus className="w-3.5 h-3.5" />
          Create
        </button>
      </div>
      {error && <p className="text-xs text-red-650 dark:text-red-400">{error}</p>}
    </form>
  );
}
