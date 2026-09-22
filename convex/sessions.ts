import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

async function touchSession(ctx: MutationCtx, sessionId: string, isSignedIn: boolean) {
  if (!SESSION_ID_RE.test(sessionId)) return;
  const existing = await ctx.db
    .query("sessions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .first();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { lastSeen: now, isSignedIn });
  } else {
    await ctx.db.insert("sessions", { sessionId, startTime: now, lastSeen: now, isSignedIn });
  }
}

const args = { sessionId: v.string(), isSignedIn: v.boolean() };

export const startSession = mutation({
  args,
  handler: (ctx, { sessionId, isSignedIn }) => touchSession(ctx, sessionId, isSignedIn),
});

export const heartbeat = mutation({
  args,
  handler: (ctx, { sessionId, isSignedIn }) => touchSession(ctx, sessionId, isSignedIn),
});
