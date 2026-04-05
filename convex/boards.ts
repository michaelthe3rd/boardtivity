import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = mutation({
  args: { boardState: v.string() },
  handler: async (ctx, { boardState }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const existing = await ctx.db
      .query("userBoards")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { boardState, updatedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("userBoards", {
      tokenIdentifier: identity.tokenIdentifier,
      boardState,
      updatedAt: Date.now(),
    });
  },
});

export const load = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("userBoards")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
  },
});
