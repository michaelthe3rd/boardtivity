"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Note } from "@/lib/board";

const PROMPTS = [
  "How long are you committing to this?",
  "What's a realistic block of time for this?",
  "How long until you check back in?",
  "Set a timer — even 15 minutes counts.",
  "Pick a duration and lock in.",
  "How much time can you give this right now?",
  "Short burst or deep work — you decide.",
  "What does focused look like for this task?",
  "Name your time. Then own it.",
  "No distractions. How long?",
];

const PRESETS = [15, 30, 60, 120];

const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 950, backgroundColor: "rgba(6,7,10,.92)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
const card: CSSProperties = { width: "min(400px,100%)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "32px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 0, textAlign: "center" };
const presetBtn = (active: boolean): CSSProperties => ({
  height: 56, flex: 1, borderRadius: 14,
  border: active ? "1.5px solid rgba(255,255,255,.7)" : "1px solid rgba(255,255,255,.12)",
  backgroundColor: active ? "rgba(255,255,255,.15)" : "rgba(255,255,255,.05)",
  color: active ? "#f7f8fb" : "rgba(247,248,251,.55)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  transition: "background-color .15s, border-color .15s",
});

function formatLogged(mins: number) {
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m already logged` : `${mins}m already logged`;
}

// Shown before a focus session starts. Mount it only while open so its state resets each time.
export default function DurationPicker({ note, onCancel, onStart }: {
  note: Note;
  onCancel: () => void;
  onStart: (minutes: number) => void;
}) {
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customMin, setCustomMin] = useState("");
  const customRef = useRef<HTMLInputElement>(null);

  const customVal = parseInt(customMin, 10);
  const customValid = !isNaN(customVal) && customVal >= 1 && customVal <= 480;
  const effective = selected ?? (showCustom && customValid ? customVal : null);
  const logged = note.totalTimeSpent ?? 0;

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(247,248,251,.4)", fontWeight: 600, marginBottom: 14 }}>Focus Session</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f7f8fb", letterSpacing: "-.02em", lineHeight: 1.2, marginBottom: 6 }}>{note.title}</div>
        {logged > 0 && (
          <div style={{ fontSize: 12, color: "rgba(247,248,251,.4)", marginBottom: 8 }}>{formatLogged(logged)}</div>
        )}
        <div style={{ fontSize: 13, color: "rgba(247,248,251,.35)", marginBottom: 28 }}>{prompt}</div>
        <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 12 }}>
          {PRESETS.map(m => (
            <button key={m} style={presetBtn(selected === m)} onClick={() => { setSelected(m); setCustomMin(""); }}>
              {m >= 60 ? `${m / 60}hr` : m}<span style={{ fontSize: 11, opacity: .6 }}>{m >= 60 ? "" : " min"}</span>
            </button>
          ))}
          <button
            aria-label="Custom duration"
            style={{ ...presetBtn(showCustom && selected === null), flex: "0 0 auto", padding: "0 14px" }}
            onClick={() => { setSelected(null); setShowCustom(true); setTimeout(() => customRef.current?.focus(), 50); }}
          >
            +
          </button>
        </div>
        {showCustom && (
          <div style={{ width: "100%", marginBottom: 12, display: "flex", gap: 8 }}>
            <input
              ref={customRef}
              type="number" min={1} max={480} placeholder="Custom min"
              value={customMin}
              onChange={e => setCustomMin(e.target.value)}
              style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${customValid ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.15)"}`, background: "rgba(255,255,255,.06)", color: "#f7f8fb", fontSize: 14, padding: "0 12px", outline: "none", fontFamily: "inherit" }}
            />
          </div>
        )}
        <button
          disabled={effective === null}
          onClick={() => { if (effective !== null) onStart(effective); }}
          style={{ width: "100%", height: 50, borderRadius: 14, border: "none", backgroundColor: effective !== null ? "#f5f5f2" : "rgba(255,255,255,.08)", color: effective !== null ? "#111315" : "rgba(247,248,251,.25)", fontSize: 15, fontWeight: 700, cursor: effective !== null ? "pointer" : "default", fontFamily: "inherit", marginBottom: 16, transition: "background-color .15s, color .15s" }}
        >
          Start
        </button>
        <button onClick={onCancel} style={{ fontSize: 13, color: "rgba(247,248,251,.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </div>
  );
}
