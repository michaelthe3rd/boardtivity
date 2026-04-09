import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const FREE_TOKEN_LIMIT  = 50_000;
export const PLUS_TOKEN_LIMIT  = 2_000_000;

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export const getUsage = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const month = currentMonth();
    const usage = await ctx.db
      .query("bobUsage")
      .withIndex("by_token_and_month", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier).eq("month", month)
      )
      .first();

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const isPlus = sub?.status === "active" || sub?.status === "past_due";

    const inputTokens    = usage?.inputTokens    ?? 0;
    const outputTokens   = usage?.outputTokens   ?? 0;
    const purchasedTokens = usage?.purchasedTokens ?? 0;
    const totalUsed      = inputTokens + outputTokens;
    const baseLimit      = isPlus ? PLUS_TOKEN_LIMIT : FREE_TOKEN_LIMIT;

    return {
      inputTokens,
      outputTokens,
      totalUsed,
      purchasedTokens,
      baseLimit,
      isPlus,
      remaining: Math.max(0, baseLimit + purchasedTokens - totalUsed),
    };
  },
});

export const recordUsage = mutation({
  args: { inputTokens: v.number(), outputTokens: v.number() },
  handler: async (ctx, { inputTokens, outputTokens }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    // Sanity bounds — reject anything unreasonably large
    if (inputTokens < 0 || outputTokens < 0) return;
    if (inputTokens > 500_000 || outputTokens > 500_000) return;

    const month = currentMonth();
    const existing = await ctx.db
      .query("bobUsage")
      .withIndex("by_token_and_month", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier).eq("month", month)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        inputTokens:  existing.inputTokens  + inputTokens,
        outputTokens: existing.outputTokens + outputTokens,
      });
    } else {
      await ctx.db.insert("bobUsage", {
        tokenIdentifier: identity.tokenIdentifier,
        month,
        inputTokens,
        outputTokens,
        purchasedTokens: 0,
      });
    }
  },
});
