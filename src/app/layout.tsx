import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { ServiceWorker } from "@/components/service-worker";
import { clubThemeStyle, isThemeChoice, THEME_COOKIE } from "@/lib/theme";
import { getSession } from "@/server/auth/session";
import { getLocale } from "@/server/i18n";

export const metadata: Metadata = {
  title: { default: "Fairway", template: "%s · Fairway" },
  description: "De clubapp voor golf en shortgolf: live scorekaart, klassementen, events en clubnieuws.",
  applicationName: "Fairway",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Fairway" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0e6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1410" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, session, cookieStore] = await Promise.all([getLocale(), getSession(), cookies()]);
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isThemeChoice(themeCookie) && themeCookie !== "system" ? themeCookie : undefined;

  return (
    <html lang={locale} data-theme={theme} style={clubThemeStyle(session?.club)} suppressHydrationWarning>
      <body>
        <AppProviders locale={locale} timeZone={session?.club?.timeZone}>
          {children}
        </AppProviders>
        <ServiceWorker />
      </body>
    </html>
  );
}
