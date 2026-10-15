import { mutation, query, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

// Everyone starts with all emails on; reminderTime is local "HH:MM".
export const DEFAULT_PREFS = { dailyDigest: true, weeklyDigest: true, dueSoonReminder: true, reminderTime: "08:00" };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTimeZone(zone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return true; } catch { return false; }
}

async function prefsDoc(ctx: MutationCtx, tokenIdentifier: string) {
  return await ctx.db
    .query("emailPrefs")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .first();
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const prefs = await ctx.db
      .query("emailPrefs")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    return {
      dailyDigest: prefs?.dailyDigest ?? DEFAULT_PREFS.dailyDigest,
      weeklyDigest: prefs?.weeklyDigest ?? DEFAULT_PREFS.weeklyDigest,
      dueSoonReminder: prefs?.dueSoonReminder ?? DEFAULT_PREFS.dueSoonReminder,
      reminderTime: prefs?.reminderTime ?? DEFAULT_PREFS.reminderTime,
      timeZone: prefs?.timeZone ?? null,
    };
  },
});

// Partial update: only the fields passed are changed, so two quick toggles can't overwrite each other.
export const update = mutation({
  args: {
    dailyDigest: v.optional(v.boolean()),
    weeklyDigest: v.optional(v.boolean()),
    dueSoonReminder: v.optional(v.boolean()),
    reminderTime: v.optional(v.string()),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (args.reminderTime !== undefined && !TIME_RE.test(args.reminderTime)) throw new Error("Invalid time");
    if (args.timeZone !== undefined && !isValidTimeZone(args.timeZone)) throw new Error("Invalid time zone");

    const changes = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
    const existing = await prefsDoc(ctx, identity.tokenIdentifier);
    if (existing) {
      await ctx.db.patch(existing._id, changes);
    } else {
      await ctx.db.insert("emailPrefs", {
        tokenIdentifier: identity.tokenIdentifier,
        dailyDigest: DEFAULT_PREFS.dailyDigest,
        weeklyDigest: DEFAULT_PREFS.weeklyDigest,
        ...changes,
      });
    }
    return null;
  },
});

// ── Internal: used by the email senders and the unsubscribe endpoint ─────────

// Returns the user's unsubscribe key, creating their prefs row and key if needed.
export const ensureUnsubscribeKey = internalMutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    const existing = await prefsDoc(ctx, tokenIdentifier);
    if (existing?.unsubscribeKey) return existing.unsubscribeKey;
    const key = crypto.randomUUID().replace(/-/g, "");
    if (existing) {
      await ctx.db.patch(existing._id, { unsubscribeKey: key });
    } else {
      await ctx.db.insert("emailPrefs", {
        tokenIdentifier,
        dailyDigest: DEFAULT_PREFS.dailyDigest,
        weeklyDigest: DEFAULT_PREFS.weeklyDigest,
        unsubscribeKey: key,
      });
    }
    return key;
  },
});

export const markDigestSent = internalMutation({
  args: { tokenIdentifier: v.string(), date: v.string(), daily: v.boolean(), weekly: v.boolean() },
  handler: async (ctx, { tokenIdentifier, date, daily, weekly }) => {
    const existing = await prefsDoc(ctx, tokenIdentifier);
    const stamps = { ...(daily ? { lastDailySent: date } : {}), ...(weekly ? { lastWeeklySent: date } : {}) };
    if (existing) {
      await ctx.db.patch(existing._id, stamps);
    } else {
      await ctx.db.insert("emailPrefs", { tokenIdentifier, dailyDigest: DEFAULT_PREFS.dailyDigest, weeklyDigest: DEFAULT_PREFS.weeklyDigest, ...stamps });
    }
    return null;
  },
});

// Turns off one email list (or all of them) for whoever owns the key. Returns false for an unknown key.
export const unsubscribe = internalMutation({
  args: { key: v.string(), list: v.union(v.literal("daily"), v.literal("weekly"), v.literal("reminders"), v.literal("all")) },
  handler: async (ctx, { key, list }) => {
    const prefs = await ctx.db
      .query("emailPrefs")
      .withIndex("by_unsubscribeKey", (q) => q.eq("unsubscribeKey", key))
      .first();
    if (!prefs) return false;
    await ctx.db.patch(prefs._id, {
      ...(list === "daily" || list === "all" ? { dailyDigest: false } : {}),
      ...(list === "weekly" || list === "all" ? { weeklyDigest: false } : {}),
      ...(list === "reminders" || list === "all" ? { dueSoonReminder: false } : {}),
    });
    return true;
  },
});
