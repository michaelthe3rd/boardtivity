"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ThemeMode } from "@/lib/board";
import { pageText, muted, border, paper, buttonStyle } from "@/lib/ui";
import { useHome } from "@/components/home/HomeContext";

type Key = "dueSoonReminder" | "dailyDigest" | "weeklyDigest";

// Each description names the real time, so it's clear when each email arrives.
function rows(time: string, summariesOff: boolean): { key: Key; label: string; hint: string }[] {
  return [
    { key: "dailyDigest", label: "Daily summary", hint: `Every day at ${time}: what's overdue, due today and due in the next 3 days. No email on days nothing is due.` },
    { key: "weeklyDigest", label: "Weekly summary", hint: `Sundays at ${time}: your whole week ahead. Sent instead of Sunday's daily summary.` },
    { key: "dueSoonReminder", label: "Task reminders", hint: summariesOff
      ? `An email 1 hour before a task's due time. Tasks with no time are emailed at ${time} on their due date.`
      : "An email 1 hour before a task's due time, for tasks that have one." },
  ];
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: `${String(h).padStart(2, "0")}:00`, label: `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}` }));

// "Central Time" for "America/Chicago"; falls back to the city name.
function zoneLabel(zone: string): string {
  for (const timeZoneName of ["longGeneric", "long"] as const) {
    try {
      const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value;
      if (name && !name.startsWith("GMT")) return name;
    } catch { /* unsupported option or zone */ }
  }
  return zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
}

// The Email section of Settings, shared by the desktop panel and the phone sheet.
export default function EmailSettings({ theme, large = false }: { theme: ThemeMode; large?: boolean }) {
  const { emailPrefs, toggleEmailPref, updateReminderTime, user, isSignedIn, openSignIn } = useHome();
  const sendPreview = useAction(api.emails.sendPreview);
  const [preview, setPreview] = useState<"idle" | "sending" | "sent" | "wait" | "error">("idle");
  const labelSize = large ? 15 : 13;
  const hintSize = large ? 12 : 11;
  const rowPad = large ? 14 : 10;
  const heading = <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: large ? 4 : 2 }}>Email</div>;

  if (!isSignedIn) {
    return (
      <div data-tour="settings-email" style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
        {heading}
        <div style={{ fontSize: labelSize, color: pageText(theme), fontWeight: 600, marginTop: 8 }}>Get reminded before things are due</div>
        <p style={{ fontSize: hintSize, color: muted(theme), lineHeight: 1.5, margin: "4px 0 12px" }}>
          Sign in for a daily summary of what&apos;s due, a weekly plan on Sundays, and an email an hour before tasks are due. Your board syncs across devices too.
        </p>
        <button type="button" onClick={() => openSignIn()} style={{ ...buttonStyle(theme, theme === "light", !large), padding: "0 18px" }}>Sign in</button>
      </div>
    );
  }

  const zone = emailPrefs?.timeZone ? zoneLabel(emailPrefs.timeZone) : null;
  const sendAt = emailPrefs?.reminderTime ?? "08:00";
  const summariesOff = emailPrefs ? !emailPrefs.dailyDigest && !emailPrefs.weeklyDigest : false;

  async function onPreview() {
    setPreview("sending");
    try {
      const result = await sendPreview({});
      setPreview(result === "sent" ? "sent" : result === "wait" ? "wait" : "error");
    } catch {
      setPreview("error");
    }
    setTimeout(() => setPreview("idle"), 6000);
  }

  return (
    <div data-tour="settings-email" style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
      {heading}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: `${rowPad}px 0`, borderBottom: `1px solid ${border(theme)}` }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: labelSize, color: pageText(theme), fontWeight: 600 }}>Send emails at</div>
          <div style={{ fontSize: hintSize, color: muted(theme), lineHeight: 1.45, marginTop: 2, opacity: .85 }}>
            {zone ? <>{zone}, from this device</> : <>Your local time</>}
          </div>
        </div>
        <select
          aria-label="Send emails at"
          value={sendAt}
          onChange={(e) => updateReminderTime(e.target.value)}
          style={{ flexShrink: 0, fontSize: labelSize, fontWeight: 600, color: pageText(theme), backgroundColor: paper(theme), border: `1px solid ${border(theme)}`, borderRadius: 8, padding: large ? "6px 8px" : "4px 6px", cursor: "pointer", fontFamily: "inherit", colorScheme: theme === "dark" ? "dark" : "light" }}
        >
          {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
        </select>
      </div>


      {rows(HOURS.find((h) => h.value === sendAt)?.label ?? "8:00 AM", summariesOff).map(({ key, label, hint }) => {
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

      <button
        type="button"
        onClick={onPreview}
        disabled={preview === "sending"}
        style={{ marginTop: 4, background: "none", border: `1px solid ${border(theme)}`, borderRadius: 8, padding: large ? "8px 12px" : "6px 10px", fontSize: hintSize + 1, fontWeight: 600, color: pageText(theme), cursor: preview === "sending" ? "default" : "pointer", fontFamily: "inherit" }}
      >
        {preview === "sending" ? "Sending…" : preview === "sent" ? "Sent, check your inbox" : preview === "wait" ? "Try again in a minute" : preview === "error" ? "Couldn't send" : "Send me a preview"}
      </button>
      <p style={{ fontSize: hintSize, color: muted(theme), margin: "10px 0 0", lineHeight: 1.5, overflowWrap: "anywhere" }}>
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
