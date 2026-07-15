import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fairway_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = request.nextUrl.clone();
    login.pathname = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/platform") ? "/admin/login" : "/";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/admin", "/platform/:path*"] };
