import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncExercisesToDb } from "@/lib/exercises";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await syncExercisesToDb();
    return NextResponse.json({
      success: true,
      synced: result.syncedCount,
      deleted: result.deletedCount,
    });
  } catch (error) {
    console.error("Failed to sync exercises:", error);
    return NextResponse.json(
      { success: false, error: "Failed to sync exercises" },
      { status: 500 }
    );
  }
}
