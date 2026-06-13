import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/session";

const EXERCISES_DIR = path.join(process.cwd(), "content", "exercises");

const MIME_TYPES: Record<string, string> = {
  // Images
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
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

/** Filenames that are never served (blocked regardless of casing). */
const BLOCKED_FILE_NAMES = new Set(["index.json", "index.md"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exerciseId: string; path: string[] }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { exerciseId, path: pathParts } = await params;

    if (!exerciseId || !pathParts || pathParts.length === 0) {
      return new NextResponse("Invalid path parameters", { status: 400 });
    }

    // Prevent directory traversal: reject any path part containing ".."
    for (const part of pathParts) {
      if (part === ".." || part.includes("..") || part.includes("/") || part.includes("\\")) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const fileName = pathParts[pathParts.length - 1];

    // Security: Block access to exercise configuration files (case-insensitive match)
    const fileNameLower = fileName.toLowerCase();
    if (BLOCKED_FILE_NAMES.has(fileNameLower)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Resolve full path strictly inside the exercise's own directory.
    // Allow both files in exercise root (legacy) and in assets/ subfolder,
    // while preventing traversal/cross-exercise access.
    const exerciseDir = path.join(EXERCISES_DIR, exerciseId);
    const assetsDir = path.join(exerciseDir, "assets");

    // Verify exercise directory exists and is inside EXERCISES_DIR
    const resolvedExerciseDir = path.resolve(exerciseDir);
    if (!resolvedExerciseDir.startsWith(EXERCISES_DIR)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const resolvedExerciseDirWithSep = `${path.resolve(exerciseDir)}${path.sep}`;
    const resolvedFromAssets = path.resolve(assetsDir, ...pathParts);
    const resolvedFromExerciseRoot = path.resolve(exerciseDir, ...pathParts);

    const candidatePaths = [resolvedFromAssets, resolvedFromExerciseRoot];
    const resolvedFilePath = candidatePaths.find(
      (candidate) =>
        candidate.startsWith(resolvedExerciseDirWithSep) && fs.existsSync(candidate)
    );

    if (!resolvedFilePath) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Extra guard against edge cases where resolved path equals exercise dir
    if (!resolvedFilePath.startsWith(resolvedExerciseDirWithSep)) {
      return new NextResponse("Forbidden", { status: 403 });
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
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error serving exercise asset:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
