import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exportCourseZip } from "@/lib/actions/exporter";

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
      return new NextResponse("Invalid course ID", { status: 400 });
    }

    const zipBuffer = await exportCourseZip(id);

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="course-${id}.zip"`,
      },
    });
  } catch (error: unknown) {
    console.error("Export course error:", error);
    const message = error instanceof Error ? error.message : "Failed to export course";
    return new NextResponse(message, { status: 500 });
  }
}
