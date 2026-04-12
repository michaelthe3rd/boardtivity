import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    boardState: v.optional(v.string()),
    joinedAt: v.number(),
  }).index("by_email", ["email"]),

  userBoards: defineTable({
    tokenIdentifier: v.string(),
    boardState: v.string(), // JSON: { boards, notes, activeBoardId }
    updatedAt: v.number(),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  emailPrefs: defineTable({
    tokenIdentifier: v.string(),
    dailyDigest: v.boolean(),
    weeklyDigest: v.boolean(),
    dueSoonReminder: v.optional(v.boolean()),
    bobUserInfo: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  feedbackPosts: defineTable({
    tokenIdentifier: v.string(),
    authorName: v.string(),
    content: v.string(),
    createdAt: v.number(),
    upvotes: v.number(),
    downvotes: v.number(),
  }).index("by_token", ["tokenIdentifier"])
    .index("by_upvotes", ["upvotes"]),

  feedbackUpvotes: defineTable({
    postId: v.id("feedbackPosts"),
    tokenIdentifier: v.string(),
    direction: v.union(v.literal("up"), v.literal("down")),
  }).index("by_post", ["postId"])
    .index("by_post_and_user", ["postId", "tokenIdentifier"]),

  feedbackReplies: defineTable({
    postId: v.id("feedbackPosts"),
    tokenIdentifier: v.string(),
    authorName: v.string(),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_post", ["postId"])
    .index("by_token", ["tokenIdentifier"]),

  sessions: defineTable({
    sessionId: v.string(),
    startTime: v.number(),
    lastSeen: v.number(),
    isSignedIn: v.boolean(),
  }).index("by_session", ["sessionId"])
    .index("by_lastSeen", ["lastSeen"]),

  bobUsage: defineTable({
    tokenIdentifier: v.string(),
    month: v.string(), // "YYYY-MM"
    inputTokens: v.number(),
    outputTokens: v.number(),
    purchasedTokens: v.number(),
  }).index("by_token_and_month", ["tokenIdentifier", "month"]),

  reminders: defineTable({
    tokenIdentifier: v.string(),
    email: v.string(),
    noteId: v.number(),
    noteTitle: v.string(),
    remindAt: v.number(),       // unix ms when to fire
    schedulerJobId: v.string(), // Convex scheduler job ID (stored as string)
    sent: v.boolean(),
  }).index("by_token", ["tokenIdentifier"])
    .index("by_note_and_token", ["tokenIdentifier", "noteId"]),

  subscriptions: defineTable({
    tokenIdentifier: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    status: v.string(), // "active" | "canceled" | "past_due" | "unpaid"
    currentPeriodEnd: v.optional(v.number()),
  }).index("by_token", ["tokenIdentifier"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  focusStats: defineTable({
    tokenIdentifier: v.string(),
    date: v.string(),          // "YYYY-MM-DD"
    totalMinutes: v.number(),
    tasksCompleted: v.number(),
  }).index("by_token", ["tokenIdentifier"])
    .index("by_token_and_date", ["tokenIdentifier", "date"]),
});
