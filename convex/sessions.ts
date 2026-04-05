import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const startSession = mutation({
  args: { sessionId: v.string(), isSignedIn: v.boolean() },
  handler: async (ctx, { sessionId, isSignedIn }) => {
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
