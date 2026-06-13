import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import fs from "fs";
import path from "path";
import { randomUUID } from "@/lib/uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "submissions");

// Restrictive allowlist for submission uploads
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".mp3", ".wav", ".ogg", ".m4a",
  ".mp4", ".webm",
  ".pdf", ".doc", ".docx",
  ".txt", ".csv",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new NextResponse("No file uploaded", { status: 400 });
    }

    // Determine and validate extension
    let ext = path.extname(file.name).toLowerCase();
    if (!ext) {
      // Fallback when no extension is present
      if (file.type.startsWith("image/")) ext = ".png";
      else if (file.type.startsWith("audio/")) ext = ".wav";
      else return new NextResponse("File type not allowed", { status: 400 });
    }
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return new NextResponse("File type not allowed", { status: 400 });
    }

    // Ensure directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Correct 20MB limit
    if (buffer.length > MAX_FILE_SIZE) {
      return new NextResponse("File exceeds the maximum size limit", { status: 400 });
    }

    // Use randomUUID for secure unique filename (replaces Math.random)
    const uniqueName = `sub-${randomUUID()}${ext}`;

    fs.writeFileSync(path.join(UPLOAD_DIR, uniqueName), buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/submissions/${uniqueName}`,
    });
  } catch (error) {
    console.error("Submission upload error:", error);
    return new NextResponse("Upload failed", { status: 500 });
  }
}
