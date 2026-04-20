import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Minimal shapes needed for server-side merge — only the fields we inspect.
interface StoredNote { id: number; [key: string]: unknown }
interface StoredBoard { id: string; [key: string]: unknown }
interface BoardData {
  notes?: StoredNote[];
  boards?: StoredBoard[];
  deletedNoteIds?: number[];
  deletedBoardIds?: string[];
  [key: string]: unknown;
}

export const save = mutation({
  args: { boardState: v.string(), id: v.optional(v.id("userBoards")), clientBaseAt: v.optional(v.number()) },
  handler: async (ctx, { boardState, id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    if (boardState.length > 1_000_000) return null;

    const email = identity.email ?? undefined;

    // Locate the existing document (by explicit id or by user lookup).
    const existing = id
      ? await ctx.db.get(id)
      : await ctx.db
          .query("userBoards")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
          .first();

    if (!existing) {
      return await ctx.db.insert("userBoards", {
        tokenIdentifier: identity.tokenIdentifier,
        boardState,
        updatedAt: Date.now(),
        email,
      });
    }

    // ── Server-side merge ────────────────────────────────────────────────────────
    // Instead of a blind replace, we merge the incoming state with what's already
    // in the database. The key invariant: deletions are permanent. A stale save
    // from another open device can never undo a deletion made on any device.
    let mergedState = boardState;
    try {
      const incoming = JSON.parse(boardState) as BoardData;
      const current = JSON.parse(existing.boardState) as BoardData;

      // Union of deleted ID sets — once deleted, always deleted.
      const mergedDeletedNoteIds = [
        ...new Set([...(current.deletedNoteIds ?? []), ...(incoming.deletedNoteIds ?? [])]),
      ];
      const mergedDeletedBoardIds = [
        ...new Set([...(current.deletedBoardIds ?? []), ...(incoming.deletedBoardIds ?? [])]),
      ];
      const deletedNoteSet = new Set(mergedDeletedNoteIds);
      const deletedBoardSet = new Set(mergedDeletedBoardIds);

      // Notes merge:
      //   • Incoming is authoritative for edits (client editing device wins).
      //   • Notes only in the existing DB record are preserved — they were added
      //     by another device and a stale save shouldn't silently drop them.
      //   • Any note in the merged deletedNoteIds is removed regardless of source.
      const incomingNoteIds = new Set((incoming.notes ?? []).map((n) => n.id));
      const mergedNotes = [
        ...(incoming.notes ?? []).filter((n) => !deletedNoteSet.has(n.id)),
        ...(current.notes ?? []).filter(
          (n) => !incomingNoteIds.has(n.id) && !deletedNoteSet.has(n.id)
        ),
      ];

      // Boards merge: same strategy.
      const incomingBoardIds = new Set((incoming.boards ?? []).map((b) => b.id));
      const mergedBoards = [
        ...(incoming.boards ?? []).filter((b) => !deletedBoardSet.has(b.id)),
        ...(current.boards ?? []).filter(
          (b) => !incomingBoardIds.has(b.id) && !deletedBoardSet.has(b.id)
        ),
      ];

      mergedState = JSON.stringify({
        ...incoming,
        notes: mergedNotes,
        boards: mergedBoards,
        deletedNoteIds: mergedDeletedNoteIds,
        deletedBoardIds: mergedDeletedBoardIds,
      });
    } catch {
      // Malformed JSON — fall back to storing the incoming state as-is.
      mergedState = boardState;
    }

    await ctx.db.replace(existing._id, {
      tokenIdentifier: identity.tokenIdentifier,
      boardState: mergedState,
      updatedAt: Date.now(),
      email,
    });
    return existing._id;
  },
});

export const load = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("userBoards")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
  },
});
