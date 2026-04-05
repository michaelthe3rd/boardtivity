import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: {
    email: v.string(),
    boardState: v.optional(v.string()),
  },
  handler: async (ctx, { email, boardState }) => {
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      // Update board state if already signed up
      await ctx.db.patch(existing._id, { boardState });
      return existing._id;
    }

    return await ctx.db.insert("waitlist", {
      email,
      boardState,
      joinedAt: Date.now(),
    });
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
  },
});
