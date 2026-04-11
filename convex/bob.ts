import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getBobUserInfo = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return "";
    const prefs = await ctx.db
      .query("emailPrefs")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    return prefs?.bobUserInfo ?? "";
  },
});

export const setBobUserInfo = mutation({
  args: { userInfo: v.string() },
  handler: async (ctx, { userInfo }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const existing = await ctx.db
      .query("emailPrefs")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { bobUserInfo: userInfo });
    } else {
      await ctx.db.insert("emailPrefs", {
        tokenIdentifier: identity.tokenIdentifier,
        dailyDigest: false,
        weeklyDigest: false,
        bobUserInfo: userInfo,
      });
    }
  },
});

export const PLUS_TOKEN_LIMIT = 500_000;

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

    const inputTokens     = usage?.inputTokens    ?? 0;
    const outputTokens    = usage?.outputTokens   ?? 0;
    const purchasedTokens = usage?.purchasedTokens ?? 0;
    const totalUsed       = inputTokens + outputTokens;

    return {
      inputTokens,
      outputTokens,
      totalUsed,
      purchasedTokens,
      baseLimit: PLUS_TOKEN_LIMIT,
      isPlus,
      remaining: isPlus ? Math.max(0, PLUS_TOKEN_LIMIT + purchasedTokens - totalUsed) : 0,
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
