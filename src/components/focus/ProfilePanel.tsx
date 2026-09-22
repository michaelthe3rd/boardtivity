"use client";

import type { CSSProperties } from "react";
import { pageText, muted, border} from "@/lib/ui";
import { fmtFocusTime } from "@/lib/dates";
import { useHome } from "@/components/home/HomeContext";

// Account panel with focus streak, totals and the last-14-days chart.
export default function ProfilePanel() {
  const {
    theme, profileOpen, setProfileOpen, localToday, focusStatsData,
  } = useHome();
  if (!(profileOpen)) return null;
  const stats = focusStatsData;
  const streak = stats?.currentStreak ?? 0;
  const totalMins = stats?.totalMinutes ?? 0;
  const totalHoursDisplay = fmtFocusTime(totalMins);
  const totalTasks = stats?.totalTasksCompleted ?? 0;
  const days = stats?.days ?? [];
  const maxMin = Math.max(...days.map(d => d.totalMinutes), 1);
  const today = localToday;
  const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 800, backgroundColor: theme === "dark" ? "rgba(6,8,12,.7)" : "rgba(10,10,12,.36)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
  const card: CSSProperties = { width: "min(380px,100%)", background: theme === "dark" ? "rgba(16,18,22,.98)" : "rgba(252,252,250,.99)", border: `1px solid ${border(theme)}`, borderRadius: 20, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 };
  const dayLabel = (date: string) => { const d = new Date(date + "T12:00:00"); return ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]; };
  return (
    <div style={overlay} onClick={() => setProfileOpen(false)}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: pageText(theme), letterSpacing: "-.01em" }}>Focus Stats</div>
          <button onClick={() => setProfileOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: muted(theme), fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Streak", value: streak > 0 ? `${streak}d` : "–", sub: "days in a row", icon: streak > 0 ? (() => { const dur = Math.max(0.6, 2.4 - streak * 0.08); return <svg width="11" height="15" viewBox="0 0 11 15" fill="none" overflow="visible" style={{ animation: `boltSpark ${dur}s ease-in-out infinite` }}><path d="M7 1L1 8.5h4L3.5 14 10 6H6L7 1Z" fill="#facc15"/></svg>; })() : null },
            { label: "Total focused", value: totalHoursDisplay, sub: "all time" },
            { label: "Tasks done", value: String(totalTasks), sub: "tasks done" },
          ].map(({ label, value, sub, icon }) => (
            <div key={label} style={{ flex: 1, background: theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: pageText(theme), display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                {icon ?? null}{value}
              </div>
              <div style={{ fontSize: 10.5, color: muted(theme), marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600, color: muted(theme), marginBottom: 12 }}>Last 7 days</div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
            {days.map(d => {
              const pct = d.totalMinutes / maxMin;
              const isToday = d.date === today;
              return (
                <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 9, color: muted(theme), opacity: .6 }}>{d.totalMinutes > 0 ? fmtFocusTime(d.totalMinutes) : ""}</div>
                  <div style={{ width: "100%", borderRadius: 4, backgroundColor: d.totalMinutes > 0 ? (isToday ? "#6fc46b" : theme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)") : (theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"), height: `${Math.max(pct * 56, d.totalMinutes > 0 ? 8 : 4)}px`, transition: "height .3s" }} />
                  <div style={{ fontSize: 10, color: isToday ? pageText(theme) : muted(theme), fontWeight: isToday ? 700 : 400 }}>{dayLabel(d.date)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ fontSize: 13, color: muted(theme), textAlign: "center" }}>
          {fmtFocusTime(days.reduce((s, d) => s + d.totalMinutes, 0))} this week · {days.filter(d => d.totalMinutes > 0).length} active days
        </div>
      </div>
    </div>
  );
}
