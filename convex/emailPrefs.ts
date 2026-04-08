import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULTS = { dailyDigest: true, weeklyDigest: true, dueSoonReminder: true };

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const prefs = await ctx.db
      .query("emailPrefs")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    return prefs ?? DEFAULTS;
  },
});

export const update = mutation({
  args: {
    dailyDigest: v.boolean(),
    weeklyDigest: v.boolean(),
    dueSoonReminder: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const existing = await ctx.db
      .query("emailPrefs")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("emailPrefs", {
        tokenIdentifier: identity.tokenIdentifier,
        ...args,
      });
    }
  },
});
