import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import fs from "fs";
import path from "path";

const EXERCISES_DIR = path.join(process.cwd(), "content", "exercises");
const ALLOWED_DOMAINS = [
  "pixabay.com",
  "cdn.pixabay.com",
];

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
      return new NextResponse("Invalid exercise ID", { status: 400 });
    }

    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return new NextResponse("Missing URL", { status: 400 });
    }

    // SSRF Prevention: Validate that URL points strictly to Pixabay CDN or domain
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new NextResponse("Invalid URL format", { status: 400 });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowedDomain = ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith("." + domain)
    );

    if (!isAllowedDomain) {
      return new NextResponse("Domain not allowed", { status: 400 });
    }

    // Prepare paths
    const assetsDir = path.join(EXERCISES_DIR, exerciseId, "assets");
    const resolvedAssetsDir = path.resolve(assetsDir);
    if (!resolvedAssetsDir.startsWith(path.resolve(EXERCISES_DIR) + path.sep)) {
      return new NextResponse("Path traversal protection error", { status: 400 });
    }

    // Fetch the image
    const imageRes = await fetch(url);
    if (!imageRes.ok) {
      return new NextResponse("Failed to download image", { status: 500 });
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());

    // Generate safe clean filename
    const originalExt = path.extname(parsedUrl.pathname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(originalExt)
      ? originalExt
      : ".jpg";
    
    // Use hash or timestamp for uniqueness
    const pixabayIdMatch = parsedUrl.pathname.match(/\/([0-9]+)\b/);
    const pixabayId = pixabayIdMatch ? pixabayIdMatch[1] : Date.now();
    const filename = `pixabay_${pixabayId}${safeExt}`;

    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const targetPath = path.join(assetsDir, filename);
    fs.writeFileSync(targetPath, buffer);

    return NextResponse.json({ success: true, filepath: filename });
  } catch (error) {
    console.error("Download URL route error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
