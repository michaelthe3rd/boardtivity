"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ThemeMode, Note, Importance } from "@/lib/board";

type SweepMode = "priority" | "dueDate" | "type" | "smart";
type BrainQuery = "whatFirst" | "summary" | "overdue";

export type BobSweepResult = { id: number; x: number; y: number }[];
export type BobNewNote = {
  type: "task" | "idea";
  title: string;
  body: string;
  importance: Importance;
  steps: { title: string; minutes: number }[];
};

interface Props {
  theme: ThemeMode;
  notes: Note[];
  onSweep: (positions: BobSweepResult) => void;
  onAddNote: (note: BobNewNote) => void;
}

const T = {
  bg:        (t: ThemeMode) => t === "dark" ? "rgba(18,20,24,.97)" : "rgba(255,255,255,.98)",
  border:    (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.1)"  : "rgba(17,19,21,.1)",
  divider:   (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.07)" : "rgba(17,19,21,.07)",
  text:      (t: ThemeMode) => t === "dark" ? "#f0f0ee" : "#111315",
  muted:     (t: ThemeMode) => t === "dark" ? "rgba(240,240,238,.38)" : "rgba(17,19,21,.38)",
  btn:       (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.06)" : "rgba(17,19,21,.04)",
  btnBorder: (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.09)" : "rgba(17,19,21,.09)",
};

function computeSweep(notes: Note[], mode: SweepMode): BobSweepResult {
  const CARD_W = 252, ROW_H = 168, COL_GAP = 22, ROW_GAP = 18, COLS = 5, START_X = 60, START_Y = 72;
  let sorted = [...notes];
  if (mode === "priority") {
    const rank: Record<string, number> = { High: 0, Medium: 1, Low: 2, none: 3 };
    sorted.sort((a, b) => (rank[a.importance ?? "none"] ?? 3) - (rank[b.importance ?? "none"] ?? 3));
  } else if (mode === "dueDate") {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  } else if (mode === "type") {
    const rank: Record<string, number> = { task: 0, thought: 1 };
    sorted.sort((a, b) => (rank[a.type] ?? 1) - (rank[b.type] ?? 1));
  } else {
    sorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  }
  return sorted.map((n, i) => ({
    id: n.id,
    x: START_X + (i % COLS) * (CARD_W + COL_GAP),
    y: START_Y + Math.floor(i / COLS) * (ROW_H + ROW_GAP),
  }));
}

// Robot face icon matching the provided design
function BobIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 108 98" fill="none" style={{ flexShrink: 0 }}>
      {/* Ears */}
      <rect x="0"  y="22" width="11" height="26" rx="5.5" fill={color} />
      <rect x="97" y="22" width="11" height="26" rx="5.5" fill={color} />
      {/* Outer head */}
      <rect x="12" y="4" width="84" height="68" rx="22" stroke={color} strokeWidth="8" />
      {/* Inner face */}
      <rect x="23" y="14" width="62" height="48" rx="13" stroke={color} strokeWidth="5" />
      {/* Eyes */}
      <rect x="32" y="27" width="15" height="15" rx="3" fill={color} />
      <rect x="61" y="27" width="15" height="15" rx="3" fill={color} />
      {/* Mouth */}
      <line x1="40" y1="51" x2="68" y2="51" stroke={color} strokeWidth="5" strokeLinecap="round" />
      {/* 4-pointed sparkle bottom-right */}
      <path d="M82 76 L85 68 L88 76 L96 79 L88 82 L85 90 L82 82 L74 79 Z" fill={color} />
    </svg>
  );
}

