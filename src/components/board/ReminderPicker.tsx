"use client";

import { useState } from "react";
import type { ThemeMode } from "@/lib/board";
import { pageText, muted, border, paper } from "@/lib/ui";

// Picks when to be emailed about a task or idea. Value is a timestamp (ms) or null for no reminder.
// Shared by the desktop composer + idea detail and the phone add/edit sheets.

function at(dayOffset: number, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatReminder(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const tomorrow = new Date(); tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

export default function ReminderPicker({ theme, value, onChange, morningTime = "08:00", signedIn, large = false, hint }: {
  theme: ThemeMode;
  value: number | null;
  onChange: (value: number | null) => void;
  morningTime?: string; // the user's email time, used for "Tomorrow" and "Next week"
  signedIn: boolean;
  large?: boolean;
  hint?: string; // shown under the picker, e.g. that changes apply on Save
}) {
  const [custom, setCustom] = useState(false);
  const active = value !== null && value > Date.now() ? value : null;
  const evening = at(0, "18:00");
  const presets = [
    { label: "In 1 hour", ms: Date.now() + 3_600_000 },
    ...(evening - Date.now() > 2 * 3_600_000 ? [{ label: "This evening", ms: evening }] : []),
    { label: "Tomorrow", ms: at(1, morningTime) },
    { label: "Next week", ms: at(7, morningTime) },
  ];
  const fontSize = large ? 13 : 12;
  const chip = (selected: boolean) => ({
    padding: large ? "7px 12px" : "5px 11px", borderRadius: 999, fontSize, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    border: selected ? `1.5px solid ${pageText(theme)}` : `1px solid ${border(theme)}`,
    backgroundColor: selected ? (theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)") : "transparent",
    color: selected ? pageText(theme) : muted(theme),
  });

  if (!signedIn) {
    return <div style={{ fontSize, color: muted(theme), opacity: .75 }}>Sign in to get reminder emails.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {active !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: large ? 14 : 13, fontWeight: 600, color: pageText(theme) }}>
          <BellIcon size={large ? 14 : 13} />
          <span style={{ flex: 1 }}>Email reminder {formatReminder(active)}</span>
          <button type="button" onClick={() => { onChange(null); setCustom(false); }} style={{ background: "none", border: "none", color: muted(theme), fontSize, fontWeight: 600, cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" }}>Remove</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => { onChange(p.ms); setCustom(false); }} style={chip(false)}>{p.label}</button>
        ))}
        <button type="button" onClick={() => setCustom((c) => !c)} style={chip(custom)}>Custom time</button>
      </div>
      {custom && (
        <input
          type="datetime-local"
          aria-label="Reminder time"
          min={toLocalInput(Date.now())}
          value={active ? toLocalInput(active) : ""}
          onChange={(e) => {
            const ms = e.target.value ? new Date(e.target.value).getTime() : NaN;
            if (Number.isFinite(ms) && ms > Date.now()) onChange(ms);
          }}
          style={{ height: large ? 42 : 36, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: paper(theme), color: pageText(theme), fontSize: large ? 15 : 13, padding: "0 10px", fontFamily: "inherit", colorScheme: theme === "dark" ? "dark" : "light", maxWidth: 260 }}
        />
      )}
      {hint && <div style={{ fontSize: large ? 12 : 11, color: muted(theme), opacity: .8 }}>{hint}</div>}
    </div>
  );
}

export function BellIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
