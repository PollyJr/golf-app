"use client";

import { ChartNoAxesColumn, Download, ExternalLink, Radio, ScanQrCode, Share, SquarePlus, X } from "lucide-react";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { useReveal } from "@/components/motion/reveal";
import { BrandMark } from "@/components/brand";
import { ScoreMark } from "@/components/golf/score-mark";
import { useFormat, useT } from "@/components/providers";
import { QrImage } from "@/components/qr/qr-image";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { ANDROID_APK_PATH, androidIntentUrl, type DevicePlatform } from "@/lib/native";

/**
 * How visitors of a live round get the app, depending on what they hold:
 * the Android app as a download, a home-screen shortcut on an iPhone, and a
 * QR code on a computer so they can follow along on their phone instead.
 * Inside the Android app none of this shows.
 */

interface AppOfferProps {
  platform: DevicePlatform;
  /** This page's own address, e.g. https://golf.example/live/abc. */
  pageUrl: string;
  /** For the desktop QR code: the page's path on this site. */
  pagePath: string;
  apkBytes: number | null;
  /** The visitor came back from "open in the app" without the app installed. */
  installHint?: boolean;
  className?: string;
}

// ----------------------------------------------------------- dismissal --

const DISMISS_KEY = "fairway:app-banner-dismissed";
const DISMISS_EVENT = "fairway:app-banner";

function readDismissed(): "shown" | "dismissed" {
  try {
    return window.localStorage.getItem(DISMISS_KEY) ? "dismissed" : "shown";
  } catch {
    return "shown";
  }
}

