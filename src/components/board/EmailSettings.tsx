"use client";

import type { ThemeMode } from "@/lib/board";
import { pageText, muted, border, paper } from "@/lib/ui";
import { useHome } from "@/components/home/HomeContext";

type Key = "dueSoonReminder" | "dailyDigest" | "weeklyDigest";

const ROWS: { key: Key; label: string; hint: string }[] = [
  { key: "dueSoonReminder", label: "Due-date reminders", hint: "An email before a task is due, with a link to add it to your calendar." },
  { key: "dailyDigest", label: "Daily outline", hint: "What's overdue, due today, and due in the next 3 days. Only sent when something's due." },
  { key: "weeklyDigest", label: "Weekly outline", hint: "Sundays: your coming week. Replaces that day's daily outline." },
];

// The Email section of Settings, shared by the desktop panel and the phone sheet.
export default function EmailSettings({ theme, large = false }: { theme: ThemeMode; large?: boolean }) {
  const { emailPrefs, toggleEmailPref, updateReminderTime, user } = useHome();
  const labelSize = large ? 15 : 13;
  const hintSize = large ? 12 : 11;
  const rowPad = large ? 14 : 10;
  const timeZone = emailPrefs?.timeZone?.split("/").pop()?.replace(/_/g, " ");

  return (
    <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: large ? 4 : 2 }}>Email</div>

      {ROWS.map(({ key, label, hint }) => {
        const enabled = emailPrefs ? emailPrefs[key] : true;
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: `${rowPad}px 0`, borderBottom: large ? `1px solid ${border(theme)}` : "none" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: labelSize, color: pageText(theme), fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: hintSize, color: muted(theme), lineHeight: 1.45, marginTop: 2, opacity: .85 }}>{hint}</div>
            </div>
            <Toggle theme={theme} on={enabled} large={large} label={label} onClick={() => toggleEmailPref(key, enabled)} />
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: `${rowPad}px 0` }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: labelSize, color: pageText(theme), fontWeight: 600 }}>Send at</div>
          <div style={{ fontSize: hintSize, color: muted(theme), lineHeight: 1.45, marginTop: 2, opacity: .85 }}>
            Outlines arrive at this time{timeZone ? ` (${timeZone} time)` : ""}. Tasks with a due time are reminded an hour before if that&apos;s earlier.
          </div>
        </div>
        <input
          type="time"
          aria-label="Email time"
          value={emailPrefs?.reminderTime ?? "08:00"}
          onChange={(e) => updateReminderTime(e.target.value)}
          style={{ flexShrink: 0, fontSize: labelSize, fontWeight: 600, color: pageText(theme), backgroundColor: paper(theme), border: `1px solid ${border(theme)}`, borderRadius: 8, padding: large ? "5px 8px" : "4px 8px", cursor: "pointer", colorScheme: theme === "dark" ? "dark" : "light" }}
        />
      </div>

      <p style={{ fontSize: hintSize, color: muted(theme), margin: "4px 0 0", lineHeight: 1.5 }}>
        Sent to {user?.emailAddresses?.[0]?.emailAddress ?? "your email"}. Every email has a one-click unsubscribe link.
      </p>
    </div>
  );
}

function Toggle({ theme, on, large, label, onClick }: { theme: ThemeMode; on: boolean; large: boolean; label: string; onClick: () => void }) {
  const w = large ? 46 : 42, h = large ? 26 : 24, knob = 18, inset = (h - knob) / 2;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{
        flexShrink: 0, width: w, height: h, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", transition: "background-color .18s",
        backgroundColor: on ? (theme === "dark" ? "#4a9eff" : "#2563eb") : (theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"),
      }}
    >
      <span style={{ position: "absolute", top: inset, left: on ? w - knob - inset : inset, width: knob, height: knob, borderRadius: "50%", backgroundColor: "#fff", transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}
