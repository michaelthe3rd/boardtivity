import { action, internalAction, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { DEFAULT_PREFS } from "./emailPrefs";
import { dueEmail, ideaEmail } from "./reminders";
import { addToCalendarUrl } from "./calendarLinks";
import { APP_URL, addDays, button, escapeHtml, formatDate, formatTime, layout, localParts, relativeDue, sectionLabel, sendEmail, unsubscribeUrl } from "./emailTemplates";

// Daily and weekly outlines. A cron runs every hour; each user gets their email in the hour
// that matches their chosen time ("HH:MM", default 08:00) in their own time zone.
// The weekly outline goes out on Sundays (to plan the coming week) and replaces that day's daily email.

// Users who haven't opened the app since time zones were saved keep the old 9am-Eastern timing.
const FALLBACK_TIME_ZONE = "America/New_York";

type Task = {
  id: number;
  boardId: string | number;
  type: string;
  title: string;
  dueDate?: string;
  dueTime?: string;
  completed?: boolean;
  importance?: string;
  steps?: { title: string; done: boolean }[];
};

type Focus = { currentStreak: number; weekMinutes: number; totalMinutes: number };

// ── Who gets an email this hour ──────────────────────────────────────────────

export const recipientsForHour = internalQuery({
  args: { nowMs: v.number() },
  handler: async (ctx, { nowMs }) => {
    const byEmail = new Map<string, {
      tokenIdentifier: string; email: string; boardState: string; updatedAt: number;
      localDate: string; daily: boolean; weekly: boolean;
    }>();

    for (const user of await ctx.db.query("userBoards").take(5000)) {
      if (!user.email) continue;
      const prefs = await ctx.db
        .query("emailPrefs")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", user.tokenIdentifier))
        .first();
      const local = localParts(nowMs, prefs?.timeZone ?? FALLBACK_TIME_ZONE);
      const sendHour = Number((prefs?.reminderTime ?? DEFAULT_PREFS.reminderTime).slice(0, 2));
      if (local.hour !== sendHour) continue;

      const weekly = (prefs?.weeklyDigest ?? DEFAULT_PREFS.weeklyDigest) && local.weekday === 0 && prefs?.lastWeeklySent !== local.date;
      const daily = !weekly && (prefs?.dailyDigest ?? DEFAULT_PREFS.dailyDigest) && prefs?.lastDailySent !== local.date;
      if (!daily && !weekly) continue;

      // One email per address, even if it's linked to more than one sign-in.
      const existing = byEmail.get(user.email);
      if (!existing || user.updatedAt > existing.updatedAt) {
        byEmail.set(user.email, { tokenIdentifier: user.tokenIdentifier, email: user.email, boardState: user.boardState, updatedAt: user.updatedAt, localDate: local.date, daily, weekly });
      }
    }

    const results = [];
    for (const u of byEmail.values()) {
      results.push({ ...u, focus: await focusSummary(ctx, u.tokenIdentifier, u.localDate) });
    }
    return results;
  },
});

// Streak, last-7-days and all-time focus minutes, counted in the user's local days.
async function focusSummary(ctx: QueryCtx, tokenIdentifier: string, today: string): Promise<Focus> {
  const rows = await ctx.db
    .query("focusStats")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .take(2000);
  const weekStart = addDays(today, -6);
  let totalMinutes = 0, weekMinutes = 0;
  const active = new Set<string>();
  for (const row of rows) {
    totalMinutes += row.totalMinutes;
    if (row.date >= weekStart && row.date <= today) weekMinutes += row.totalMinutes;
    if (row.totalMinutes > 0) active.add(row.date);
  }
  // A streak still counts if today hasn't been focused yet.
  let day = active.has(today) ? today : addDays(today, -1);
  let currentStreak = 0;
  while (active.has(day)) { currentStreak++; day = addDays(day, -1); }
  return { currentStreak, weekMinutes, totalMinutes };
}

// ── Sending ──────────────────────────────────────────────────────────────────

export const sendScheduledDigests = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.emails.recipientsForHour, { nowMs: Date.now() });
    for (const user of users) {
      const { tasks, boardNames } = readBoard(user.boardState);
      const key = await ctx.runMutation(internal.emailPrefs.ensureUnsubscribeKey, { tokenIdentifier: user.tokenIdentifier });
      const email = user.weekly
        ? weeklyEmail(tasks, boardNames, user.focus, user.localDate, unsubscribeUrl(key, "weekly"))
        : dailyEmail(tasks, boardNames, user.focus, user.localDate, unsubscribeUrl(key, "daily"));

      if (email) {
        try {
          await sendEmail({ to: user.email, subject: email.subject, html: email.html, unsubscribe: email.unsubscribe });
        } catch (e) {
          console.error(`${user.weekly ? "Weekly" : "Daily"} email failed for ${user.email}:`, e);
          continue; // not stamped; logged so a failed send can be looked into
        }
      }
      // Stamp even when there was nothing to send, so we don't re-check this user again today.
      await ctx.runMutation(internal.emailPrefs.markDigestSent, { tokenIdentifier: user.tokenIdentifier, date: user.localDate, daily: user.daily, weekly: user.weekly });
    }
    return null;
  },
});

