import { mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addToCalendarUrl } from "./calendarLinks";
import { APP_URL, button, escapeHtml, formatDate, layout, localParts, relativeDue, sectionLabel, sendEmail, unsubscribeUrl } from "./emailTemplates";

// One reminder per note: the time the user picked for a task or idea ("Remind me"), saved on
// the note as remindAt. The server re-checks the note right before sending, so finished,
// deleted or re-timed notes never get an email.
// kind "idea" is any picked reminder (the name predates task reminders). kind "due" was the old
// automatic due-date reminder; any still queued are dropped without sending.

async function removeExisting(ctx: MutationCtx, tokenIdentifier: string, noteId: number) {
  const existing = await ctx.db
    .query("reminders")
    .withIndex("by_note_and_token", (q) => q.eq("tokenIdentifier", tokenIdentifier).eq("noteId", noteId))
    .take(10);
  for (const row of existing) {
    if (!row.sent && row.schedulerJobId) {
      try { await ctx.scheduler.cancel(row.schedulerJobId as Id<"_scheduled_functions">); } catch { /* already ran */ }
    }
    await ctx.db.delete(row._id);
  }
}

// ── Public ───────────────────────────────────────────────────────────────────

export const set = mutation({
  args: {
    noteId: v.number(),
    noteTitle: v.string(),
    delayMs: v.number(), // ms from now; <= 0 cancels
    at: v.optional(v.number()), // exact time (ms); ideas pass it so the server can match it against the note
    kind: v.optional(v.union(v.literal("due"), v.literal("idea"))),
    dueDate: v.optional(v.string()),
    dueTime: v.optional(v.string()),
  },
  handler: async (ctx, { noteId, noteTitle, delayMs, at, kind = "due", dueDate, dueTime }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) return null;

    await removeExisting(ctx, identity.tokenIdentifier, noteId);
    if (delayMs <= 0) return null;

    if (kind === "due") return null; // automatic due-date reminders are retired

    const remindAt = at !== undefined
      ? Math.max(at, Date.now() + 1000)
      : Date.now() + Math.min(delayMs, 366 * 86_400_000);
    if (remindAt > Date.now() + 366 * 86_400_000) return null;
    const reminderId = await ctx.db.insert("reminders", {
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email,
      noteId,
      noteTitle: noteTitle.slice(0, 300),
      kind,
      dueDate,
      dueTime,
      remindAt,
      schedulerJobId: "",
      sent: false,
    });
    const jobId = await ctx.scheduler.runAt(remindAt, internal.reminders.send, { reminderId });
    await ctx.db.patch(reminderId, { schedulerJobId: jobId });
    return reminderId;
  },
});

export const cancel = mutation({
  args: { noteId: v.number() },
  handler: async (ctx, { noteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    await removeExisting(ctx, identity.tokenIdentifier, noteId);
    return null;
  },
});

// ── Internal ─────────────────────────────────────────────────────────────────

export type BoardNote = {
  id: number; boardId: string | number; type: string; title: string; body?: string;
  dueDate?: string; dueTime?: string; remindAt?: number; importance?: string; completed?: boolean;
  steps?: { title: string; done: boolean }[];
};

// Everything the sender needs, read in one transaction: the reminder, the note as it is now, and prefs.
export const loadForSend = internalQuery({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const reminder = await ctx.db.get(reminderId);
    if (!reminder) return null;
    const [board, prefs] = await Promise.all([
      ctx.db.query("userBoards").withIndex("by_token", (q) => q.eq("tokenIdentifier", reminder.tokenIdentifier)).first(),
      ctx.db.query("emailPrefs").withIndex("by_token", (q) => q.eq("tokenIdentifier", reminder.tokenIdentifier)).first(),
    ]);
    let note: BoardNote | null = null;
    let boardName: string | null = null;
    if (board) {
      try {
        const state = JSON.parse(board.boardState) as { notes?: BoardNote[]; boards?: { id: string | number; name: string }[] };
        note = state.notes?.find((n) => n.id === reminder.noteId) ?? null;
        boardName = note ? state.boards?.find((b) => String(b.id) === String(note!.boardId))?.name ?? null : null;
      } catch { /* unreadable board: fall back to the saved title */ }
    }
    return {
      reminder,
      hasBoard: !!board,
      note,
      boardName,
      timeZone: prefs?.timeZone,
    };
  },
});

export const finish = internalMutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const row = await ctx.db.get(reminderId);
    if (row) await ctx.db.delete(reminderId);
    return null;
  },
});

