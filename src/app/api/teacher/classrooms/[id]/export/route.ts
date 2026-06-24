import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exportClassroomJson } from "@/lib/actions/exporter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return new NextResponse("Invalid classroom ID", { status: 400 });
    }

    const jsonString = await exportClassroomJson(id);

    return new Response(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="classroom-${id}.json"`,
      },
    });
  } catch (error: unknown) {
    console.error("Export classroom error:", error);
    const message = error instanceof Error ? error.message : "Failed to export classroom";
    return new NextResponse(message, { status: 500 });
  }
}
