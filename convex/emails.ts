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
}

interface BoardState {
  boards: { id: number; name: string }[];
  notes: Task[];
}

type DigestType = "daily" | "weekly" | "dueSoon";

// ─── Query: get users eligible for a given digest ────────────────────────────

export const getUsersForDigest = internalQuery({
  args: { digestType: v.union(v.literal("daily"), v.literal("weekly"), v.literal("dueSoon")) },
  handler: async (ctx, { digestType }) => {
    const users = await ctx.db.query("userBoards").take(2000);
    const result: { email: string; boardState: string; name?: string }[] = [];

    for (const user of users) {
      if (!user.email) continue;

      const prefs = await ctx.db
        .query("emailPrefs")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", user.tokenIdentifier))
        .first();

      // Default: all on
      const daily = prefs ? prefs.dailyDigest : true;
      const weekly = prefs ? prefs.weeklyDigest : true;
      const dueSoon = prefs ? prefs.dueSoonReminder : true;

      const enabled =
        digestType === "daily" ? daily :
        digestType === "weekly" ? weekly :
        dueSoon;

      if (!enabled) continue;
      result.push({ email: user.email, boardState: user.boardState });
    }

    return result;
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
    return notes.filter(
      (n) => n.type === "task" && !n.completed && !(n.steps.length > 0 && n.steps.every((s) => s.done))
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
  return `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:6px;height:6px;border-radius:50%;background:${isHighlighted ? highlight : (task.importance !== "none" ? impColor : "#ccc")};margin-top:6px;flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:${isHighlighted ? "#111" : "#222"};">${task.title}</div>
            ${dueLabel ? `<div style="font-size:12px;color:${isHighlighted ? highlight : "#999"};margin-top:2px;">${dueLabel}</div>` : ""}
          </div>
        </div>
      </td>
    </tr>`;
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
    const tomorrow = tomorrowUTC();
    const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    for (const user of users) {
      const tasks = pendingTasks(user.boardState);

      let body: string;
      let subject: string;

      if (tasks.length === 0) {
        subject = `No tasks for today — ${dateLabel}`;
        body = `
          <div style="text-align:center;padding:24px 0;">
            <div style="font-size:32px;margin-bottom:12px;">✓</div>
            <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px;">You're all clear today!</div>
            <p style="font-size:14px;color:#888;margin:0 0 24px;line-height:1.6;">No tasks on your plate right now. A great time to plan ahead.</p>
            <a href="https://boardtivity.com" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">Add tasks for today →</a>
          </div>`;
      } else {
        subject = `Your tasks for ${dateLabel}`;
        const dueToday = tasks.filter((t) => t.dueDate === today);
        const dueTomorrow = tasks.filter((t) => t.dueDate === tomorrow);
        const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);
        const upcoming = tasks.filter((t) => !t.dueDate || t.dueDate > tomorrow);
        body =
          taskSection("Overdue", overdue, "#c03030") +
          taskSection("Due Today", dueToday, "#d06010") +
          taskSection("Due Tomorrow", dueTomorrow, "#888") +
          taskSection("Upcoming", upcoming) +
          `<p style="font-size:13px;color:#aaa;margin:20px 0 0;">You have ${tasks.length} pending task${tasks.length !== 1 ? "s" : ""} total.</p>`;
      }

      await sendEmail(
        user.email,
        subject,
        emailWrapper("Daily Task Outline", dateLabel, body)
      );
    }
  },
});

// ─── Weekly digest ────────────────────────────────────────────────────────────

export const sendWeeklyDigests = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.emails.getUsersForDigest, { digestType: "weekly" });
    const today = todayUTC();
    const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    for (const user of users) {
      const tasks = pendingTasks(user.boardState);

      let body: string;
      let subject: string;

      if (tasks.length === 0) {
        subject = "Clean slate this week — Boardtivity";
        body = `
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
        body =
          (overdue.length > 0 ? taskSection("Overdue", overdue, "#c03030") : "") +
          (withDue.length > 0 ? taskSection("Scheduled", withDue) : "") +
          (noDue.length > 0 ? taskSection("No due date", noDue) : "") +
          `<p style="font-size:13px;color:#aaa;margin:20px 0 0;">${tasks.length} pending task${tasks.length !== 1 ? "s" : ""} across all boards.</p>`;
      }

      await sendEmail(
        user.email,
        subject,
        emailWrapper("Weekly Task Outline", `Week of ${dateLabel}`, body)
      );
    }
  },
});

// ─── Due-soon reminder ────────────────────────────────────────────────────────

export const sendDueSoonReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.emails.getUsersForDigest, { digestType: "dueSoon" });
    const today = todayUTC();
    const tomorrow = tomorrowUTC();

    for (const user of users) {
      const tasks = pendingTasks(user.boardState);
      const dueToday = tasks.filter((t) => t.dueDate === today);
      const dueTomorrow = tasks.filter((t) => t.dueDate === tomorrow);

      if (dueToday.length === 0 && dueTomorrow.length === 0) continue;

      const total = dueToday.length + dueTomorrow.length;
      const subject =
        dueToday.length === 1 && dueTomorrow.length === 0
          ? `Reminder: "${dueToday[0].title}" is due today`
          : `${total} task${total !== 1 ? "s" : ""} due today or tomorrow`;

      const body =
        taskSection("Due Today", dueToday, "#d06010") +
        taskSection("Due Tomorrow", dueTomorrow, "#888");

      await sendEmail(
        user.email,
        subject,
        emailWrapper("Tasks Due Soon", "A quick heads-up on upcoming tasks", body)
      );
    }
  },
});