function readBoard(boardState: string): { tasks: Task[]; boardNames: Map<string, string> } {
  try {
    const { notes, boards } = JSON.parse(boardState) as { notes?: Task[]; boards?: { id: string | number; name: string }[] };
    const tasks = (notes ?? []).filter((n) =>
      n.type === "task" && !n.completed && !(n.steps?.length && n.steps.every((s) => s.done)));
    return { tasks, boardNames: new Map((boards ?? []).map((b) => [String(b.id), b.name])) };
  } catch {
    return { tasks: [], boardNames: new Map() };
  }
}

// ── Email content ────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = { High: "#c03030", Medium: "#d07030", Low: "#c8960a" };
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function byDueThenPriority(a: Task, b: Task) {
  const ad = `${a.dueDate ?? "9999"}T${a.dueTime ?? "99"}`, bd = `${b.dueDate ?? "9999"}T${b.dueTime ?? "99"}`;
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (PRIORITY_RANK[a.importance ?? ""] ?? 3) - (PRIORITY_RANK[b.importance ?? ""] ?? 3);
}

function taskRow(task: Task, boardNames: Map<string, string>, today: string, dueColor = "#8a8780") {
  const steps = task.steps ?? [];
  const meta = [
    task.dueDate ? `<span style="color:${dueColor};">${escapeHtml(relativeDue(task.dueDate, task.dueTime, today).replace(/^./, (c) => c.toUpperCase()))}</span>` : "",
    steps.length ? `${steps.filter((s) => s.done).length}/${steps.length} steps` : "",
    boardNames.size > 1 ? escapeHtml(boardNames.get(String(task.boardId)) ?? "") : "",
    task.dueDate ? `<a href="${escapeHtml(addToCalendarUrl({ title: task.title, date: task.dueDate, time: task.dueTime }))}" style="color:#8a8780;">Add to calendar</a>` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");
  return `
    <tr>
      <td width="18" valign="top" style="padding:12px 0 0;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${PRIORITY_DOT[task.importance ?? ""] ?? "#d6d3cb"};"></span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f0eee8;">
        <div style="font-size:15px;font-weight:600;color:#171613;line-height:1.4;">${escapeHtml(task.title)}</div>
        ${meta ? `<div style="font-size:12px;color:#8a8780;margin-top:2px;">${meta}</div>` : ""}
      </td>
    </tr>`;
}

function taskSection(label: string, tasks: Task[], boardNames: Map<string, string>, today: string, opts: { limit?: number; color?: string } = {}) {
  if (tasks.length === 0) return "";
  const limit = opts.limit ?? 6;
  const shown = tasks.slice(0, limit);
  const more = tasks.length - shown.length;
  return `
    <div style="margin-bottom:22px;">
      ${sectionLabel(`${label} · ${tasks.length}`, opts.color)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${shown.map((t) => taskRow(t, boardNames, today, opts.color)).join("")}</table>
      ${more > 0 ? `<div style="font-size:13px;color:#8a8780;margin-top:8px;">+ ${more} more on your board</div>` : ""}
    </div>`;
}

function focusLine(focus: Focus) {
  if (focus.weekMinutes === 0 && focus.currentStreak === 0) return "";
  const hours = (m: number) => (m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} h`);
  const bits = [
    focus.currentStreak > 0 ? `<strong style="color:#171613;">${focus.currentStreak}-day streak</strong>` : "",
    focus.weekMinutes > 0 ? `${hours(focus.weekMinutes)} focused in the last 7 days` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");
  return `<div style="font-size:13px;color:#6b675f;background:#faf9f6;border:1px solid #ece9e1;border-radius:10px;padding:10px 14px;margin-bottom:22px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#facc15;margin-right:8px;vertical-align:1px;"></span>${bits}</div>`;
}

function plural(n: number, word: string) { return `${n} ${word}${n === 1 ? "" : "s"}`; }

// Daily: only sent when something is due today, due in the next 3 days, or went overdue in the
// last week. Long-overdue tasks are still listed, but they don't trigger an email every day.
function dailyEmail(tasks: Task[], boardNames: Map<string, string>, focus: Focus, today: string, unsubscribe: string) {
  const dated = tasks.filter((t) => t.dueDate).sort(byDueThenPriority);
  const overdue = dated.filter((t) => t.dueDate! < today);
  const dueToday = dated.filter((t) => t.dueDate === today);
  const soon = dated.filter((t) => t.dueDate! > today && t.dueDate! <= addDays(today, 3));
  const recentlyOverdue = overdue.some((t) => t.dueDate! >= addDays(today, -7));
  if (!recentlyOverdue && !dueToday.length && !soon.length) return null;

  const headline = dueToday.length ? `${plural(dueToday.length, "task")} due today`
    : overdue.length ? `${plural(overdue.length, "task")} overdue`
    : `${plural(soon.length, "task")} coming up`;
  const extra = [dueToday.length && overdue.length ? `${overdue.length} overdue` : "", soon.length && (dueToday.length || overdue.length) ? `${soon.length} coming up` : ""].filter(Boolean).join(", ");

  const body = focusLine(focus)
    + taskSection("Overdue", overdue, boardNames, today, { color: "#c03030" })
    + taskSection("Due today", dueToday, boardNames, today, { color: "#b05a20" })
    + taskSection("Next 3 days", soon, boardNames, today)
    + `<div style="margin-top:6px;">${button("Open my board", APP_URL)}</div>`;

  return {
    subject: extra ? `${headline} (${extra})` : headline,
    unsubscribe,
    html: layout({
      preheader: [headline, extra].filter(Boolean).join(" · "),
      eyebrow: formatDate(today, { weekday: "long", month: "long", day: "numeric" }),
      title: headline.replace(/^./, (c) => c.toUpperCase()),
      body,
      footerNote: "Your daily outline. It only comes on days something is due.",
      unsubscribe: { url: unsubscribe, label: "Turn off daily emails" },
    }),
  };
}

// Weekly (Sundays): sent whenever there are open tasks. "Coming week" is today through next Sunday.
function weeklyEmail(tasks: Task[], boardNames: Map<string, string>, focus: Focus, today: string, unsubscribe: string) {
  if (!tasks.length) return null;
  const weekEnd = addDays(today, 7);
  const sorted = [...tasks].sort(byDueThenPriority);
  const overdue = sorted.filter((t) => t.dueDate && t.dueDate < today);
  const thisWeek = sorted.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd);
  const later = sorted.filter((t) => t.dueDate && t.dueDate > weekEnd);
  const undated = sorted.filter((t) => !t.dueDate);

  const headline = thisWeek.length ? `${plural(thisWeek.length, "task")} due this coming week`
    : overdue.length ? `${plural(overdue.length, "task")} overdue`
    : `${plural(tasks.length, "open task")} on your board`;
  const body = focusLine(focus)
    + taskSection("Overdue", overdue, boardNames, today, { color: "#c03030" })
    + taskSection("Coming week", thisWeek, boardNames, today, { limit: 8 })
    + taskSection("Later", later, boardNames, today, { limit: 4 })
    + taskSection("No due date", undated, boardNames, today, { limit: 4 })
    + `<div style="margin-top:6px;">${button("Plan my week", APP_URL)}</div>`;

  return {
    subject: thisWeek.length && overdue.length ? `Your week: ${headline}, ${overdue.length} overdue` : `Your week: ${headline}`,
    unsubscribe,
    html: layout({
      preheader: `${headline}. ${plural(tasks.length, "open task")} in total.`,
      eyebrow: `Week of ${formatDate(addDays(today, 1), { month: "long", day: "numeric" })}`,
      title: headline.replace(/^./, (c) => c.toUpperCase()),
      body,
      footerNote: "Your weekly outline, every Sunday.",
      unsubscribe: { url: unsubscribe, label: "Turn off weekly emails" },
    }),
  };
}

// ── "Send me a preview" (Settings → Email) ───────────────────────────────────

// What the user's next outline would look like today. Falls back to the weekly outline, then to
// a short "you're all set" note, so the button always sends something.
export const renderPreview = internalQuery({
  args: { tokenIdentifier: v.string(), unsubscribeKey: v.string() },
  handler: async (ctx, { tokenIdentifier, unsubscribeKey }) => {
    const [board, prefs] = await Promise.all([
      ctx.db.query("userBoards").withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier)).first(),
      ctx.db.query("emailPrefs").withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier)).first(),
    ]);
    const today = localParts(Date.now(), prefs?.timeZone ?? FALLBACK_TIME_ZONE).date;
    const { tasks, boardNames } = readBoard(board?.boardState ?? "{}");
    const focus = await focusSummary(ctx, tokenIdentifier, today);
    const email = dailyEmail(tasks, boardNames, focus, today, unsubscribeUrl(unsubscribeKey, "daily"))
      ?? weeklyEmail(tasks, boardNames, focus, today, unsubscribeUrl(unsubscribeKey, "weekly"))
      ?? allSetEmail(`${(prefs?.reminderTime ?? DEFAULT_PREFS.reminderTime).slice(0, 2)}:00`, unsubscribeUrl(unsubscribeKey, "all"));
    return { ...email, subject: `Preview: ${email.subject}` };
  },
});

export const sendPreview = action({
  args: {},
  handler: async (ctx): Promise<"sent" | "wait" | "signedOut"> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) return "signedOut";
    const allowed = await ctx.runMutation(internal.emailPrefs.claimPreview, { tokenIdentifier: identity.tokenIdentifier });
    if (!allowed) return "wait";
    const key = await ctx.runMutation(internal.emailPrefs.ensureUnsubscribeKey, { tokenIdentifier: identity.tokenIdentifier });
    const email = await ctx.runQuery(internal.emails.renderPreview, { tokenIdentifier: identity.tokenIdentifier, unsubscribeKey: key });
    await sendEmail({ to: identity.email, subject: email.subject, html: email.html, unsubscribe: email.unsubscribe });
    return "sent";
  },
});

// Sent as a preview when nothing on the board would trigger an outline yet.
function allSetEmail(sendAt: string, unsubscribe: string) {
  const row = (label: string, text: string) =>
    `<div style="padding:10px 0;border-bottom:1px solid #f0eee8;"><div style="font-size:15px;font-weight:600;color:#171613;">${escapeHtml(label)}</div><div style="font-size:13px;color:#6b675f;margin-top:2px;line-height:1.5;">${escapeHtml(text)}</div></div>`;
  const time = formatTime(sendAt);
  const body = row("Daily outline", `At ${time} on days something's overdue, due today, or due in the next 3 days.`)
    + row("Weekly outline", `Sundays at ${time}: the week ahead, in place of that day's daily outline.`)
    + row("Task reminders", "An hour before a task's due time.")
    + `<div style="margin-top:22px;">${button("Open my board", APP_URL)}</div>`;
  return {
    subject: "Your emails are set up",
    unsubscribe,
    html: layout({
      preheader: "Nothing is due yet, so here's what to expect.",
      eyebrow: "Preview",
      title: "Nothing due yet",
      subtitle: "Add a due date to a task and it'll show up here. This is what you'll get:",
      body,
      footerNote: "You asked for this preview from Settings.",
      unsubscribe: { url: unsubscribe, label: "Unsubscribe from all emails" },
    }),
  };
}

// Preview helper (run from the dashboard or `npx convex run`): renders one user's emails without sending.
export const previewDigests = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    const board = await ctx.db.query("userBoards").withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier)).first();
    if (!board) return null;
    const prefs = await ctx.db.query("emailPrefs").withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier)).first();
    const today = localParts(Date.now(), prefs?.timeZone ?? FALLBACK_TIME_ZONE).date;
    const { tasks, boardNames } = readBoard(board.boardState);
    const focus = await focusSummary(ctx, tokenIdentifier, today);
    const nextDue = [...tasks].filter((t) => t.dueDate).sort(byDueThenPriority).pop();
    return {
      daily: dailyEmail(tasks, boardNames, focus, today, "#unsubscribe"),
      weekly: weeklyEmail(tasks, boardNames, focus, today, "#unsubscribe"),
      reminder: nextDue ? dueEmail({ title: nextDue.title, note: nextDue, boardName: boardNames.get(String(nextDue.boardId)) ?? null, dueDate: nextDue.dueDate, dueTime: nextDue.dueTime, today, unsubscribe: "#unsubscribe" }) : null,
    };
  },
});

