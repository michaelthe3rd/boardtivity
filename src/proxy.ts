import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export const proxy = clerkMiddleware(async (_auth, _req) => {
  // Auth handled entirely in AdminClient — no server-side redirects
});

export const proxyConfig = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
