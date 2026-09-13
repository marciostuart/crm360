import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/master/:path*", "/api/master/:path*"] };
