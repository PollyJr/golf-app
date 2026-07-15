import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";

export default async function PlayerLayout({children}:{children:React.ReactNode}){
  const session = await requireSession(["player"]);
  return <AppShell user={{displayName:session.displayName,initials:session.initials,code:session.code || "",clubName:session.clubName || "Golfclub"}}>{children}</AppShell>;
}
