import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const MAX_CONTENT_LENGTH = 500;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const tokenIdentifier = identity?.tokenIdentifier ?? null;

    const posts = await ctx.db
      .query("feedbackPosts")
      .order("desc")
      .collect();

    // Sort by upvotes descending
    posts.sort((a, b) => b.upvotes - a.upvotes);

    // Attach whether the current user has upvoted each post
    return Promise.all(posts.map(async (post) => {
      const userUpvote = tokenIdentifier
        ? await ctx.db
            .query("feedbackUpvotes")
            .withIndex("by_post_and_user", (q) =>
              q.eq("postId", post._id).eq("tokenIdentifier", tokenIdentifier)
            )
            .first()
        : null;
      return { ...post, hasUpvoted: !!userUpvote };
    }));
  },
});

export const post = mutation({
  args: { content: v.string() },
  handler: async (ctx, { content }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_CONTENT_LENGTH) return null;

    // Rate limit: 1 post per 24 hours
    const recent = await ctx.db
      .query("feedbackPosts")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .order("desc")
      .first();

    if (recent && Date.now() - recent.createdAt < TWENTY_FOUR_HOURS) {
      const hoursLeft = Math.ceil((TWENTY_FOUR_HOURS - (Date.now() - recent.createdAt)) / (60 * 60 * 1000));
      throw new Error(`rate_limit:${hoursLeft}`);
    }

    const authorName = identity.name ?? identity.email ?? "Anonymous";

    return await ctx.db.insert("feedbackPosts", {
      tokenIdentifier: identity.tokenIdentifier,
      authorName,
      content: trimmed,
      createdAt: Date.now(),
      upvotes: 0,
    });
  },
});

export const upvote = mutation({
  args: { postId: v.id("feedbackPosts") },
  handler: async (ctx, { postId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const post = await ctx.db.get(postId);
    if (!post) return null;

    const existing = await ctx.db
      .query("feedbackUpvotes")
      .withIndex("by_post_and_user", (q) =>
        q.eq("postId", postId).eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (existing) {
      // Remove upvote (toggle off)
      await ctx.db.delete(existing._id);
      await ctx.db.patch(postId, { upvotes: Math.max(0, post.upvotes - 1) });
    } else {
      // Add upvote
      await ctx.db.insert("feedbackUpvotes", {
        postId,
        tokenIdentifier: identity.tokenIdentifier,
      });
      await ctx.db.patch(postId, { upvotes: post.upvotes + 1 });
    }
  },
});
