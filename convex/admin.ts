import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Fallback: match by tokenIdentifier (e.g. "https://clerk.boardtivity.com|user_xxx")
const ADMIN_TOKENS = (process.env.ADMIN_TOKENS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes((identity.email ?? "").toLowerCase())) return true;
  if (ADMIN_TOKENS.length > 0 && ADMIN_TOKENS.includes(identity.tokenIdentifier)) return true;
  return false;
}

// Public: returns current user's identity info so admin can self-diagnose
export const whoami = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      email: identity.email ?? null,
      tokenIdentifier: identity.tokenIdentifier,
      subject: identity.subject,
    };
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) return null;
    const [users, posts, replies, waitlist, upvotes] = await Promise.all([
      ctx.db.query("userBoards").take(2000),
      ctx.db.query("feedbackPosts").take(2000),
      ctx.db.query("feedbackReplies").take(2000),
      ctx.db.query("waitlist").take(2000),
      ctx.db.query("feedbackUpvotes").take(2000),
    ]);
    return {
      totalUsers: users.length,
      totalPosts: posts.length,
      totalReplies: replies.length,
      totalWaitlist: waitlist.length,
      totalUpvotes: upvotes.length,
    };
  },
});

export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) return null;
    const users = await ctx.db.query("userBoards").order("desc").take(200);
    return users.map((u) => ({
      id: u._id,
      tokenIdentifier: u.tokenIdentifier,
      updatedAt: u.updatedAt,
      boardStateSize: u.boardState.length,
    }));
  },
});

export const getFeedback = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) return null;
    const posts = await ctx.db.query("feedbackPosts").order("desc").take(200);
    return Promise.all(
      posts.map(async (post) => {
        const replies = await ctx.db
          .query("feedbackReplies")
          .withIndex("by_post", (q) => q.eq("postId", post._id))
          .take(100);
        return { ...post, replyCount: replies.length };
      })
    );
  },
});

export const getWaitlist = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) return null;
    return await ctx.db.query("waitlist").order("desc").take(500);
  },
});

export const adminDeletePost = mutation({
  args: { postId: v.id("feedbackPosts") },
  handler: async (ctx, { postId }) => {
    if (!(await isAdmin(ctx))) throw new Error("Unauthorized");
    const votes = await ctx.db
      .query("feedbackUpvotes")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .take(500);
    await Promise.all(votes.map((u) => ctx.db.delete(u._id)));
    const replies = await ctx.db
      .query("feedbackReplies")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .take(500);
    await Promise.all(replies.map((r) => ctx.db.delete(r._id)));
    await ctx.db.delete(postId);
  },
});

export const adminDeleteWaitlist = mutation({
  args: { id: v.id("waitlist") },
  handler: async (ctx, { id }) => {
    if (!(await isAdmin(ctx))) throw new Error("Unauthorized");
    await ctx.db.delete(id);
  },
});

export const adminDeleteUser = mutation({
  args: { id: v.id("userBoards") },
  handler: async (ctx, { id }) => {
    if (!(await isAdmin(ctx))) throw new Error("Unauthorized");
    await ctx.db.delete(id);
  },
});
