import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fairway Club",
    short_name: "Fairway",
    description: "Scores, clubnieuws, evenementen en klassementen.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5ef",
    theme_color: "#103f2c",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/maskable-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/monochrome-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "monochrome" }
    ]
  };
}
