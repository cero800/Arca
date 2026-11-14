import { NextResponse, type NextRequest } from "next/server";

/** Better Auth usa el prefijo `arca`; en producción añade `__Secure-`. */
function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get("arca.session_token") ??
      request.cookies.get("__Secure-arca.session_token"),
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = hasSessionCookie(request);

  const isProtected = pathname === "/" || pathname === "/v" || pathname.startsWith("/v/");

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico)$).*)",
  ],
};
