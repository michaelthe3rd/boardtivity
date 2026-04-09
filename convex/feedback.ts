import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const MAX_CONTENT_LENGTH = 500;
const MAX_REPLY_LENGTH = 300;
const MAX_REPLIES_PER_DAY = 5;

const ADJECTIVES = ["Swift","Bright","Calm","Bold","Keen","Vast","Crisp","Neat","Sage","Zeal","Jade","Nova","Peak","Dusk","Flux","Glow","Haze","Iris","Jest","Lush","Mist","Nimble","Opal","Pure","Quill","Rift","Snap","Teal","Urge","Vivid","Wren","Lynx","Yoke","Zinc","Arch","Blaze","Crest","Drift","Echo","Fern"];
const NOUNS = ["Fox","Wolf","Hawk","Bear","Lynx","Owl","Deer","Crow","Elk","Hare","Mink","Puma","Rook","Swan","Toad","Vole","Wren","Bison","Crane","Drake","Eagle","Finch","Grebe","Heron","Ibis","Jay","Kite","Lark","Moose","Newt","Otter","Pike","Quail","Robin","Stoat","Trout","Urchin","Viper","Wasp","Zebra"];

function generateUsername(tokenIdentifier: string): string {
  let hash = 0;
  for (let i = 0; i < tokenIdentifier.length; i++) {
    hash = ((hash << 5) - hash) + tokenIdentifier.charCodeAt(i);
    hash |= 0;
  }
  const h = Math.abs(hash);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
  const num = (h % 90) + 10;
  return `${adj}${noun}${num}`;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const tokenIdentifier = identity?.tokenIdentifier ?? null;

    const posts = await ctx.db.query("feedbackPosts").order("desc").take(100);
    posts.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));

    return Promise.all(posts.map(async (post) => {
      const userVote = tokenIdentifier
        ? await ctx.db
            .query("feedbackUpvotes")
            .withIndex("by_post_and_user", (q) =>
              q.eq("postId", post._id).eq("tokenIdentifier", tokenIdentifier)
            )
            .first()
        : null;

      const replies = await ctx.db
        .query("feedbackReplies")
        .withIndex("by_post", (q) => q.eq("postId", post._id))
        .order("asc")
        .take(50);

      return {
        ...post,
        userVote: userVote?.direction ?? null,
        isOwner: tokenIdentifier === post.tokenIdentifier,
        replies: replies.map((r) => ({
          ...r,
          isOwner: tokenIdentifier === r.tokenIdentifier,
        })),
      };
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

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const isPlus = sub?.status === "active" || sub?.status === "past_due";

    if (!isPlus) {
      const recent = await ctx.db
        .query("feedbackPosts")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .order("desc")
        .first();

      if (recent && Date.now() - recent.createdAt < TWENTY_FOUR_HOURS) {
        const hoursLeft = Math.ceil((TWENTY_FOUR_HOURS - (Date.now() - recent.createdAt)) / (60 * 60 * 1000));
        throw new Error(`rate_limit:${hoursLeft}`);
      }
    }

    return await ctx.db.insert("feedbackPosts", {
      tokenIdentifier: identity.tokenIdentifier,
      authorName: generateUsername(identity.tokenIdentifier),
      content: trimmed,
      createdAt: Date.now(),
      upvotes: 0,
      downvotes: 0,
    });
  },
});

export const vote = mutation({
  args: { postId: v.id("feedbackPosts"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { postId, direction }) => {
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
      if (existing.direction === direction) {
        // Toggle off
        await ctx.db.delete(existing._id);
        if (direction === "up") await ctx.db.patch(postId, { upvotes: Math.max(0, post.upvotes - 1) });
        else await ctx.db.patch(postId, { downvotes: Math.max(0, post.downvotes - 1) });
      } else {
        // Switch direction
        await ctx.db.patch(existing._id, { direction });
        if (direction === "up") {
          await ctx.db.patch(postId, { upvotes: post.upvotes + 1, downvotes: Math.max(0, post.downvotes - 1) });
        } else {
          await ctx.db.patch(postId, { downvotes: post.downvotes + 1, upvotes: Math.max(0, post.upvotes - 1) });
        }
      }
    } else {
      await ctx.db.insert("feedbackUpvotes", { postId, tokenIdentifier: identity.tokenIdentifier, direction });
      if (direction === "up") await ctx.db.patch(postId, { upvotes: post.upvotes + 1 });
      else await ctx.db.patch(postId, { downvotes: post.downvotes + 1 });
    }
  },
});

export const remove = mutation({
  args: { postId: v.id("feedbackPosts") },
  handler: async (ctx, { postId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const post = await ctx.db.get(postId);
    if (!post) return null;
    if (post.tokenIdentifier !== identity.tokenIdentifier) throw new Error("Unauthorized");

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

export const reply = mutation({
  args: { postId: v.id("feedbackPosts"), content: v.string() },
  handler: async (ctx, { postId, content }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_REPLY_LENGTH) return null;

    const post = await ctx.db.get(postId);
    if (!post) return null;

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    const isPlus = sub?.status === "active" || sub?.status === "past_due";

    if (!isPlus) {
      const dayAgo = Date.now() - TWENTY_FOUR_HOURS;
      const recentReplies = await ctx.db
        .query("feedbackReplies")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .order("desc")
        .take(MAX_REPLIES_PER_DAY + 1);

      const recentCount = recentReplies.filter((r) => r.createdAt > dayAgo).length;
      if (recentCount >= MAX_REPLIES_PER_DAY) {
        throw new Error("reply_rate_limit");
      }
    }

    return await ctx.db.insert("feedbackReplies", {
      postId,
      tokenIdentifier: identity.tokenIdentifier,
      authorName: generateUsername(identity.tokenIdentifier),
      content: trimmed,
      createdAt: Date.now(),
    });
  },
});

export const removeReply = mutation({
  args: { replyId: v.id("feedbackReplies") },
  handler: async (ctx, { replyId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const r = await ctx.db.get(replyId);
    if (!r) return null;
    if (r.tokenIdentifier !== identity.tokenIdentifier) throw new Error("Unauthorized");

    await ctx.db.delete(replyId);
  },
});
