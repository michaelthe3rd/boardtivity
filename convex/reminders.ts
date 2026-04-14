import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Public mutations ──────────────────────────────────────────────────────────

export const set = mutation({
  args: {
    noteId:    v.number(),
    noteTitle: v.string(),
    delayMs:   v.number(),  // ms from now; 0 = cancel
  },
  handler: async (ctx, { noteId, noteTitle, delayMs }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) return null;

    // Cancel any existing reminder for this note
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_note_and_token", q =>
        q.eq("tokenIdentifier", identity.tokenIdentifier).eq("noteId", noteId)
      )
      .first();

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { await ctx.scheduler.cancel(existing.schedulerJobId as any); } catch {}
      await ctx.db.delete(existing._id);
    }

    if (delayMs <= 0) return null;

    const remindAt = Date.now() + delayMs;

    // Insert first to get the document ID, then patch with the scheduler job ID
    const reminderId = await ctx.db.insert("reminders", {
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email,
      noteId,
      noteTitle: noteTitle.slice(0, 300),
      remindAt,
      schedulerJobId: "",
      sent: false,
    });

    const jobId = await ctx.scheduler.runAt(
      remindAt,
      internal.reminders.send,
      { reminderId }
    );

    await ctx.db.patch(reminderId, { schedulerJobId: jobId as unknown as string });
    return reminderId;
  },
});

export const cancel = mutation({
  args: { noteId: v.number() },
  handler: async (ctx, { noteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_note_and_token", q =>
        q.eq("tokenIdentifier", identity.tokenIdentifier).eq("noteId", noteId)
      )
      .first();
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { await ctx.scheduler.cancel(existing.schedulerJobId as any); } catch {}
      await ctx.db.delete(existing._id);
    }
  },
});

export const getForNote = query({
  args: { noteId: v.number() },
  handler: async (ctx, { noteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("reminders")
      .withIndex("by_note_and_token", q =>
        q.eq("tokenIdentifier", identity.tokenIdentifier).eq("noteId", noteId)
      )
      .first();
  },
});

// ── Internal ──────────────────────────────────────────────────────────────────

export const getById = internalQuery({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => ctx.db.get(reminderId),
});

export const markSent = internalMutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    await ctx.db.patch(reminderId, { sent: true });
  },
});

export const send = internalAction({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, { reminderId }) => {
    const reminder = await ctx.runQuery(internal.reminders.getById, { reminderId });
    if (!reminder || reminder.sent) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) { console.error("RESEND_API_KEY not set"); return; }
    const from = process.env.EMAIL_FROM ?? "Boardtivity <hello@boardtivity.com>";

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from,
          to: reminder.email,
          subject: `⏰ Due in 1 hour: ${reminder.noteTitle}`,
          html: buildReminderHtml(reminder.noteTitle),
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    } catch (e) {
      console.error("Reminder email failed:", e);
      return;
    }

    await ctx.runMutation(internal.reminders.markSent, { reminderId });
  },
});

function buildReminderHtml(title: string): string {
  const safe = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);">
      <tr><td style="padding:28px 32px 20px;background:#111;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5);font-weight:700;margin-bottom:6px;">Boardtivity</div>
        <div style="font-size:22px;font-weight:800;color:#fff;">Due in 1 hour</div>
      </td></tr>
      <tr><td style="padding:28px 32px 32px;">
        <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px;">⏰ ${safe}</div>
        <p style="font-size:14px;color:#888;margin:0 0 24px;line-height:1.6;">This task is due in about 1 hour. Head to Boardtivity to stay on track.</p>
        <a href="https://boardtivity.com" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">Open Boardtivity →</a>
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
        <a href="https://boardtivity.com" style="font-size:12px;color:#aaa;text-decoration:none;">Open Boardtivity</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
