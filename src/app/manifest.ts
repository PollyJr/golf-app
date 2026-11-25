import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fairway",
    short_name: "Fairway",
    description: "Live scorekaart, klassementen, events en clubnieuws van je golfclub.",
    id: "/",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f0e6",
    theme_color: "#0f3b2a",
    lang: "nl",
    categories: ["sports", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Start een ronde", short_name: "Spelen", url: "/app/play" },
      { name: "Klassement", short_name: "Klassement", url: "/app/leaderboards" },
    ],
  };
}
