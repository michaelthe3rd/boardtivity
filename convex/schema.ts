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
});
