import { route } from "@/server/http/route";
import { regenerateQrToken } from "@/server/services/players";

/** Replaces the personal QR code; the old one stops working. */
export const PUT = route({ access: "player" }, async ({ session }) => ({ qrToken: await regenerateQrToken(session) }));
