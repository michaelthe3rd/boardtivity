// When to send a task's reminder email, in ms from now (null = don't send one).
// - With a due time: 1 hour before it.
// - No due time: at the user's email hour on the due date. The server skips it when that
//   day's daily/weekly outline already lists the task, so nobody gets two emails at once.
// Moments already in the past are skipped rather than sent immediately, because this runs
// again on every page load and would otherwise send duplicates.
export function dueReminderDelay(dueDate: string, dueTime: string | undefined, reminderTime: string, now = Date.now()): number | null {
  const at = dueTime
    ? new Date(`${dueDate}T${dueTime}:00`).getTime() - 3_600_000
    : new Date(`${dueDate}T${reminderTime}:00`).getTime();
  return Number.isFinite(at) && at > now ? at - now : null;
}

export function browserTimeZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
}
