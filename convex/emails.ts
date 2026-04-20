import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  title: string;
  done: boolean;
  minutes?: number;
}

interface Task {
  id: number;
  boardId: number;
  type: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  steps: Step[];
  importance: string;
  totalTimeSpent?: number;
}

interface BoardState {
  boards: { id: number; name: string }[];
  notes: Task[];
}

interface FocusData {
  currentStreak: number;
  totalMinutes: number;
  totalTasksCompleted: number;
  weekMinutes: number;
}

type DigestType = "daily" | "weekly";

// ─── Query: get users eligible for a given digest ────────────────────────────

export const getUsersForDigest = internalQuery({
  args: { digestType: v.union(v.literal("daily"), v.literal("weekly")) },
  handler: async (ctx, { digestType }) => {
    const users = await ctx.db.query("userBoards").take(2000);
    const byEmail = new Map<string, { email: string; boardState: string; updatedAt: number; tokenIdentifier: string }>();

    for (const user of users) {
      if (!user.email) continue;

      const prefs = await ctx.db
        .query("emailPrefs")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", user.tokenIdentifier))
        .first();

      const enabled = digestType === "daily"
        ? (prefs ? prefs.dailyDigest : true)
        : (prefs ? prefs.weeklyDigest : true);

      if (!enabled) continue;

      const existing = byEmail.get(user.email);
      if (!existing || user.updatedAt > existing.updatedAt) {
        byEmail.set(user.email, { email: user.email, boardState: user.boardState, updatedAt: user.updatedAt, tokenIdentifier: user.tokenIdentifier });
      }
    }

    // Fetch focus stats for each user
    const results = [];
    for (const u of byEmail.values()) {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date();
      weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
      const weekAgoStr = weekAgo.toISOString().slice(0, 10);

      const allRows = await ctx.db
        .query("focusStats")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", u.tokenIdentifier))
        .take(10000);

      let totalMinutes = 0;
      let totalTasksCompleted = 0;
      let weekMinutes = 0;
      for (const row of allRows) {
        totalMinutes += row.totalMinutes;
        totalTasksCompleted += row.tasksCompleted;
        if (row.date >= weekAgoStr) weekMinutes += row.totalMinutes;
      }

      // Streak: consecutive days ending today
      const activeDates = new Set(allRows.filter(r => r.totalMinutes > 0).map(r => r.date));
      let currentStreak = 0;
      for (let i = 0; ; i++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        if (activeDates.has(dateStr)) {
          currentStreak++;
        } else {
          if (i === 0 && dateStr === today) continue;
          break;
        }
      }

      results.push({ email: u.email, boardState: u.boardState, focus: { currentStreak, totalMinutes, totalTasksCompleted, weekMinutes } });
    }

    return results;
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function formatDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function pendingTasks(boardState: string): Task[] {
  try {
    const { notes } = JSON.parse(boardState) as BoardState;
    if (!Array.isArray(notes)) return [];
    return notes.filter(
      (n) => n.type === "task" && !n.completed &&
        !(Array.isArray(n.steps) && n.steps.length > 0 && n.steps.every((s) => s.done))
    );
  } catch {
    return [];
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Boardtivity <hello@boardtivity.com>";
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

// ─── Email HTML builders ──────────────────────────────────────────────────────

function taskRow(task: Task, highlight?: string) {
  const dueLabel = task.dueDate ? formatDate(task.dueDate) : "";
  const impColor = task.importance === "High" ? "#c03030" : task.importance === "Medium" ? "#b07010" : "#4a7040";
  const isHighlighted = !!highlight;
  const timeLabel = (task.totalTimeSpent ?? 0) > 0
    ? `<span style="font-size:11px;color:#aaa;margin-left:6px;">${task.totalTimeSpent! >= 60 ? `${Math.floor(task.totalTimeSpent! / 60)}h ${task.totalTimeSpent! % 60 > 0 ? `${task.totalTimeSpent! % 60}m` : ""}` : `${task.totalTimeSpent}m`} focused</span>`
    : "";
  return `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:6px;height:6px;border-radius:50%;background:${isHighlighted ? highlight : (task.importance !== "none" ? impColor : "#ccc")};margin-top:6px;flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:${isHighlighted ? "#111" : "#222"};">${task.title}${timeLabel}</div>
            ${dueLabel ? `<div style="font-size:12px;color:${isHighlighted ? highlight : "#999"};margin-top:2px;">${dueLabel}</div>` : ""}
          </div>
        </div>
      </td>
    </tr>`;
}

function focusSection(focus: FocusData, type: "daily" | "weekly") {
  if (focus.totalMinutes === 0 && focus.currentStreak === 0) return "";

  const streakBolt = focus.currentStreak > 0
    ? `<span style="display:inline-block;background:#fef9c3;color:#854d0e;font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px;margin-right:8px;">⚡ ${focus.currentStreak}d streak</span>`
    : "";

  const weekMins = focus.weekMinutes;
  const weekLabel = weekMins < 60 ? `${weekMins}m` : `${Math.round(weekMins / 60 * 10) / 10}h`;
  const totalMins = focus.totalMinutes;
  const totalLabel = totalMins < 60 ? `${totalMins}m` : `${Math.round(totalMins / 60 * 10) / 10}h`;

  const statLine = type === "daily"
    ? `${weekLabel} focused this week · ${focus.totalTasksCompleted} tasks completed all time`
    : `${weekLabel} focused this week · ${totalLabel} total`;

  return `
    <div style="background:#f9f9f7;border-radius:10px;padding:14px 16px;margin-bottom:20px;border:1px solid #ebebeb;">
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#999;margin-bottom:8px;">Focus</div>
      <div>${streakBolt}<span style="font-size:13px;color:#555;">${statLine}</span></div>
    </div>`;
}

function emailWrapper(title: string, subtitle: string, body: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);">
      <tr><td style="padding:28px 32px 20px;background:#111;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5);font-weight:700;margin-bottom:6px;">Boardtivity</div>
        <div style="font-size:22px;font-weight:800;color:#fff;">${title}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.55);margin-top:4px;">${subtitle}</div>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;">
        ${body}
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
        <a href="https://boardtivity.com" style="font-size:12px;color:#aaa;text-decoration:none;">Open Boardtivity</a>
        <span style="color:#ddd;margin:0 8px;">·</span>
        <a href="https://boardtivity.com" style="font-size:12px;color:#aaa;text-decoration:none;">Manage email preferences</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function taskSection(label: string, tasks: Task[], highlightColor?: string) {
  if (tasks.length === 0) return "";
  return `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#999;margin-bottom:8px;">${label}</div>
      <table width="100%" cellpadding="0" cellspacing="0">${tasks.map((t) => taskRow(t, highlightColor)).join("")}</table>
    </div>`;
}

// ─── Daily digest ─────────────────────────────────────────────────────────────

export const sendDailyDigests = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.emails.getUsersForDigest, { digestType: "daily" });
    const today = todayUTC();
    const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    for (const user of users) {
      const tasks = pendingTasks(user.boardState);
      const focusBlock = focusSection(user.focus, "daily");

      let body: string;
      let subject: string;

      if (tasks.length === 0) {
        subject = `No tasks for today — ${dateLabel}`;
        body = focusBlock + `
          <div style="text-align:center;padding:24px 0;">
            <div style="font-size:32px;margin-bottom:12px;">✓</div>
            <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px;">You're all clear today!</div>
            <p style="font-size:14px;color:#888;margin:0 0 24px;line-height:1.6;">No tasks on your plate right now. A great time to plan ahead.</p>
            <a href="https://boardtivity.com" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">Add tasks for today →</a>
          </div>`;
      } else {
        subject = `Your tasks for ${dateLabel}`;
        const dueToday = tasks.filter((t) => t.dueDate === today);
        const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
        const upcomingAll = tasks
          .filter((t) => !t.dueDate || t.dueDate > today)
          .filter((t) => t.dueDate !== today)
          .sort((a, b) => {
            if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
          });
        const upcoming3 = upcomingAll.slice(0, 3);
        const remaining = upcomingAll.length - upcoming3.length;
        body = focusBlock +
          taskSection("Overdue", overdue, "#c03030") +
          taskSection("Due Today", dueToday, "#cc1f1f") +
          taskSection("Upcoming", upcoming3) +
          (remaining > 0 ? `<p style="font-size:13px;color:#aaa;margin:4px 0 0;">+${remaining} more task${remaining !== 1 ? "s" : ""} — <a href="https://boardtivity.com" style="color:#aaa;">view all</a></p>` : "") +
          `<p style="font-size:13px;color:#aaa;margin:16px 0 0;">${tasks.length} pending task${tasks.length !== 1 ? "s" : ""} total.</p>`;
      }

      try {
        await sendEmail(user.email, subject, emailWrapper("Daily Task Outline", dateLabel, body));
      } catch (e) {
        console.error(`Daily digest failed for ${user.email}:`, e);
      }
    }
  },
});

// ─── Weekly digest ────────────────────────────────────────────────────────────

export const sendWeeklyDigests = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.emails.getUsersForDigest, { digestType: "weekly" });
    const today = todayUTC();
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - daysToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const dateLabel = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    for (const user of users) {
      const tasks = pendingTasks(user.boardState);
      const focusBlock = focusSection(user.focus, "weekly");

      let body: string;
      let subject: string;

      if (tasks.length === 0) {
        subject = "Clean slate this week — Boardtivity";
        body = focusBlock + `
          <div style="text-align:center;padding:24px 0;">
            <div style="font-size:32px;margin-bottom:12px;">🗓</div>
            <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px;">Nothing on the books yet!</div>
            <p style="font-size:14px;color:#888;margin:0 0 24px;line-height:1.6;">Your task list is empty this week. Head over to Boardtivity to plan out your week.</p>
            <a href="https://boardtivity.com" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">Plan your week →</a>
          </div>`;
      } else {
        subject = `Your week ahead — ${tasks.length} task${tasks.length !== 1 ? "s" : ""} pending`;
        const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
        const withDue = tasks.filter((t) => t.dueDate && t.dueDate >= today).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
        const noDue = tasks.filter((t) => !t.dueDate);
        body = focusBlock +
          (overdue.length > 0 ? taskSection("Overdue", overdue, "#c03030") : "") +
          (withDue.length > 0 ? taskSection("Scheduled", withDue) : "") +
          (noDue.length > 0 ? taskSection("No due date", noDue) : "") +
          `<p style="font-size:13px;color:#aaa;margin:20px 0 0;">${tasks.length} pending task${tasks.length !== 1 ? "s" : ""} across all boards.</p>`;
      }

      try {
        await sendEmail(user.email, subject, emailWrapper("Weekly Task Outline", `Week of ${dateLabel}`, body));
      } catch (e) {
        console.error(`Weekly digest failed for ${user.email}:`, e);
      }
    }
  },
});
