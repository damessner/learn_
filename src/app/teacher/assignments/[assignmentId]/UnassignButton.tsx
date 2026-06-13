"use client";

import React, { useState } from "react";
import { unassignAssignment } from "@/lib/actions/assignment";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface UnassignButtonProps {
  assignmentId: string;
  className?: string;
}

export default function UnassignButton({ assignmentId, className }: UnassignButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnassign = async () => {
    if (!confirm("Are you sure you want to unassign this exercise from the classroom? All student submissions for this assignment in this class will be permanently deleted.")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await unassignAssignment(assignmentId);
      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/teacher");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleUnassign}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-mono uppercase font-semibold transition shadow-sm disabled:opacity-50 ${className || ""}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        {loading ? "Unassigning..." : "Unassign Exercise"}
      </button>
      {error && <span className="text-[10px] text-red-500 font-mono">{error}</span>}
    </div>
  );
}
