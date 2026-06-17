import { NextResponse } from "next/server";

// Returns the running app version. The service worker uses this to derive
// a per-version cache name, so a new deploy automatically invalidates
// the old service-worker cache without a manual bump.
export async function GET() {
  // We don't import package.json at build time because Next.js's bundler
  // would inline the value (which would defeat the point — we want a
  // runtime read so a fresh deploy reflects immediately).
  try {
    const fs = await import("fs");
    const path = await import("path");
    const pkgPath = path.join(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: string; name?: string };
    return NextResponse.json({
      version: parsed.version ?? "0.0.0",
      name: parsed.name ?? "learn",
    });
  } catch {
    return NextResponse.json({ version: "0.0.0", name: "learn" });
  }
}
