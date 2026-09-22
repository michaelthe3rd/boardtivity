// yyyy-mm-dd → "Mar 4, 2026" for display
export function isoToMDY(iso: string) {
  if (!iso || iso.length !== 10) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${months[m - 1]} ${d}, ${y}`;
}

export function formatDate(date?: string) {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function tomorrowStr() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function formatDateShort(date?: string) {
  if (!date) return "";
  if (date === todayStr()) return "Today";
  if (date === tomorrowStr()) return "Tomorrow";
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtTime(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return ` · ${h % 12 || 12}:${String(m).padStart(2, "0")}${ampm}`;
}

export function fmtFocusTime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
