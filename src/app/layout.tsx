import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Mono } from "next/font/google";
import "./globals.css";
import { PWARegistration } from "@/components/PWARegistration";

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
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}
