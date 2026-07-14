import type { Metadata, Viewport } from "next";
import { Manrope, DM_Sans } from "next/font/google";
import "./globals.css";

const display = Manrope({ subsets: ["latin"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "Fairway Club", template: "%s · Fairway Club" },
  description: "Your golf club, in your pocket.",
  applicationName: "Fairway Club",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Fairway" },
};

export const viewport: Viewport = {
  themeColor: "#103f2c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
