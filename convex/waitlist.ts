import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Called automatically when a user signs up for an account —
// ensures they appear in the waitlist without requiring them to fill the form.
export const ensureLinked = mutation({
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
