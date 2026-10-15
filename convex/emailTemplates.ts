// Shared pieces for every email Boardtivity sends: layout, escaping, dates, and the Resend call.
// Plain helpers only (no Convex functions), imported by reminders.ts and emails.ts.

export const APP_URL = "https://boardtivity.com";

export type EmailList = "daily" | "weekly" | "reminders" | "all";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unsubscribeUrl(key: string, list: EmailList): string {
  const site = process.env.CONVEX_SITE_URL;
  return `${site}/email/unsubscribe?k=${encodeURIComponent(key)}&list=${list}`;
}

// ── Dates (board dates are plain local "YYYY-MM-DD" / "HH:MM" strings) ──────

// Local date, hour and weekday for a moment in an IANA time zone. Falls back to UTC for unknown zones.
export function localParts(nowMs: number, timeZone: string | undefined): { date: string; hour: number; weekday: number } {
  const zones = [timeZone, "UTC"].filter(Boolean) as string[];
  for (const zone of zones) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short",
      }).formatToParts(new Date(nowMs));
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
      const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
      return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24, weekday };
    } catch {
      // try the next zone
    }
  }
  const d = new Date(nowMs);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours(), weekday: d.getUTCDay() };
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function formatTime(time: string | undefined): string {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// "today", "tomorrow", "Fri, Oct 17" — plus " at 5:00 PM" when there's a time.
export function relativeDue(dueDate: string, dueTime: string | undefined, today: string | undefined): string {
  const day = today && dueDate === today ? "today"
    : today && dueDate === addDays(today, 1) ? "tomorrow"
    : formatDate(dueDate);
  const time = formatTime(dueTime);
  return time ? `${day} at ${time}` : day;
}

// ── HTML building blocks (tables + inline styles so Gmail/Outlook render them) ──

export function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#111315;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">${escapeHtml(label)}</a>`;
}

export function sectionLabel(text: string, color = "#8a8780"): string {
  return `<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:${color};margin:0 0 8px;">${escapeHtml(text)}</div>`;
}

export function layout({ preheader, eyebrow, title, subtitle, body, footerNote, unsubscribe }: {
  preheader: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  body: string;
  footerNote: string;
  unsubscribe?: { url: string; label: string };
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#171613;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1eb;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
      <tr><td style="padding:0 4px 14px;font-size:14px;font-weight:800;letter-spacing:-.01em;color:#171613;">Boardtivity</td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e7e4dc;border-radius:16px;padding:28px 28px 30px;">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#8a8780;margin-bottom:8px;">${escapeHtml(eyebrow)}</div>
        <div style="font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-.02em;color:#171613;">${escapeHtml(title)}</div>
        ${subtitle ? `<div style="font-size:14px;color:#6b675f;margin-top:6px;line-height:1.5;">${escapeHtml(subtitle)}</div>` : ""}
        <div style="margin-top:22px;">${body}</div>
      </td></tr>
      <tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.6;color:#8a8780;text-align:center;">
        ${escapeHtml(footerNote)}<br>
        <a href="${APP_URL}" style="color:#8a8780;">Open Boardtivity</a>${unsubscribe ? ` &nbsp;·&nbsp; <a href="${unsubscribe.url}" style="color:#8a8780;">${escapeHtml(unsubscribe.label)}</a>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Sending ──────────────────────────────────────────────────────────────────

export async function sendEmail({ to, subject, html, unsubscribe }: { to: string; subject: string; html: string; unsubscribe?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  const from = process.env.EMAIL_FROM ?? "Boardtivity <hello@boardtivity.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from, to, subject, html,
      // One-click unsubscribe (RFC 8058); Gmail and Yahoo require it for recurring mail.
      ...(unsubscribe ? { headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