export const send = internalAction({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const data = await ctx.runQuery(internal.reminders.loadForSend, { reminderId });
    if (!data || data.reminder.sent) return null;
    const { reminder, note, hasBoard, boardName } = data;

    // Skip anything that no longer applies: old automatic reminders, and notes that were deleted,
    // finished, or had their reminder changed or removed. If we can't see the board, trust the row.
    const done = !!note && note.type === "task" && (!!note.completed || (!!note.steps?.length && note.steps.every((s) => s.done)));
    const skip = (reminder.kind ?? "due") === "due" || (hasBoard && (!note || note.remindAt !== reminder.remindAt || done));
    if (skip) {
      await ctx.runMutation(internal.reminders.finish, { reminderId });
      return null;
    }

    const key = await ctx.runMutation(internal.emailPrefs.ensureUnsubscribeKey, { tokenIdentifier: reminder.tokenIdentifier });
    const title = note?.title || reminder.noteTitle;
    const unsubscribe = unsubscribeUrl(key, "all");
    const email = note?.type === "task"
      ? taskEmail({ title, note, boardName, today: localParts(Date.now(), data.timeZone).date, unsubscribe })
      : ideaEmail({ title, body: note?.body, boardName, unsubscribe });

    try {
      await sendEmail({ to: reminder.email, subject: email.subject, html: email.html, unsubscribe: email.unsubscribe });
    } catch (e) {
      console.error("Reminder email failed:", e);
      return null; // keep the row so it can be inspected; it won't be retried automatically
    }
    await ctx.runMutation(internal.reminders.finish, { reminderId });
    return null;
  },
});

// ── Email content ────────────────────────────────────────────────────────────

export function taskEmail({ title, note, boardName, today, unsubscribe }: {
  title: string; note: BoardNote | null; boardName: string | null; today: string; unsubscribe: string;
}) {
  const dueDate = note?.dueDate, dueTime = note?.dueTime;
  const when = dueDate ? relativeDue(dueDate, dueTime, today) : null;
  const steps = note?.steps ?? [];
  const done = steps.filter((s) => s.done).length;
  const nextSteps = steps.filter((s) => !s.done).slice(0, 4);
  const priority = note?.importance && note.importance !== "none" ? `${note.importance} priority` : null;
  const meta = [boardName, priority, steps.length ? `${done} of ${steps.length} steps done` : null].filter(Boolean).join(" · ");
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f6;border:1px solid #ece9e1;border-radius:12px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:17px;font-weight:700;color:#171613;line-height:1.35;">${escapeHtml(title)}</div>
        ${meta ? `<div style="font-size:13px;color:#8a8780;margin-top:4px;">${escapeHtml(meta)}</div>` : ""}
        ${nextSteps.length ? `<div style="margin-top:14px;">${sectionLabel("Next steps")}${nextSteps.map((s) => `<div style="font-size:14px;color:#3d3a34;line-height:1.5;padding:3px 0;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1.5px solid #b9b5ab;margin-right:9px;vertical-align:0;"></span>${escapeHtml(s.title)}</div>`).join("")}</div>` : ""}
      </td></tr>
    </table>
    <div style="margin-top:22px;">
      ${button("Open my board", APP_URL)}
      ${dueDate ? `&nbsp;&nbsp;<a href="${escapeHtml(addToCalendarUrl({ title, date: dueDate, time: dueTime }))}" style="display:inline-block;font-size:14px;font-weight:700;color:#171613;text-decoration:none;padding:11px 18px;border:1px solid #dcd8ce;border-radius:10px;">Add to calendar</a>` : ""}
    </div>`;

  return {
    subject: when ? `Reminder: ${title} (due ${when})` : `Reminder: ${title}`,
    unsubscribe,
    html: layout({
      preheader: when ? `${title} is due ${when}.` : `You asked to be reminded about "${title}".`,
      eyebrow: "Reminder",
      title: when ? `Due ${when}` : "You asked us to remind you",
      subtitle: dueDate && when!.startsWith("tomorrow") ? formatDate(dueDate, { weekday: "long", month: "long", day: "numeric" }) : undefined,
      body,
      footerNote: "You set this reminder on one of your tasks.",
      unsubscribe: { url: unsubscribe, label: "Unsubscribe from all emails" },
    }),
  };
}

export function ideaEmail({ title, body, boardName, unsubscribe }: { title: string; body?: string; boardName: string | null; unsubscribe: string }) {
  const excerpt = body && body.length > 280 ? `${body.slice(0, 280)}…` : body;
  const html = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f6;border:1px solid #ece9e1;border-radius:12px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:17px;font-weight:700;color:#171613;line-height:1.35;">${escapeHtml(title)}</div>
        ${boardName ? `<div style="font-size:13px;color:#8a8780;margin-top:4px;">${escapeHtml(boardName)}</div>` : ""}
        ${excerpt ? `<div style="font-size:14px;color:#3d3a34;line-height:1.6;margin-top:10px;white-space:pre-wrap;">${escapeHtml(excerpt)}</div>` : ""}
      </td></tr>
    </table>
    <div style="margin-top:22px;">${button("Open my board", APP_URL)}</div>`;
  return {
    subject: `Reminder: ${title}`,
    unsubscribe,
    html: layout({
      preheader: `You asked to be reminded about "${title}".`,
      eyebrow: "Reminder",
      title: "You asked us to remind you",
      body: html,
      footerNote: "You set this reminder on one of your ideas.",
      unsubscribe: { url: unsubscribe, label: "Unsubscribe from all emails" },
    }),
  };
}
