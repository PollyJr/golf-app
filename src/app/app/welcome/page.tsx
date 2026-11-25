import { redirect } from "next/navigation";
import { WelcomeForm } from "@/components/auth/welcome-form";
import { Wordmark } from "@/components/brand";
import { SignOutButton } from "@/components/preferences";
import { Card, Eyebrow } from "@/components/ui/card";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getOwnAccount } from "@/server/services/players";

/** First sign-in with a PIN issued by the club: the player picks their own. */
export default async function WelcomePage() {
  const session = await requirePlayer({ allowPinChange: true });
  if (!session.user.mustChangeSecret) redirect("/app");
  const [{ t }, account] = await Promise.all([getT(), getOwnAccount(session)]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex items-center justify-between">
        <Wordmark name={session.club.name} />
        <SignOutButton iconOnly />
      </div>
      <div>
        <Eyebrow>{t("auth.welcome.eyebrow")}</Eyebrow>
        <h1 className="font-display mt-2 text-4xl">{t("auth.welcome.title")}</h1>
        <p className="mt-3 text-ink-2">{t("auth.welcome.lead")}</p>
      </div>
      <Card padding="lg">
        <WelcomeForm initialEmail={account.email} />
      </Card>
    </div>
  );
}