export default function BobAgent({ theme: t, notes, onSweep, onAddNote }: Props) {
  const [open, setOpen]     = useState(false);
  const [mounted, setMounted] = useState(false);

  // Brain
  const [brainQuery, setBrainQuery]     = useState<BrainQuery | null>(null);
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainResponse, setBrainResponse] = useState<string | null>(null);

  // Sweep
  const [sweepMode, setSweepMode] = useState<SweepMode>("priority");
  const [sweepDone, setSweepDone] = useState(false);

  // Voice
  const [listening, setListening]       = useState(false);
  const [transcript, setTranscript]     = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult]   = useState<BobNewNote | null>(null);
  const [voiceAdded, setVoiceAdded]     = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const containerRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function askBrain(query: BrainQuery) {
    setBrainQuery(query);
    setBrainLoading(true);
    setBrainResponse(null);
    try {
      const res  = await fetch("/api/luma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "brain", query,
          notes: notes.map(n => ({
            id: n.id, type: n.type, title: n.title, body: n.body,
            importance: n.importance, dueDate: n.dueDate, minutes: n.minutes,
            completed: n.completed,
            steps: n.steps.map(s => ({ title: s.title, minutes: s.minutes, done: s.done })),
          })),
        }),
      });
      const data = await res.json();
      setBrainResponse(data.response ?? data.error ?? "Something went wrong.");
    } catch {
      setBrainResponse("Couldn't reach BOB right now. Try again.");
    } finally {
      setBrainLoading(false);
    }
  }

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR();
    r.continuous    = false;
    r.interimResults = true;
    r.lang          = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const txt = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>).map(x => x[0].transcript).join(" ");
      setTranscript(txt);
    };
    r.onend  = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
    setTranscript("");
    setVoiceResult(null);
    setVoiceAdded(false);
  }, []);

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function parseVoice() {
    if (!transcript.trim()) return;
    setVoiceLoading(true);
    setVoiceResult(null);
    try {
      const res  = await fetch("/api/luma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "voice", transcript }),
      });
      const data = await res.json();
      if (data.task) setVoiceResult(data.task as BobNewNote);
    } catch { /* leave null */ }
    finally { setVoiceLoading(false); }
  }

  function addVoiceNote(result: BobNewNote) {
    onAddNote(result);
    setVoiceAdded(true);
    setTimeout(() => { setVoiceAdded(false); setVoiceResult(null); setTranscript(""); }, 1800);
  }

  function handleSweep() {
    onSweep(computeSweep(notes, sweepMode));
    setSweepDone(true);
    setTimeout(() => setSweepDone(false), 2500);
  }

  function handleOpen() {
    setOpen(true);
    setBrainResponse(null);
    setSweepDone(false);
  }

  const hasSpeech  = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const iconColor  = T.text(t);
  // Spring that gives the "expanding from pill" morphing feel
  const spring     = "width 0.44s cubic-bezier(0.34,1.56,0.64,1), max-height 0.44s cubic-bezier(0.34,1.56,0.64,1), border-radius 0.44s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease";
  const contentFade = "opacity 0.18s ease 0.18s";

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        // ── Pill ↔ Panel morph ──
        width:       open ? 560 : "auto",
        maxHeight:   open ? 420 : 38,
        borderRadius: open ? 20 : 99,
        overflow: "hidden",
        backgroundColor: T.bg(t),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${T.border(t)}`,
        boxShadow: open
          ? (t === "dark" ? "0 8px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)" : "0 8px 32px rgba(0,0,0,.14)")
          : (t === "dark" ? "0 2px 14px rgba(0,0,0,.4)" : "0 2px 10px rgba(0,0,0,.08)"),
        transition: spring,
        zIndex: 30,
        cursor: open ? "default" : "pointer",
        userSelect: "none",
      }}
      onClick={!open ? handleOpen : undefined}
    >
      {/* ── Header bar (doubles as the pill when closed) ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: open ? "11px 16px 10px" : "6px 14px 6px 10px",
        gap: 8,
        flexShrink: 0,
        whiteSpace: "nowrap",
        transition: "padding 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <BobIcon size={open ? 17 : 15} color={iconColor} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.01em", color: T.text(t) }}>BOB</span>
        </div>
        {open && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.muted(t), fontSize: 18, lineHeight: 1, padding: "2px 5px", fontFamily: "inherit", flexShrink: 0 }}
          >×</button>
        )}
      </div>

      {/* ── Three-column panel (always mounted, fades in when open) ── */}
      {mounted && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
          borderTop: `1px solid ${T.border(t)}`,
          opacity: open ? 1 : 0,
          transition: contentFade,
          pointerEvents: open ? "auto" : "none",
        }}>

          {/* ────── Brain ────── */}
          <div style={{ padding: "11px 13px 13px", display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted(t), marginBottom: 8, textTransform: "uppercase", letterSpacing: ".07em" }}>🧠 Brain</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {([
                { key: "whatFirst" as BrainQuery, label: "What first?",  icon: "→"  },
                { key: "summary"  as BrainQuery, label: "Summarize",     icon: "◈"  },
                { key: "overdue"  as BrainQuery, label: "Overdue?",      icon: "⏱" },
              ]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => askBrain(key)}
                  disabled={brainLoading}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 10px", borderRadius: 9,
                    border: `1px solid ${brainQuery === key ? "rgba(111,196,107,.45)" : T.btnBorder(t)}`,
                    background: brainQuery === key
                      ? (t === "dark" ? "rgba(111,196,107,.1)" : "rgba(60,184,57,.07)")
                      : T.btn(t),
                    color: T.text(t), fontSize: 12, fontWeight: 600,
                    cursor: brainLoading ? "default" : "pointer",
                    fontFamily: "inherit", textAlign: "left",
                    opacity: brainLoading && brainQuery !== key ? 0.4 : 1,
                    transition: "all .12s",
                    width: "100%",
                  }}
                >
                  <span style={{ opacity: .55, flexShrink: 0 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
            {(brainLoading || brainResponse) && (
              <div style={{
                marginTop: 8, padding: "8px 10px", borderRadius: 9,
                background: T.btn(t), border: `1px solid ${T.btnBorder(t)}`,
                fontSize: 12, color: T.text(t), lineHeight: 1.65,
              }}>
                {brainLoading
                  ? <span style={{ color: T.muted(t), display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
                      Thinking…
                    </span>
                  : brainResponse}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ background: T.divider(t) }} />

          {/* ────── Sweep ────── */}
          <div style={{ padding: "11px 13px 13px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted(t), marginBottom: 8, textTransform: "uppercase", letterSpacing: ".07em" }}>✦ Sweep</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
              {([
                { key: "priority" as SweepMode, label: "Priority", icon: "▲"  },
                { key: "dueDate"  as SweepMode, label: "Due Date", icon: "📅" },
                { key: "type"     as SweepMode, label: "Type",     icon: "◈"  },
                { key: "smart"    as SweepMode, label: "Smart",    icon: "✦"  },
              ]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setSweepMode(key)}
                  style={{
                    padding: "6px 7px", borderRadius: 8,
                    border: `1px solid ${sweepMode === key ? "rgba(111,196,107,.45)" : T.btnBorder(t)}`,
                    background: sweepMode === key ? (t === "dark" ? "rgba(111,196,107,.12)" : "rgba(60,184,57,.08)") : T.btn(t),
                    color: sweepMode === key ? (t === "dark" ? "#a8e6a3" : "#1a7a18") : T.text(t),
                    fontSize: 11, fontWeight: sweepMode === key ? 700 : 500,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 4,
                    transition: "all .12s",
                  }}
                >
                  <span style={{ fontSize: 10 }}>{icon}</span>{label}
                </button>
              ))}
            </div>
            <button
              onClick={handleSweep}
              disabled={notes.length === 0}
              style={{
                width: "100%", padding: "8px 0", borderRadius: 9, border: "none",
                background: sweepDone
                  ? (t === "dark" ? "rgba(111,196,107,.2)" : "rgba(60,184,57,.12)")
                  : "linear-gradient(135deg, #6fc46b, #4a7ef5)",
                color: sweepDone ? (t === "dark" ? "#a8e6a3" : "#1a7a18") : "#fff",
                fontSize: 12, fontWeight: 800,
                cursor: notes.length === 0 ? "default" : "pointer",
                fontFamily: "inherit",
                opacity: notes.length === 0 ? .4 : 1,
                transition: "all .2s",
              }}
            >
              {sweepDone ? "✓ Board sorted" : `Sweep ${notes.length} card${notes.length !== 1 ? "s" : ""} →`}
            </button>
          </div>

          {/* Divider */}
          <div style={{ background: T.divider(t) }} />

          {/* ────── Voice ────── */}
          <div style={{ padding: "11px 13px 13px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted(t), marginBottom: 8, textTransform: "uppercase", letterSpacing: ".07em", width: "100%" }}>🎙 Voice</div>

            {!hasSpeech ? (
              <p style={{ fontSize: 11, color: T.muted(t), lineHeight: 1.5, margin: 0, textAlign: "center" }}>
                Use Chrome or Edge for voice input.
              </p>
            ) : (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                <button
                  onClick={listening ? stopListening : startListening}
                  style={{
                    width: 46, height: 46, borderRadius: "50%", border: "none",
                    background: listening
                      ? "linear-gradient(135deg, #e05555, #c03030)"
                      : "linear-gradient(135deg, #6fc46b, #4a7ef5)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: listening
                      ? "0 0 0 6px rgba(192,48,48,.18), 0 3px 12px rgba(192,48,48,.3)"
                      : "0 3px 12px rgba(74,126,245,.28)",
                    transition: "all .2s",
                    animation: listening ? "micPulse 1.2s ease-in-out infinite" : "none",
                    flexShrink: 0,
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    {listening ? (
                      <rect x="6" y="6" width="12" height="12" rx="2" fill="white" />
                    ) : (
                      <>
                        <rect x="9" y="2" width="6" height="12" rx="3" fill="white" />
                        <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        <line x1="8" y1="22" x2="16" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </>
                    )}
                  </svg>
                </button>

                {!transcript && !listening && !voiceResult && !voiceAdded && (
                  <span style={{ fontSize: 11, color: T.muted(t) }}>Tap mic &amp; speak</span>
                )}

                {transcript && (
                  <div style={{
                    width: "100%", fontSize: 11, color: T.text(t), lineHeight: 1.55,
                    padding: "7px 9px", borderRadius: 8,
                    background: T.btn(t), border: `1px solid ${T.btnBorder(t)}`,
                  }}>
                    {transcript}{listening && <span style={{ opacity: .4 }}>█</span>}
                  </div>
                )}

                {transcript && !listening && !voiceLoading && !voiceResult && (
                  <button onClick={parseVoice} style={{
                    width: "100%", padding: "7px 0", borderRadius: 9, border: "none",
                    background: "linear-gradient(135deg, #6fc46b, #4a7ef5)",
                    color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    ✦ Structure with BOB
                  </button>
                )}

                {voiceLoading && (
                  <span style={{ fontSize: 11, color: T.muted(t), display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
                    Structuring…
                  </span>
                )}

                {voiceResult && !voiceAdded && (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text(t), lineHeight: 1.4 }}>{voiceResult.title}</div>
                    {voiceResult.body && <div style={{ fontSize: 11, color: T.muted(t) }}>{voiceResult.body}</div>}
                    <button onClick={() => addVoiceNote(voiceResult!)} style={{
                      width: "100%", padding: "7px 0", borderRadius: 9, border: "none",
                      background: "linear-gradient(135deg, #6fc46b, #4a7ef5)",
                      color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      Add to board →
                    </button>
                  </div>
                )}

                {voiceAdded && (
                  <span style={{ fontSize: 12, color: t === "dark" ? "#a8e6a3" : "#2a9e27", fontWeight: 700 }}>✓ Added</span>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
