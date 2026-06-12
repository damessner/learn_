import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const EXERCISES_DIR = path.join(process.cwd(), "content", "exercises");

const MIME_TYPES: Record<string, string> = {
  // Images
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  // Video
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exerciseId: string; path: string[] }> }
) {
  try {
    const { exerciseId, path: pathParts } = await params;

    if (!exerciseId || !pathParts || pathParts.length === 0) {
      return new NextResponse("Invalid path parameters", { status: 400 });
    }

    const fileName = pathParts[pathParts.length - 1];

    // Security: Block access to exercise configuration files
    if (fileName === "index.json" || fileName === "index.md") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Resolve full path and check directory traversal
    // uploadMedia stores files in an "assets/" subfolder, but some older
    // exercises have assets directly in the exercise root. Try both.
    const exerciseDir = path.join(EXERCISES_DIR, exerciseId);
    const assetsDir = path.join(exerciseDir, "assets");
    let resolvedFilePath = path.resolve(assetsDir, ...pathParts);

    // Fallback: try exercise root if not found in assets/ subfolder
    if (!fs.existsSync(resolvedFilePath)) {
      resolvedFilePath = path.resolve(exerciseDir, ...pathParts);
    }

    if (!resolvedFilePath.startsWith(EXERCISES_DIR)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!fs.existsSync(resolvedFilePath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    const stat = fs.statSync(resolvedFilePath);
    if (!stat.isFile()) {
      return new NextResponse("Not a file", { status: 400 });
    }

    // Determine content type
    const ext = path.extname(resolvedFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const fileBuffer = fs.readFileSync(resolvedFilePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving exercise asset:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