function subscribeDismissed(onChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `pending` while server-rendering and hydrating: the banner slides in only once we know. */
function useBannerState(): "pending" | "shown" | "dismissed" {
  return useSyncExternalStore(subscribeDismissed, readDismissed, () => "pending" as const);
}

function dismissBanner(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
  } catch {
    // Private mode: the banner simply comes back on the next visit.
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

function useSize(bytes: number | null): string | null {
  const { locale } = useFormat();
  return bytes === null ? null : `${formatNumber(bytes / 1_000_000, locale, 1)} MB`;
}

function installFallback(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.searchParams.set("install", "1");
  return url.toString();
}

// ------------------------------------------------------- smart banner --

/** A slim bar above the page on phones, in the spirit of an app store banner. */
export function SmartBanner({ platform, apkBytes, installHint }: Omit<AppOfferProps, "pageUrl" | "pagePath">) {
  const t = useT();
  const state = useBannerState();
  const size = useSize(apkBytes);
  const dismiss = useCallback(() => dismissBanner(), []);
  if ((platform !== "android" && platform !== "ios") || state !== "shown") return null;

  return (
    <div className="animate-slide-down border-b border-line bg-surface/95 backdrop-blur-md [animation-delay:400ms]" role="region" aria-label={t("pub.app.bannerTitle")}>
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5">
        <button type="button" onClick={dismiss} aria-label={t("pub.app.dismiss")} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink">
          <X className="size-4" />
        </button>
        <span className="relative grid size-11 shrink-0 place-items-center rounded-[0.85rem] bg-brand text-accent shadow-card">
          <BrandMark className="size-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{platform === "android" ? t("pub.app.bannerTitle") : t("pub.app.iosTitle")}</span>
          <span className="block truncate text-xs text-ink-3">
            {platform === "android" ? (installHint ? t("pub.app.notInstalled") : t("pub.app.bannerLead")) : `${t("pub.app.iosStepShare")} → ${t("pub.app.iosStepAdd")}`}
          </span>
        </span>
        {platform === "android" ? (
          <a
            href={ANDROID_APK_PATH}
            download
            className={buttonClass("accent", "sm", "animate-glow shrink-0 rounded-full px-4")}
            title={size ? t("pub.app.details", { size }) : undefined}
          >
            <Download className="size-4" />
            {t("pub.app.downloadShort")}
          </a>
        ) : (
          <Share className="size-5 shrink-0 text-info" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- promo --

/** The larger card further down the page; always there, also after the banner was hidden. */
export function AppPromo({ platform, pageUrl, pagePath, apkBytes, installHint, className }: AppOfferProps) {
  const t = useT();
  const size = useSize(apkBytes);
  const reveal = useReveal<HTMLElement>();
  if (platform === "app") return null;

  if (platform === "desktop") {
    return (
      <section ref={reveal} className={cn("overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card", className)}>
        <p className="font-label text-[10.5px] text-ink-3">{t("pub.app.promoEyebrow")}</p>
        <h2 className="font-display mt-1.5 text-xl">{t("pub.app.desktopTitle")}</h2>
        <p className="mt-2 text-sm text-pretty text-ink-2">{t("pub.app.desktopLead")}</p>
        <div className="relative mx-auto mt-5 w-fit">
          <span aria-hidden="true" className="animate-glow absolute -inset-1 rounded-[1.2rem] [--glow-color:var(--brand)]" />
          <QrImage path={pagePath} label={t("pub.app.qrLabel")} className="relative max-w-[11rem]" />
        </div>
        <a href={ANDROID_APK_PATH} download className={buttonClass("secondary", "md", "mt-5 w-full")}>
          <Download className="size-4" />
          {t("pub.app.desktopDownload")}
        </a>
        {size ? <p className="mt-2 text-center text-xs text-ink-3">{t("pub.app.details", { size })}</p> : null}
      </section>
    );
  }

  return (
    <section ref={reveal} className={cn("relative overflow-hidden rounded-card bg-brand p-5 text-brand-ink shadow-pop", className)}>
      <div aria-hidden="true" className="bg-ruled pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10.5px] text-accent">{t("pub.app.promoEyebrow")}</p>
          <h2 className="font-display mt-1.5 text-2xl">{platform === "ios" ? t("pub.app.iosTitle") : t("pub.app.promoTitle")}</h2>
        </div>
        <PhoneSketch />
      </div>

      {platform === "android" ? (
        <>
          <p className="relative mt-3 text-sm text-pretty opacity-85">{t("pub.app.promoLead")}</p>
          <ul className="stagger-children relative mt-4 flex flex-col gap-2 text-sm font-semibold">
            <Feature icon={<Radio className="size-4" />}>{t("pub.app.featureLive")}</Feature>
            <Feature icon={<ScanQrCode className="size-4" />}>{t("pub.app.featureQr")}</Feature>
            <Feature icon={<ChartNoAxesColumn className="size-4" />}>{t("pub.app.featureStats")}</Feature>
          </ul>
          {installHint ? (
            <p role="status" className="animate-slide-down relative mt-4 rounded-control bg-accent/15 px-3 py-2 text-sm font-semibold text-accent">
              {t("pub.app.notInstalled")}
            </p>
          ) : null}
          <a href={ANDROID_APK_PATH} download className={buttonClass("accent", "lg", "animate-glow relative mt-5 w-full")}>
            <Download className="size-5" />
            {t("pub.app.download")}
          </a>
          {size ? <p className="relative mt-2 text-center text-xs opacity-70">{t("pub.app.details", { size })}</p> : null}
          <a
            href={androidIntentUrl(pageUrl, installFallback(pageUrl))}
            className="relative mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-4" />
            {t("pub.app.openInApp")}
          </a>
        </>
      ) : (
        <>
          <ol className="stagger-children relative mt-4 flex flex-col gap-2.5 text-sm font-semibold">
            <Feature icon={<Share className="size-4" />}>{t("pub.app.iosStepShare")}</Feature>
            <Feature icon={<SquarePlus className="size-4" />}>{t("pub.app.iosStepAdd")}</Feature>
          </ol>
          <p className="relative mt-4 text-sm text-pretty opacity-85">{t("pub.app.iosLead")}</p>
        </>
      )}
    </section>
  );
}

function Feature({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">{icon}</span>
      {children}
    </li>
  );
}

/** A small drawn phone with a scorecard on it, gently floating. */
function PhoneSketch() {
  return (
    <span aria-hidden="true" className="animate-float relative block h-[5.6rem] w-[3.3rem] shrink-0 rounded-[0.9rem] border-2 border-brand-ink/70 bg-paper p-1.5 shadow-pop">
      <span className="mx-auto mb-1 block h-1 w-4 rounded-full bg-ink/20" />
      <span className="flex flex-col items-center gap-1">
        <ScoreMark strokes={2} par={3} size="sm" className="!size-[1.05rem] !text-[9px]" />
        <ScoreMark strokes={3} par={3} size="sm" className="!size-[1.05rem] !text-[9px]" />
        <ScoreMark strokes={4} par={3} size="sm" className="!size-[1.05rem] !text-[9px]" />
      </span>
    </span>
  );
}
