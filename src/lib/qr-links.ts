/**
 * The links behind Fairway's QR codes, and how to read them back.
 *
 *   /p/TOKEN     a player's personal code: scan it to add them to your round
 *   /r/TOKEN     a round's code: scan it to join that round
 *   /join/CODE   a club's sign-up code
 *   /live/TOKEN  a round's public live view
 */

export type FairwayLinkKind = "player" | "round" | "join" | "live";

export interface FairwayLink {
  kind: FairwayLinkKind;
  token: string;
  /** Path on this site, e.g. `/r/abc…`. */
  path: string;
}

const PATTERNS: ReadonlyArray<[RegExp, FairwayLinkKind]> = [
  [/^\/p\/([A-Za-z0-9_-]{16,64})\/?$/, "player"],
  [/^\/r\/([A-Za-z0-9_-]{16,64})\/?$/, "round"],
  [/^\/join\/([A-Za-z0-9-]{4,32})\/?$/, "join"],
  [/^\/live\/([A-Za-z0-9_-]{16,200})\/?$/, "live"],
];

export const playerQrPath = (token: string) => `/p/${token}`;
export const roundQrPath = (token: string) => `/r/${token}`;

/**
 * Reads a scanned or pasted text. Only the path counts, so a code made on
 * another address of the same app (a custom domain, say) still works.
 */
export function parseFairwayLink(text: string): FairwayLink | null {
  let url: URL;
  try {
    url = new URL(text.trim(), "https://fairway.invalid");
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  for (const [pattern, kind] of PATTERNS) {
    const match = pattern.exec(url.pathname);
    if (match) return { kind, token: match[1], path: url.pathname.replace(/\/$/, "") };
  }
  return null;
}

/**
 * Where to send someone after signing in: only paths on this site, and only
 * the ones a QR code or an invitation can lead to.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return /^\/(app|r|p|live)(\/[A-Za-z0-9_\-/?=&]*)?$/.test(value) ? value : null;
}
