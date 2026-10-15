import type { MetadataRoute } from "next";

// Web app manifest: makes boardtivity.com installable (home screen on phones/tablets, app window on desktop).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Boardtivity",
    short_name: "Boardtivity",
    description: "The visual board for tasks, thoughts, and focus.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/logo-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
