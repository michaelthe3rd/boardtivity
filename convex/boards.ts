import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Minimal shapes needed for server-side merge — only the fields we inspect.
interface StoredNote { id: number; [key: string]: unknown }
interface StoredBoard { id: string; [key: string]: unknown }
interface StoredArrow { id: number; boardId?: string; fromNoteId?: number; toNoteId?: number; [key: string]: unknown }
interface StoredSticker { id: number; boardId?: string; [key: string]: unknown }
interface BoardData {
  notes?: StoredNote[];
  boards?: StoredBoard[];
  arrows?: StoredArrow[];
  stickers?: StoredSticker[];
  deletedNoteIds?: number[];
  deletedBoardIds?: string[];
  deletedArrowIds?: number[];
  deletedStickerIds?: number[];
  [key: string]: unknown;
}

// Incoming items win on edits; items that only exist in the DB (added on another
// device) are kept; anything tombstoned or otherwise dead is dropped.
function mergeById<T extends { id: number | string }>(
  incoming: T[] | undefined,
  current: T[] | undefined,
  isDead: (item: T) => boolean,
): T[] {
  const incomingIds = new Set((incoming ?? []).map((i) => i.id));
  return [
    ...(incoming ?? []).filter((i) => !isDead(i)),
    ...(current ?? []).filter((i) => !incomingIds.has(i.id) && !isDead(i)),
  ];
}

function unionIds<T>(a: T[] | undefined, b: T[] | undefined): T[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])];
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
      const mergedDeletedNoteIds = unionIds(current.deletedNoteIds, incoming.deletedNoteIds);
      const mergedDeletedBoardIds = unionIds(current.deletedBoardIds, incoming.deletedBoardIds);
      const mergedDeletedArrowIds = unionIds(current.deletedArrowIds, incoming.deletedArrowIds);
      const mergedDeletedStickerIds = unionIds(current.deletedStickerIds, incoming.deletedStickerIds);
      const deletedNoteSet = new Set(mergedDeletedNoteIds);
      const deletedBoardSet = new Set(mergedDeletedBoardIds);
      const deletedArrowSet = new Set(mergedDeletedArrowIds);
      const deletedStickerSet = new Set(mergedDeletedStickerIds);

      // Notes and boards: incoming wins on edits, DB-only items (added on another
      // device) are kept, tombstoned items and notes on deleted boards are dropped.
      const mergedNotes = mergeById(incoming.notes, current.notes, (n) =>
        deletedNoteSet.has(n.id) || deletedBoardSet.has(n.boardId as string));
      const mergedBoards = mergeById(incoming.boards, current.boards, (b) => deletedBoardSet.has(b.id));

      // Drawings follow the same rules; an arrow also dies with either of its cards.
      const liveNoteIds = new Set(mergedNotes.map((n) => n.id));
      const mergedArrows = mergeById(incoming.arrows, current.arrows, (a) =>
        deletedArrowSet.has(a.id) || deletedBoardSet.has(a.boardId as string) ||
        !liveNoteIds.has(a.fromNoteId as number) || !liveNoteIds.has(a.toNoteId as number));
      const mergedStickers = mergeById(incoming.stickers, current.stickers, (s) =>
        deletedStickerSet.has(s.id) || deletedBoardSet.has(s.boardId as string));

      mergedState = JSON.stringify({
        ...incoming,
        notes: mergedNotes,
        boards: mergedBoards,
        arrows: mergedArrows,
        stickers: mergedStickers,
        deletedNoteIds: mergedDeletedNoteIds,
        deletedBoardIds: mergedDeletedBoardIds,
        deletedArrowIds: mergedDeletedArrowIds,
        deletedStickerIds: mergedDeletedStickerIds,
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
