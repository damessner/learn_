import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Mono } from "next/font/google";
import "./globals.css";
import { PWARegistration } from "@/components/PWARegistration";
import fs from "fs";
import path from "path";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-space-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7c3aed", // purple-600 PWA brand color
};

export const metadata: Metadata = {
  title: "LEARN_PLATFORM",
  description: "A self-hosted, lightweight learning engine with interactive quizzes, multiple choice, categorization, fill-in-the-gaps, and media hotspot games.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LEARN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let version = "0.2.0";
  let lastUpdated = "2026-06-22 19:25";
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: string; lastUpdated?: string };
    if (parsed.version) version = parsed.version;
    if (parsed.lastUpdated) lastUpdated = parsed.lastUpdated;
  } catch {
    // fallback
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col justify-between">
        <div className="flex-1 flex flex-col">
          <PWARegistration />
          {children}
        </div>
        <footer className="py-4 border-t border-neutral-200 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-950/20 text-center text-[10px] font-mono text-neutral-400">
          version {version} &middot; last updated {lastUpdated}
        </footer>
      </body>
    </html>
  );
}
