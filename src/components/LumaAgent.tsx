"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ThemeMode, Note, Importance } from "@/lib/board";

// ─── Types ────────────────────────────────────────────────────────────────────
type LumaTab = "sweep" | "brain" | "voice";
type SweepMode = "priority" | "dueDate" | "type" | "smart";
type BrainQuery = "whatFirst" | "summary" | "overdue";

export type LumaSweepResult = { id: number; x: number; y: number }[];
export type LumaNewNote = {
  type: "task" | "idea";
  title: string;
  body: string;
  importance: Importance;
  steps: { title: string; minutes: number }[];
};

interface Props {
  theme: ThemeMode;
  notes: Note[];
  onSweep: (positions: LumaSweepResult) => void;
  onAddNote: (note: LumaNewNote) => void;
}

// ─── Theme helpers ─────────────────────────────────────────────────────────
const T = {
  bg: (t: ThemeMode) => t === "dark" ? "rgba(20,22,26,.96)" : "rgba(255,255,255,.97)",
  border: (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.1)" : "rgba(17,19,21,.1)",
  text: (t: ThemeMode) => t === "dark" ? "#f0f0ee" : "#111315",
  muted: (t: ThemeMode) => t === "dark" ? "rgba(240,240,238,.4)" : "rgba(17,19,21,.4)",
  pill: (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.07)" : "rgba(17,19,21,.06)",
  pillActive: (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.14)" : "rgba(17,19,21,.12)",
  input: (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.06)" : "rgba(17,19,21,.04)",
};

