import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: {
    email: v.string(),
    boardState: v.optional(v.string()),
  },
  handler: async (ctx, { email, boardState }) => {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) return null;

    // Limit boardState size to 500KB
    if (boardState && boardState.length > 500_000) return null;

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
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
