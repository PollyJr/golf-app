import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fairway_session";

/**
 * Runs before every page request. It does two cheap things:
 *  1. sends visitors without a session cookie away from the signed-in areas
 *     (the real authorisation happens in the pages and API routes);
 *  2. issues a Content-Security-Policy with a fresh nonce, so only scripts
 *     that Next.js itself rendered can run.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (!request.cookies.has(SESSION_COOKIE)) {
    const adminArea = pathname.startsWith("/admin") || pathname.startsWith("/platform");
    const playerArea = pathname === "/app" || pathname.startsWith("/app/");
    if ((adminArea && pathname !== "/admin/login") || playerArea) {
      const target = request.nextUrl.clone();
      target.pathname = adminArea ? "/admin/login" : "/";
      target.search = "";
      return NextResponse.redirect(target);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV !== "production";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes carry club colours and chart geometry.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API, static files or prefetches.
      source: "/((?!api/|_next/static|_next/image|icons/|sw.js|manifest.webmanifest|favicon.ico|.*\\.(?:png|svg|ico|webp|woff2)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