// ─── Sweep algorithm ──────────────────────────────────────────────────────────
function computeSweep(notes: Note[], mode: SweepMode): LumaSweepResult {
  const CARD_W = 252;
  const ROW_H = 168;
  const COL_GAP = 22;
  const ROW_GAP = 18;
  const COLS = 5;
  const START_X = 60;
  const START_Y = 72;

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
  } else if (mode === "smart") {
    // Group by first word similarity
    sorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  }

  return sorted.map((note, i) => ({
    id: note.id,
    x: START_X + (i % COLS) * (CARD_W + COL_GAP),
    y: START_Y + Math.floor(i / COLS) * (ROW_H + ROW_GAP),
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LumaAgent({ theme: t, notes, onSweep, onAddNote }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<LumaTab>("brain");
  const [mounted, setMounted] = useState(false);

  // Sweep state
  const [sweepMode, setSweepMode] = useState<SweepMode>("priority");
  const [sweepDone, setSweepDone] = useState(false);

  // Brain state
  const [brainQuery, setBrainQuery] = useState<BrainQuery | null>(null);
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainResponse, setBrainResponse] = useState<string | null>(null);

  // Voice state
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult] = useState<LumaNewNote | null>(null);
  const [voiceAdded, setVoiceAdded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // ── Brain ────────────────────────────────────────────────────────────────
  async function askBrain(query: BrainQuery) {
    setBrainQuery(query);
    setBrainLoading(true);
    setBrainResponse(null);
    try {
      const res = await fetch("/api/luma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "brain",
          query,
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
      setBrainResponse("Couldn't reach Luma right now. Try again.");
    } finally {
      setBrainLoading(false);
    }
  }

  // ── Voice ────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const t = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>).map(r => r[0].transcript).join(" ");
      setTranscript(t);
    };
    r.onend = () => setListening(false);
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
      const res = await fetch("/api/luma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "voice", transcript }),
      });
      const data = await res.json();
      if (data.task) setVoiceResult(data.task as LumaNewNote);
    } catch {
      // leave voiceResult null
    } finally {
      setVoiceLoading(false);
    }
  }

  function addVoiceNote(result: LumaNewNote) {
    onAddNote(result);
    setVoiceAdded(true);
    setTimeout(() => {
      setVoiceAdded(false);
      setVoiceResult(null);
      setTranscript("");
    }, 1800);
  }

  function handleSweep() {
    const positions = computeSweep(notes, sweepMode);
    onSweep(positions);
    setSweepDone(true);
    setTimeout(() => setSweepDone(false), 2500);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const hasSpeech = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const springTransition = "all 0.42s cubic-bezier(0.34,1.56,0.64,1)";

  return (
    <div ref={containerRef} style={{ position: "relative", zIndex: 30 }}>
      {/* ── Collapsed pill ── */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setSweepDone(false); setBrainResponse(null); }}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "7px 16px 7px 11px",
            borderRadius: 99,
            border: `1px solid ${T.border(t)}`,
            backgroundColor: T.bg(t),
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: t === "dark" ? "0 2px 16px rgba(0,0,0,.35)" : "0 2px 12px rgba(0,0,0,.08)",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: springTransition,
          }}
        >
          {/* Spark icon */}
          <span style={{ position: "relative", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{
              position: "absolute", width: 22, height: 22, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(111,196,107,.5) 0%, transparent 70%)",
              animation: "ping 2.2s ease-in-out infinite",
            }} />
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L9.5 6.5H15L10.5 9.5L12 15L8 12L4 15L5.5 9.5L1 6.5H6.5L8 1Z"
                fill={t === "dark" ? "#a8e6a3" : "#3db83d"} stroke="none" />
            </svg>
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, letterSpacing: "-.01em",
            background: t === "dark"
              ? "linear-gradient(90deg, #a8e6a3, #7eb8f7, #c4a0f5)"
              : "linear-gradient(90deg, #2a9e27, #2e6fd4, #7c3aed)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Luma
          </span>
          <span style={{ fontSize: 11, color: T.muted(t), fontWeight: 500 }}>Your board agent</span>
        </button>
      )}

      {/* ── Expanded panel ── */}
      {open && mounted && (
        <div style={{
          width: 348,
          backgroundColor: T.bg(t),
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${T.border(t)}`,
          borderRadius: 22,
          boxShadow: t === "dark"
            ? "0 8px 48px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06)"
            : "0 8px 40px rgba(0,0,0,.14)",
          overflow: "hidden",
          animation: "lumaOpen .38s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${T.border(t)}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L9.5 6.5H15L10.5 9.5L12 15L8 12L4 15L5.5 9.5L1 6.5H6.5L8 1Z"
                  fill={t === "dark" ? "#a8e6a3" : "#3db83d"} />
              </svg>
              <span style={{
                fontSize: 14, fontWeight: 800, letterSpacing: "-.02em",
                background: t === "dark"
                  ? "linear-gradient(90deg, #a8e6a3, #7eb8f7, #c4a0f5)"
                  : "linear-gradient(90deg, #2a9e27, #2e6fd4, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>Luma</span>
              <span style={{ fontSize: 11, color: T.muted(t), fontWeight: 500 }}>Board Agent</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted(t), fontSize: 18, lineHeight: 1, padding: "2px 4px", fontFamily: "inherit" }}>×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", padding: "10px 12px 0", gap: 6 }}>
            {(["brain", "sweep", "voice"] as LumaTab[]).map(tb => (
              <button key={tb} onClick={() => setTab(tb)} style={{
                flex: 1, padding: "6px 0", borderRadius: 10, border: "none",
                background: tab === tb ? T.pillActive(t) : "none",
                color: tab === tb ? T.text(t) : T.muted(t),
                fontSize: 12, fontWeight: tab === tb ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit",
                textTransform: "capitalize",
              }}>
                {tb === "brain" ? "🧠 Brain" : tb === "sweep" ? "✦ Sweep" : "🎙 Voice"}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ padding: "14px 14px 16px", minHeight: 200 }}>

            {/* ── Brain tab ── */}
            {tab === "brain" && (
              <div>
                <p style={{ fontSize: 12, color: T.muted(t), margin: "0 0 12px", lineHeight: 1.6 }}>
                  Ask Luma to analyze your board and tell you what matters.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {([
                    { key: "whatFirst", label: "What should I do first?", icon: "→" },
                    { key: "summary", label: "Summarize my board", icon: "◈" },
                    { key: "overdue", label: "What's overdue or due soon?", icon: "⏱" },
                  ] as { key: BrainQuery; label: string; icon: string }[]).map(({ key, label, icon }) => (
                    <button key={key} onClick={() => askBrain(key)}
                      disabled={brainLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 9,
                        padding: "9px 13px", borderRadius: 11,
                        border: `1px solid ${brainQuery === key ? "rgba(111,196,107,.4)" : T.border(t)}`,
                        background: brainQuery === key ? (t === "dark" ? "rgba(111,196,107,.1)" : "rgba(60,184,57,.07)") : T.input(t),
                        color: T.text(t), fontSize: 13, fontWeight: 600,
                        cursor: brainLoading ? "default" : "pointer",
                        fontFamily: "inherit", textAlign: "left", width: "100%",
                        opacity: brainLoading && brainQuery !== key ? 0.5 : 1,
                        transition: "all .15s",
                      }}>
                      <span style={{ fontSize: 14, opacity: .7 }}>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Response */}
                {(brainLoading || brainResponse) && (
                  <div style={{
                    marginTop: 12, padding: "12px 14px", borderRadius: 12,
                    background: T.input(t), border: `1px solid ${T.border(t)}`,
                    fontSize: 13, color: T.text(t), lineHeight: 1.7,
                  }}>
                    {brainLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.muted(t) }}>
                        <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
                        Thinking…
                      </div>
                    ) : brainResponse}
                  </div>
                )}
              </div>
            )}

            {/* ── Sweep tab ── */}
            {tab === "sweep" && (
              <div>
                <p style={{ fontSize: 12, color: T.muted(t), margin: "0 0 12px", lineHeight: 1.6 }}>
                  Luma will reorganize your {notes.length} card{notes.length !== 1 ? "s" : ""} into a clean grid.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
                  {([
                    { key: "priority", label: "By Priority", icon: "▲" },
                    { key: "dueDate", label: "By Due Date", icon: "📅" },
                    { key: "type", label: "By Type", icon: "◈" },
                    { key: "smart", label: "Smart Sort", icon: "✦" },
                  ] as { key: SweepMode; label: string; icon: string }[]).map(({ key, label, icon }) => (
                    <button key={key} onClick={() => setSweepMode(key)} style={{
                      padding: "9px 10px", borderRadius: 11,
                      border: `1px solid ${sweepMode === key ? "rgba(111,196,107,.5)" : T.border(t)}`,
                      background: sweepMode === key ? (t === "dark" ? "rgba(111,196,107,.12)" : "rgba(60,184,57,.08)") : T.input(t),
                      color: sweepMode === key ? (t === "dark" ? "#a8e6a3" : "#1f8c1c") : T.text(t),
                      fontSize: 12, fontWeight: sweepMode === key ? 700 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 6,
                      transition: "all .15s",
                    }}>
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
                <button onClick={handleSweep} disabled={notes.length === 0} style={{
                  width: "100%", padding: "10px 0", borderRadius: 12, border: "none",
                  background: sweepDone
                    ? (t === "dark" ? "rgba(111,196,107,.2)" : "rgba(60,184,57,.12)")
                    : "linear-gradient(135deg, #6fc46b, #4a7ef5)",
                  color: sweepDone ? (t === "dark" ? "#a8e6a3" : "#1f8c1c") : "#fff",
                  fontSize: 13, fontWeight: 800, cursor: notes.length === 0 ? "default" : "pointer",
                  fontFamily: "inherit", letterSpacing: "-.01em",
                  opacity: notes.length === 0 ? .4 : 1,
                  transition: "all .25s",
                }}>
                  {sweepDone ? "✓ Board organized" : notes.length === 0 ? "No cards to sweep" : `Sweep board →`}
                </button>
              </div>
            )}

            {/* ── Voice tab ── */}
            {tab === "voice" && (
              <div>
                <p style={{ fontSize: 12, color: T.muted(t), margin: "0 0 12px", lineHeight: 1.6 }}>
                  {hasSpeech ? "Speak a task, idea, or thought — Luma will structure it." : "Voice input isn't supported in this browser. Use Chrome or Edge."}
                </p>

                {hasSpeech && (
                  <>
                    {/* Mic button */}
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                      <button
                        onClick={listening ? stopListening : startListening}
                        style={{
                          width: 64, height: 64, borderRadius: "50%", border: "none",
                          background: listening
                            ? "linear-gradient(135deg, #e05555, #c03030)"
                            : "linear-gradient(135deg, #6fc46b, #4a7ef5)",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: listening ? "0 0 0 8px rgba(192,48,48,.2), 0 4px 20px rgba(192,48,48,.35)" : "0 4px 20px rgba(74,126,245,.3)",
                          transition: "all .2s",
                          animation: listening ? "micPulse 1.2s ease-in-out infinite" : "none",
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
                    </div>

                    {/* Transcript */}
                    {transcript && (
                      <div style={{
                        padding: "10px 12px", borderRadius: 11,
                        background: T.input(t), border: `1px solid ${T.border(t)}`,
                        fontSize: 13, color: T.text(t), lineHeight: 1.6,
                        marginBottom: 10, minHeight: 44,
                      }}>
                        {transcript}
                        {listening && <span style={{ opacity: .5 }}>█</span>}
                      </div>
                    )}

                    {/* Actions after speech */}
                    {transcript && !listening && !voiceLoading && !voiceResult && (
                      <div style={{ display: "flex", gap: 7 }}>
                        <button onClick={parseVoice} style={{
                          flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
                          background: "linear-gradient(135deg, #6fc46b, #4a7ef5)",
                          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}>
                          ✦ Structure with Luma
                        </button>
                        <button onClick={() => onAddNote({ type: "task", title: transcript.slice(0, 60), body: "", importance: "none", steps: [] })} style={{
                          flex: 1, padding: "8px 0", borderRadius: 10,
                          border: `1px solid ${T.border(t)}`, background: T.input(t),
                          color: T.text(t), fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        }}>
                          Add as task
                        </button>
                      </div>
                    )}

                    {/* Loading */}
                    {voiceLoading && (
                      <div style={{ textAlign: "center", color: T.muted(t), fontSize: 12, padding: "8px 0" }}>
                        <span style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: 6 }}>◌</span>
                        Structuring your note…
                      </div>
                    )}

                    {/* Voice result preview */}
                    {voiceResult && !voiceAdded && (
                      <div style={{ background: T.input(t), border: `1px solid ${T.border(t)}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
                            color: voiceResult.type === "task" ? "#4a7ef5" : "#9b6fe8",
                            background: voiceResult.type === "task" ? "rgba(74,126,245,.12)" : "rgba(155,111,232,.12)",
                            padding: "2px 8px", borderRadius: 6,
                          }}>{voiceResult.type}</span>
                          {voiceResult.importance !== "none" && (
                            <span style={{ fontSize: 10, color: T.muted(t) }}>· {voiceResult.importance} priority</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text(t), marginBottom: 4 }}>{voiceResult.title}</div>
                        {voiceResult.body && <div style={{ fontSize: 12, color: T.muted(t), marginBottom: 6 }}>{voiceResult.body}</div>}
                        {voiceResult.steps.length > 0 && (
                          <div style={{ fontSize: 11, color: T.muted(t) }}>
                            {voiceResult.steps.length} subtask{voiceResult.steps.length !== 1 ? "s" : ""}: {voiceResult.steps.map(s => s.title).join(", ")}
                          </div>
                        )}
                        <button onClick={() => addVoiceNote(voiceResult!)} style={{
                          marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 10, border: "none",
                          background: "linear-gradient(135deg, #6fc46b, #4a7ef5)",
                          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}>
                          Add to board →
                        </button>
                      </div>
                    )}

                    {voiceAdded && (
                      <div style={{ textAlign: "center", fontSize: 13, color: t === "dark" ? "#a8e6a3" : "#2a9e27", fontWeight: 700, padding: "8px 0" }}>
                        ✓ Added to board
                      </div>
                    )}

                    {!transcript && !listening && (
                      <div style={{ textAlign: "center", fontSize: 11, color: T.muted(t), marginTop: 4 }}>
                        Tap the mic and speak
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
