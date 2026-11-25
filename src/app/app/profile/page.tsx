import { ChartNoAxesColumn, ChevronRight, ClipboardList, Download, Smartphone, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { EmailForm } from "@/components/app/email-form";
import { MyQrCard } from "@/components/app/my-qr-card";
import { UsernameForm } from "@/components/app/username-form";
import { PinForm } from "@/components/auth/pin-form";
import { LanguageSwitch, SignOutButton, ThemeSwitch } from "@/components/preferences";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Card, Eyebrow, SectionHeading } from "@/components/ui/card";
import { formatClubIndex } from "@/lib/golf/club-index";
import { ANDROID_APK_PATH, isAndroidApp } from "@/lib/native";
import { isThemeChoice, THEME_COOKIE } from "@/lib/theme";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getOwnAccount, getPlayerSummary } from "@/server/services/players";

export const metadata: Metadata = { title: "Profiel" };

export default async function ProfilePage() {
  const session = await requirePlayer();
  const { t, locale } = await getT();
  const [summary, cookieStore, account, requestHeaders] = await Promise.all([
    getPlayerSummary(session.clubId, session.accountId),
    cookies(),
    getOwnAccount(session),
    headers(),
  ]);
  const inApp = isAndroidApp(requestHeaders.get("user-agent"));
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const links = [
    { href: "/app/stats", label: t("common.nav.stats"), icon: ChartNoAxesColumn },
    { href: "/app/results", label: t("common.nav.results"), icon: ClipboardList },
    { href: "/app/leaderboards", label: t("common.nav.leaderboards"), icon: Trophy },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex items-center gap-5">
        <Avatar name={session.user.displayName} initials={session.user.initials} size="xl" />
        <div className="min-w-0 flex-1">
          <Eyebrow>{t("app.profile.eyebrow")}</Eyebrow>
          <h1 className="font-display mt-1.5 text-[clamp(1.8rem,6vw,2.5rem)] text-balance">{session.user.displayName}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {session.club.name} · @{summary?.username ?? session.user.username}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm">
          <p className="font-label text-[10.5px] text-ink-3">{t("app.profile.code")}</p>
          <p className="font-score mt-2 text-2xl tracking-[0.04em] select-all">{session.user.code}</p>
        </Card>
        <Card padding="sm">
          <p className="font-label text-[10.5px] text-ink-3">{t("common.clubIndex")}</p>
          <p className="font-score mt-2 text-2xl">{formatClubIndex(summary?.clubIndex ?? null, locale)}</p>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <SectionHeading title={t("app.profile.qrHeading")} />
          <Card>
            <p className="mb-4 text-[13px] text-ink-3">{t("app.profile.qrLead")}</p>
            <MyQrCard initialToken={account.qrToken} />
          </Card>
        </section>
        <section>
          <SectionHeading title={t("app.profile.emailHeading")} />
          <Card>
            <p className="mb-4 text-[13px] text-ink-3">{t("app.profile.emailLead")}</p>
            <EmailForm initial={account.email} />
          </Card>
        </section>
      </div>

      <section className="lg:hidden">
        <SectionHeading title={t("app.profile.quickLinks")} />
        <Card padding="none" className="divide-y divide-line">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="flex items-center gap-3 px-4 py-3.5 font-semibold hover:bg-well">
              <link.icon className="size-[1.15rem] text-ink-3" />
              <span className="flex-1">{link.label}</span>
              <ChevronRight className="size-4 text-ink-3" />
            </Link>
          ))}
        </Card>
      </section>

      <section>
        <SectionHeading title={t("app.profile.preferences")} />
        <Card className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">{t("common.language.label")}</p>
            <LanguageSwitch />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-sm font-semibold">{t("common.theme.label")}</p>
            <ThemeSwitch initial={isThemeChoice(themeCookie) ? themeCookie : "system"} />
          </div>
          {inApp ? null : (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <Smartphone className="size-5 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t("app.profile.android")}</p>
                <p className="mt-0.5 text-[13px] text-ink-3">{t("app.profile.androidLead")}</p>
              </div>
              <LinkButton href={ANDROID_APK_PATH} download variant="secondary" size="sm" icon={<Download className="size-4" />}>
                {t("app.profile.androidDownload")}
              </LinkButton>
            </div>
          )}
        </Card>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <SectionHeading title={t("app.profile.usernameHeading")} />
          <Card>
            <p className="mb-4 text-[13px] text-ink-3">{t("app.profile.usernameLead")}</p>
            <UsernameForm initial={summary?.username ?? session.user.username ?? ""} />
          </Card>
        </section>
        <section>
          <SectionHeading title={t("app.profile.pinHeading")} />
          <Card>
            <p className="mb-4 text-[13px] text-ink-3">{t("app.profile.pinLead")}</p>
            <PinForm
              labels={{
                current: t("app.profile.pinCurrent"),
                next: t("app.profile.pinNew"),
                repeat: t("app.profile.pinRepeat"),
                submit: t("app.profile.pinSave"),
                mismatch: t("app.profile.pinMismatch"),
                done: t("app.profile.pinSaved"),
              }}
            />
          </Card>
        </section>
      </div>

      <div className="flex justify-center border-t border-line pt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
