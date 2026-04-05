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
});
