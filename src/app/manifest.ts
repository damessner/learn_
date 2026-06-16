import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LEARN Platform",
    short_name: "LEARN",
    description: "Interactive self-hosted learning engine with offline capabilities.",
    start_url: "/",
    display: "standalone",
    background_color: "#171717", // Match dark mode neutral-900
    theme_color: "#7c3aed",      // Purple-600 theme color
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable" as unknown as "any" | "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable" as unknown as "any" | "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
