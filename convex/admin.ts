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

export const getAnalytics = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) return null;
    const [users, waitlist] = await Promise.all([
      ctx.db.query("userBoards").take(2000),
      ctx.db.query("waitlist").take(2000),
    ]);

    const now = Date.now();
    const DAY = 86400000;
    const dayKey = (ms: number) => {
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const days30: string[] = [];
    for (let i = 29; i >= 0; i--) days30.push(dayKey(now - i * DAY));

    const userSignups: Record<string, number> = Object.fromEntries(days30.map((d) => [d, 0]));
    const userActivity: Record<string, number> = Object.fromEntries(days30.map((d) => [d, 0]));
    const waitlistSignups: Record<string, number> = Object.fromEntries(days30.map((d) => [d, 0]));

    for (const u of users) {
      const ck = dayKey(u._creationTime);
      if (ck in userSignups) userSignups[ck]++;
      const ak = dayKey(u.updatedAt);
      if (ak in userActivity) userActivity[ak]++;
    }
    for (const w of waitlist) {
      const k = dayKey(w.joinedAt);
      if (k in waitlistSignups) waitlistSignups[k]++;
    }

    const totalStorage = users.reduce((s, u) => s + u.boardState.length, 0);
    const avgStorage = users.length > 0 ? Math.round(totalStorage / users.length) : 0;
    const active7d = users.filter((u) => u.updatedAt > now - 7 * DAY).length;
    const active30d = users.filter((u) => u.updatedAt > now - 30 * DAY).length;

    const topUsers = [...users]
      .sort((a, b) => b.boardState.length - a.boardState.length)
      .slice(0, 10)
      .map((u) => ({
        tokenIdentifier: u.tokenIdentifier,
        size: u.boardState.length,
        updatedAt: u.updatedAt,
        createdAt: u._creationTime,
      }));

    return {
      days: days30,
      userSignups: days30.map((d) => userSignups[d]),
      userActivity: days30.map((d) => userActivity[d]),
      waitlistSignups: days30.map((d) => waitlistSignups[d]),
      totalStorage,
      avgStorage,
      active7d,
      active30d,
      topUsers,
    };
  },
});
