import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { homeFor } from "@/lib/policies";
import { allowedForRole } from "@/lib/route-guards";

// Optimistic perimeter checks only — every route handler re-verifies the
// session and permissions in the DAL (src/lib/dal.ts).
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");

  if (!req.auth?.user) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user.role;

  // "/" isn't a real page — send everyone straight to their role's home.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(homeFor(role), req.url));
  }

  // Role guard: e.g. GUESTHOUSE cannot open /inventory, STAFF cannot open /admin.
  if (!allowedForRole(pathname, role)) {
    if (isApi) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(homeFor(role), req.url));
  }

  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
});

export const config = {
  // Public static assets (images, fonts, etc. served from /public) must be
  // excluded too — otherwise the auth guard 307s the logo request itself.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico)$).*)",
  ],
};
