import { NextResponse, type NextRequest } from "next/server";
import { detailRouteExists } from "@/lib/route-ids";

/**
 * Unknown branch or officer ids are rewritten to a path with no route, so the
 * root not-found page renders with a real 404 status. (A rewrite to the same
 * page would stream a 200, and Next ignores a status passed to rewrite.)
 */
export function proxy(request: NextRequest) {
  if (detailRouteExists(request.nextUrl.pathname) === false) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }
}

export const config = {
  matcher: ["/branches/:id", "/reps/:id"],
};