// Every email type rendered from a made-up board, for checking designs (`npx convex run emails:previewSamples`).
export const previewSamples = internalQuery({
  args: {},
  handler: async () => {
    const today = localParts(Date.now(), FALLBACK_TIME_ZONE).date;
    const d = (n: number) => addDays(today, n);
    const step = (title: string, done = false) => ({ title, done });
    const tasks: Task[] = [
      { id: 1, boardId: "1", type: "task", title: "Submit lab report", dueDate: d(-2), importance: "High", steps: [step("Run analysis", true), step("Write discussion")] },
      { id: 2, boardId: "1", type: "task", title: "Finish history essay", dueDate: d(0), dueTime: "17:00", importance: "High",
        steps: [step("Pick a thesis", true), step("Outline", true), step("Write intro"), step("Write body paragraphs"), step("Cite sources")] },
      { id: 3, boardId: "2", type: "task", title: "Pay rent", dueDate: d(0), importance: "Medium" },
      { id: 4, boardId: "1", type: "task", title: "Study for chem exam", dueDate: d(2), importance: "Medium", steps: [step("Ch. 4 review", true), step("Practice problems"), step("Flashcards")] },
      { id: 5, boardId: "2", type: "task", title: "Book dentist appointment", dueDate: d(3), importance: "Low" },
      { id: 6, boardId: "1", type: "task", title: "Group project slides", dueDate: d(5), importance: "Medium" },
      { id: 7, boardId: "2", type: "task", title: "Renew passport", dueDate: d(20), importance: "Low" },
      { id: 8, boardId: "2", type: "task", title: "Clean out garage", importance: "none" },
    ];
    const boardNames = new Map([["1", "School"], ["2", "Home"]]);
    const focus = { currentStreak: 5, weekMinutes: 412, totalMinutes: 3100 };
    const essay = tasks[1];
    return {
      reminder: dueEmail({ title: essay.title, note: essay, boardName: "School", dueDate: essay.dueDate, dueTime: essay.dueTime, today, unsubscribe: "#unsubscribe" }),
      reminderTomorrow: dueEmail({ title: tasks[3].title, note: tasks[3], boardName: "School", dueDate: d(1), today, unsubscribe: "#unsubscribe" }),
      idea: ideaEmail({ title: "App idea: shared grocery list", body: "Sync with roommates, sort by store aisle, and show who's buying what.", boardName: "Ideas", unsubscribe: "#unsubscribe" }),
      daily: dailyEmail(tasks, boardNames, focus, today, "#unsubscribe"),
      weekly: weeklyEmail(tasks, boardNames, focus, today, "#unsubscribe"),
    };
  },
});
