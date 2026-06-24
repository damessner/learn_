"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncClassroomRoster } from "@/lib/actions/classroom";

interface AutoRosterSyncProps {
  classroomId: string;
}

const SYNC_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes

export default function AutoRosterSync({ classroomId }: AutoRosterSyncProps) {
  const router = useRouter();

  useEffect(() => {
    const lastSyncKey = `last-sync-${classroomId}`;
    const lastSync = sessionStorage.getItem(lastSyncKey);
    const now = Date.now();

    if (!lastSync || now - parseInt(lastSync, 10) > SYNC_THROTTLE_MS) {
      // Perform silent background sync
      syncClassroomRoster(classroomId)
        .then((res) => {
          if (res.success) {
            // Update the last sync time in session storage
            sessionStorage.setItem(lastSyncKey, now.toString());

            // If new students were enrolled/linked, refresh the page to update the UI
            if (res.enrolledCount && res.enrolledCount > 0) {
              console.log(`Auto-synced roster: Enrolled ${res.enrolledCount} new student(s).`);
              router.refresh();
            }
          }
        })
        .catch((err) => {
          console.error("Auto roster sync failed:", err);
        });
    }
  }, [classroomId, router]);

  return null; // Silent utility component
}
