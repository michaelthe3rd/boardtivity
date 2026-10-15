// When to send a task's due-date reminder email, in ms from now (null = don't send one).
// - No due time: at the user's reminder time on the due date.
// - With a due time: at the reminder time on the due date, or 1 hour before the due time
//   if that's earlier (so a 7am task isn't reminded at 8am).
// Moments already in the past are skipped rather than sent immediately, because this runs
// again on every page load and would otherwise send duplicates.
export function dueReminderDelay(dueDate: string, dueTime: string | undefined, reminderTime: string, now = Date.now()): number | null {
  const onDueDay = new Date(`${dueDate}T${reminderTime}:00`).getTime();
  let at = onDueDay;
  if (dueTime) {
    const hourBefore = new Date(`${dueDate}T${dueTime}:00`).getTime() - 3_600_000;
    at = Math.min(onDueDay, hourBefore);
  }
  return Number.isFinite(at) && at > now ? at - now : null;
}

export function browserTimeZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
}
