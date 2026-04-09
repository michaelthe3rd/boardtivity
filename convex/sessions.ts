import { mutation } from "./_generated/server";
import { v } from "convex/values";

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export const startSession = mutation({
  args: { sessionId: v.string(), isSignedIn: v.boolean() },
  handler: async (ctx, { sessionId, isSignedIn }) => {
    if (!SESSION_ID_RE.test(sessionId)) return;
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: Date.now(), isSignedIn });
    } else {
      const now = Date.now();
      await ctx.db.insert("sessions", { sessionId, startTime: now, lastSeen: now, isSignedIn });
    }
  },
});

export const heartbeat = mutation({
  args: { sessionId: v.string(), isSignedIn: v.boolean() },
  handler: async (ctx, { sessionId, isSignedIn }) => {
    if (!SESSION_ID_RE.test(sessionId)) return;
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: Date.now(), isSignedIn });
    } else {
      const now = Date.now();
      await ctx.db.insert("sessions", { sessionId, startTime: now, lastSeen: now, isSignedIn });
    }
  },
});
