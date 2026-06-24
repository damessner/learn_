import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { importCourseZip } from "@/lib/actions/exporter";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new NextResponse("No file uploaded", { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const newCourseId = await importCourseZip(buffer, session.userId);

    return NextResponse.json({ success: true, id: newCourseId });
  } catch (error: unknown) {
    console.error("Import course error:", error);
    const message = error instanceof Error ? error.message : "Failed to import course";
    return new NextResponse(message, { status: 500 });
  }
}
