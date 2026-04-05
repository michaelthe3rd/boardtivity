import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    const { userId } = await auth();

    // Not signed in → redirect to home
    if (!userId) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    // Email-based admin check is enforced by Convex queries (returns null for non-admins)
  }
});

export const proxyConfig = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
