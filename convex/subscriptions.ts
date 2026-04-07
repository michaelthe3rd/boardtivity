import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// Called by the Stripe webhook HTTP action — not exposed to the client.
export const upsert = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripePriceId: args.stripePriceId,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
      });
    } else {
      await ctx.db.insert("subscriptions", args);
    }
  },
});

export const updateBySubscriptionId = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
    stripePriceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        ...(args.currentPeriodEnd !== undefined ? { currentPeriodEnd: args.currentPeriodEnd } : {}),
        ...(args.stripePriceId ? { stripePriceId: args.stripePriceId } : {}),
      });
    }
  },
});

// Returns the current user's active subscription, or null.
export const getMySubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!sub) return null;
    // Treat past_due as active so users aren't locked out during grace period
    const isActive = sub.status === "active" || sub.status === "past_due";
    return isActive ? sub : null;
  },
});
