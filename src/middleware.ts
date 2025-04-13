import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Check for token in cookies
  const token = request.cookies.get("token")?.value || ""
  const pathname = request.nextUrl.pathname

  // Public paths that don't require authentication
  const publicPaths = ["/", "/login", "/register"]

  // Check if the path is public
  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(path))

  // If trying to access a protected route without a token, redirect to login
  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // If trying to access login/register with a token, redirect to rooms
  if (token && isPublicPath) {
    return NextResponse.redirect(new URL("/rooms", request.url))
  }

  return NextResponse.next()
}

// Match all routes except for api routes, static files, etc.
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /fonts (inside /public)
     * 4. /workers (inside /public)
     * 5. all root files like favicon.ico, etc.
     */
    "/((?!api|_next|fonts|workers|.*\\..*).*)",
  ],
}
