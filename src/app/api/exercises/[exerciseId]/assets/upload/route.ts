import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import fs from "fs";
import path from "path";

const EXERCISES_DIR = path.join(process.cwd(), "content", "exercises");

// Restrictive allowlist — no SVG, no HTML, no executable types
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".mp3", ".wav", ".ogg", ".m4a",
  ".mp4", ".mkv", ".webm",
  ".pdf",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (corrected)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { exerciseId } = await params;
    if (!exerciseId || typeof exerciseId !== "string" || exerciseId.length > 128) {
      return new NextResponse("Invalid request", { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new NextResponse("No file uploaded", { status: 400 });
    }

    // Validate extension
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return new NextResponse("File type not allowed", { status: 400 });
    }

    const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const assetsDir = path.join(EXERCISES_DIR, exerciseId, "assets");

    // Verify assetsDir is within EXERCISES_DIR (safety check)
    const resolvedAssetsDir = path.resolve(assetsDir);
    if (!resolvedAssetsDir.startsWith(path.resolve(EXERCISES_DIR) + path.sep)) {
      return new NextResponse("Invalid exercise ID", { status: 400 });
    }

    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Correct size check: 10 * 1024 * 1024 = 10MB
    if (buffer.length > MAX_FILE_SIZE) {
      return new NextResponse("File exceeds the maximum size limit", { status: 400 });
    }

    fs.writeFileSync(path.join(assetsDir, cleanFilename), buffer);

    return NextResponse.json({ success: true, filepath: cleanFilename });
  } catch (error) {
    console.error("Upload route error:", error);
    return new NextResponse("Upload failed", { status: 500 });
  }
}
