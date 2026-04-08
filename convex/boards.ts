import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = mutation({
  args: { boardState: v.string(), id: v.optional(v.id("userBoards")) },
  handler: async (ctx, { boardState, id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Limit boardState size to 1MB
    if (boardState.length > 1_000_000) return null;

    // If we already know the document ID, replace directly — no read means no
    // write conflict when concurrent saves happen.
    const email = identity.email ?? undefined;

    if (id) {
      await ctx.db.replace(id, {
        tokenIdentifier: identity.tokenIdentifier,
        boardState,
        updatedAt: Date.now(),
        email,
      });
      return id;
    }

    // First save: check if a document exists for this user.
    const existing = await ctx.db
      .query("userBoards")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (existing) {
      await ctx.db.replace(existing._id, {
        tokenIdentifier: identity.tokenIdentifier,
        boardState,
        updatedAt: Date.now(),
        email,
      });
      return existing._id;
    }

    return await ctx.db.insert("userBoards", {
      tokenIdentifier: identity.tokenIdentifier,
      boardState,
      updatedAt: Date.now(),
      email,
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
