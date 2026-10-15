// "Add to calendar" links for tasks in emails. Plain helpers (no Convex functions).
// Emails link to one page (/calendar/add) that offers Google, Apple and Outlook; the event
// details travel in the URL, so nothing is stored. Times are "floating" local times, which
// every calendar reads in the viewer's own time zone, matching how the board stores them.

export type CalendarTask = { title: string; date: string; time?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseCalendarTask(params: URLSearchParams): CalendarTask | null {
  const title = (params.get("title") ?? "").trim().slice(0, 200);
  const date = params.get("date") ?? "";
  const time = params.get("time") ?? undefined;
  if (!title || !DATE_RE.test(date) || (time && !TIME_RE.test(time))) return null;
  return { title, date, time: time || undefined };
}

export function addToCalendarUrl(task: CalendarTask): string {
  const q = new URLSearchParams({ title: task.title, date: task.date, ...(task.time ? { time: task.time } : {}) });
  return `${process.env.CONVEX_SITE_URL}/calendar/add?${q}`;
}

export function icsUrl(task: CalendarTask): string {
  const q = new URLSearchParams({ title: task.title, date: task.date, ...(task.time ? { time: task.time } : {}) });
  return `${process.env.CONVEX_SITE_URL}/calendar/event.ics?${q}`;
}

// A timed task becomes a 30-minute event starting at its due time; an undated-time task is all-day.
function span(task: CalendarTask) {
  const compactDate = task.date.replace(/-/g, "");
  if (!task.time) {
    const [y, m, d] = task.date.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    return { allDay: true, start: compactDate, end: next.replace(/-/g, ""), startIso: task.date, endIso: next };
  }
  const [h, min] = task.time.split(":").map(Number);
  const endTotal = h * 60 + min + 30;
  const endDay = endTotal >= 1440 ? (() => { const [y, m, d] = task.date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10); })() : task.date;
  const endTime = `${String(Math.floor((endTotal % 1440) / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
  return {
    allDay: false,
    start: `${compactDate}T${task.time.replace(":", "")}00`,
    end: `${endDay.replace(/-/g, "")}T${endTime.replace(":", "")}00`,
    startIso: `${task.date}T${task.time}:00`,
    endIso: `${endDay}T${endTime}:00`,
  };
}

const DETAILS = "Added from Boardtivity. https://boardtivity.com";

export function googleCalendarUrl(task: CalendarTask): string {
  const s = span(task);
  const q = new URLSearchParams({ action: "TEMPLATE", text: task.title, dates: `${s.start}/${s.end}`, details: DETAILS });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function outlookCalendarUrl(task: CalendarTask): string {
  const s = span(task);
  const q = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: task.title, startdt: s.startIso, enddt: s.endIso, body: DETAILS, ...(s.allDay ? { allday: "true" } : {}) });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
}

function icsText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// .ics for Apple Calendar (and Outlook desktop). Includes an alert so it works as a reminder:
// 1 hour before a timed task, 9am on the day for an all-day one.
export function buildIcs(task: CalendarTask): string {
  const s = span(task);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const uid = `${s.start}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}@boardtivity.com`;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Boardtivity//Tasks//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    s.allDay ? `DTSTART;VALUE=DATE:${s.start}` : `DTSTART:${s.start}`,
    s.allDay ? `DTEND;VALUE=DATE:${s.end}` : `DTEND:${s.end}`,
    `SUMMARY:${icsText(task.title)}`,
    `DESCRIPTION:${icsText(DETAILS)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(task.title)}`, s.allDay ? "TRIGGER:PT9H" : "TRIGGER:-PT1H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
