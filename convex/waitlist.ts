import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Internal only — not callable from the client.
export const ensureLinked = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("waitlist", {
      email: normalized,
      joinedAt: Date.now(),
    });
  },
});

// Check if an email is already on the waitlist
export const checkEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email.trim().toLowerCase()))
      .first();
    return !!existing;
  },
});

export const join = mutation({
  args: {
    email: v.string(),
    boardState: v.optional(v.string()),
  },
  handler: async (ctx, { email, boardState }) => {
    // Normalize and validate email
    const normalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(normalized) || normalized.length > 254) return null;

    // Limit boardState size to 500KB
    if (boardState && boardState.length > 500_000) return null;

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { boardState });
      return existing._id;
    }

    return await ctx.db.insert("waitlist", {
      email: normalized,
      boardState,
      joinedAt: Date.now(),
    });
  },
});
