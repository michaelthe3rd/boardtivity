"use client";

import { useState, useEffect, useRef, useCallback, type ReactElement } from "react";
import type { ThemeMode, Note, Importance } from "@/lib/board";

type SweepMode  = "priority" | "dueDate" | "type" | "smart";
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

// ── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg:        (t: ThemeMode) => t === "dark" ? "rgba(16,18,22,.98)" : "rgba(252,252,250,.99)",
  border:    (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.11)" : "rgba(17,19,21,.11)",
  divider:   (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.07)" : "rgba(17,19,21,.07)",
  text:      (t: ThemeMode) => t === "dark" ? "#ededeb"              : "#111315",
  muted:     (t: ThemeMode) => t === "dark" ? "rgba(237,237,235,.36)" : "rgba(17,19,21,.36)",
  btn:       (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.055)" : "rgba(17,19,21,.04)",
  btnHover:  (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.1)"  : "rgba(17,19,21,.08)",
  btnBorder: (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.09)" : "rgba(17,19,21,.09)",
  accent:    "#5a96e6",
  green:     (t: ThemeMode) => t === "dark" ? "#7ddd79" : "#2b9e28",
  greenBg:   (t: ThemeMode) => t === "dark" ? "rgba(125,221,121,.12)" : "rgba(43,158,40,.08)",
  greenBdr:  (t: ThemeMode) => t === "dark" ? "rgba(125,221,121,.3)"  : "rgba(43,158,40,.3)",
};

// ── Sweep ────────────────────────────────────────────────────────────────────
function computeSweep(notes: Note[], mode: SweepMode): BobSweepResult {
  const CARD_W = 252, ROW_H = 168, COL_GAP = 22, ROW_GAP = 18, COLS = 5, START_X = 60, START_Y = 72;
  // Only reposition non-completed notes; completed notes stay hidden wherever they are
  const sorted = notes.filter(n => !n.completed);
  if (mode === "priority") {
    const r: Record<string, number> = { High: 0, Medium: 1, Low: 2, none: 3 };
    sorted.sort((a, b) => (r[a.importance ?? "none"] ?? 3) - (r[b.importance ?? "none"] ?? 3));
  } else if (mode === "dueDate") {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  } else if (mode === "type") {
    const r: Record<string, number> = { task: 0, thought: 1 };
    sorted.sort((a, b) => (r[a.type] ?? 1) - (r[b.type] ?? 1));
  } else {
    sorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  }
  return sorted.map((n, i) => ({
    id: n.id,
    x: START_X + (i % COLS) * (CARD_W + COL_GAP),
    y: START_Y + Math.floor(i / COLS) * (ROW_H + ROW_GAP),
  }));
}

// ── SVG Icons ────────────────────────────────────────────────────────────────
const I = {
  Arrow: ({ c, s = 11 }: { c: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M1.5 6h9M7 2.5L10.5 6 7 9.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Lines: ({ c, s = 11 }: { c: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <line x1="1" y1="2.5" x2="11" y2="2.5" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="1" y1="6"   x2="8.5" y2="6"  stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="1" y1="9.5" x2="6"  y2="9.5" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Clock: ({ c, s = 11 }: { c: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={c} strokeWidth="1.5"/>
      <path d="M6 3.5V6l1.8 1.8" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Sort: ({ c, s = 11 }: { c: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M1 2.5h10M1 6h7M1 9.5h4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Cal: ({ c, s = 11 }: { c: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <rect x="1" y="2" width="10" height="9" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <line x1="1" y1="5.2" x2="11" y2="5.2" stroke={c} strokeWidth="1.2"/>
      <line x1="4" y1="0.5" x2="4" y2="3.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="0.5" x2="8" y2="3.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Tag: ({ c, s = 11 }: { c: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M1 1.5h4.2L11 7.3 7.3 11 1.5 5.2V1.5H1z" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="3.8" cy="3.8" r="0.9" fill={c}/>
    </svg>
  ),
  Star: ({ c, s = 11 }: { c: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M6 1L7.2 4.8H11.1L8 7.1 9.1 11 6 8.7 2.9 11 4 7.1 0.9 4.8H4.8L6 1Z" fill={c}/>
    </svg>
  ),
  Mic: ({ s = 17, c = "white" }: { s?: number; c?: string }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill={c}/>
      <path d="M5 11a7 7 0 0 0 14 0" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="18" x2="12" y2="22" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8"  y1="22" x2="16" y2="22" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Stop: ({ s = 17, c = "white" }: { s?: number; c?: string }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill={c}/>
    </svg>
  ),
  Spinner: ({ c, s = 13 }: { c: string; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2.5" strokeDasharray="40 20" strokeLinecap="round"/>
    </svg>
  ),
};

// ── Robot icon (no sparkle; viewBox cropped to head so it centers with text) ──
function BobIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <svg
      width={size}
      height={Math.round(size * (78 / 110))}
      viewBox="0 0 110 78"
      fill="none"
      style={{ flexShrink: 0, display: "block" }}
    >
      <rect x="0"   y="23" width="12" height="27" rx="6"   fill={color} />
      <rect x="98"  y="23" width="12" height="27" rx="6"   fill={color} />
      <rect x="13"  y="4"  width="84" height="70" rx="22"  stroke={color} strokeWidth="8" fill="none" />
      <rect x="24"  y="15" width="62" height="48" rx="13"  stroke={color} strokeWidth="5" fill="none" />
      <rect x="33"  y="28" width="16" height="16" rx="3.5" fill={color} />
      <rect x="61"  y="28" width="16" height="16" rx="3.5" fill={color} />
      <line x1="40" y1="52" x2="70"  y2="52" stroke={color} strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BobAgent({ theme: t, notes, onSweep, onAddNote }: Props) {
  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Brain
  const [brainQuery,    setBrainQuery]    = useState<BrainQuery | null>(null);
  const [brainLoading,  setBrainLoading]  = useState(false);
  const [brainResponse, setBrainResponse] = useState<string | null>(null);

  // Sweep
  const [sweepMode, setSweepMode] = useState<SweepMode>("priority");
  const [sweepDone, setSweepDone] = useState(false);

  // Voice
  const [listening,    setListening]    = useState(false);
  const [transcript,   setTranscript]   = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult,  setVoiceResult]  = useState<BobNewNote | null>(null);
  const [voiceAdded,   setVoiceAdded]   = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const containerRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Outside click → close
  useEffect(() => {
    if (!open || closing) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) doClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, closing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────
  function doOpen() {
    setOpen(true);
    setClosing(false);
    setBrainResponse(null);
    setSweepDone(false);
  }

  function doClose() {
    setClosing(true);
    // After close animation settles, fully unmount panel content
    setTimeout(() => { setOpen(false); setClosing(false); }, 400);
  }

  async function askBrain(query: BrainQuery) {
    setBrainQuery(query);
    setBrainLoading(true);
    setBrainResponse(null);
    try {
      const res  = await fetch("/api/bob", {
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
      setBrainResponse("Couldn't reach BOB right now.");
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
    r.continuous     = false;
    r.interimResults = true;
    r.lang           = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const txt = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>)
        .map(x => x[0].transcript).join(" ");
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

  function stopListening() { recognitionRef.current?.stop(); setListening(false); }

  async function parseVoice() {
    if (!transcript.trim()) return;
    setVoiceLoading(true);
    setVoiceResult(null);
    try {
      const res  = await fetch("/api/bob", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "voice", transcript }),
      });
      const data = await res.json();
      if (data.task) setVoiceResult(data.task as BobNewNote);
    } catch { /* leave null */ }
    finally { setVoiceLoading(false); }
  }

  function addVoiceNote(r: BobNewNote) {
    onAddNote(r);
    setVoiceAdded(true);
    setTimeout(() => { setVoiceAdded(false); setVoiceResult(null); setTranscript(""); }, 1800);
  }

  function handleSweep() {
    onSweep(computeSweep(notes, sweepMode));
    setSweepDone(true);
    setTimeout(() => setSweepDone(false), 2500);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isExpanded  = open && !closing;
  const hasSpeech   = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const ic          = T.text(t); // icon color
  const mu          = T.muted(t);

  // Apple DI easing: fast ease-out, zero overshoot → no sharp-box flash
  // Open:  width leads, height follows slightly after
  // Close: height leads, width follows slightly after
  const DI = "cubic-bezier(0.32, 0.72, 0, 1)";
  const transition = isExpanded
    ? [
        `width 0.38s ${DI}`,
        `max-height 0.36s ${DI} 0.04s`,
        `border-radius 0.35s ${DI}`,
        "box-shadow 0.28s ease 0.06s",
      ].join(", ")
    : [
        `max-height 0.26s ease-in`,
        `width 0.28s ease-in-out 0.04s`,
        `border-radius 0.26s ease-in`,
        "box-shadow 0.2s ease",
      ].join(", ");

  // Content fade: wait for shape, then appear; disappear immediately on close
  const contentOpacity    = isExpanded ? 1 : 0;
  const contentTransition = isExpanded
    ? "opacity 0.16s ease 0.22s"
    : "opacity 0.08s ease";

  return (
    <div
      ref={containerRef}
      style={{
        // ── Dynamic Island morph ──────────────────────────────────────────
        width:        open ? 560 : 88,
        maxHeight:    open ? 520 : 34,
        borderRadius: open ? 18  : 999,
        overflow: "hidden",
        willChange: "width, max-height, border-radius",
        transition,
        // ── Appearance ───────────────────────────────────────────────────
        backgroundColor: T.bg(t),
        backdropFilter:  "blur(22px)",
        WebkitBackdropFilter: "blur(22px)",
        border: `1px solid ${T.border(t)}`,
        boxShadow: open
          ? (t === "dark"
              ? "0 10px 48px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.07)"
              : "0 10px 40px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.04)")
          : (t === "dark"
              ? "0 2px 12px rgba(0,0,0,.45)"
              : "0 2px 8px rgba(0,0,0,.09)"),
        cursor:     open ? "default" : "pointer",
        userSelect: "none",
        zIndex: 30,
        position: "relative",
      }}
      onClick={!open ? doOpen : undefined}
    >
      {/* ── Pill / Header bar ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: open ? "space-between" : "flex-start",
        gap: 7,
        padding: open ? "10px 14px 9px" : "5px 10px 5px 7px",
        flexShrink: 0,
        minWidth: 0,
        whiteSpace: "nowrap",
        transition: "padding 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <BobIcon size={18} color={ic} />
          <span style={{
            fontSize:      13,
            fontWeight:    800,
            letterSpacing: "-.015em",
            color:         T.text(t),
            lineHeight:    1,
            fontFamily:    "'Satoshi', Arial, sans-serif",
          }}>
            BOB
          </span>
        </div>

        {open && (
          <button
            onClick={(e) => { e.stopPropagation(); doClose(); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: mu, fontSize: 18, lineHeight: 1,
              padding: "1px 4px", fontFamily: "inherit", flexShrink: 0,
              opacity: 0.7,
            }}
          >×</button>
        )}
      </div>

      {/* ── Three-column panel ─────────────────────────────────────────────── */}
      {mounted && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
          borderTop: `1px solid ${T.border(t)}`,
          opacity:    contentOpacity,
          transition: contentTransition,
          pointerEvents: isExpanded ? "auto" : "none",
        }}>

          {/* ───── Brain ───── */}
          <div style={{ padding: "11px 12px 13px", display: "flex", flexDirection: "column" }}>
            <ColLabel text="Brain" color={mu} />

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {([
                { key: "whatFirst" as BrainQuery, label: "What first?",  Icon: () => <I.Arrow c={ic} /> },
                { key: "summary"   as BrainQuery, label: "Summarize",    Icon: () => <I.Lines c={ic} /> },
                { key: "overdue"   as BrainQuery, label: "Overdue?",     Icon: () => <I.Clock c={ic} /> },
              ] as { key: BrainQuery; label: string; Icon: () => ReactElement }[]).map(({ key, label, Icon }) => (
                <BtnRow
                  key={key}
                  label={label}
                  icon={<Icon />}
                  active={brainQuery === key}
                  disabled={brainLoading}
                  dimmed={brainLoading && brainQuery !== key}
                  theme={t}
                  onClick={() => askBrain(key)}
                />
              ))}
            </div>

            {(brainLoading || brainResponse) && (
              <div style={{
                marginTop: 8, padding: "9px 10px", borderRadius: 9,
                background: T.btn(t), border: `1px solid ${T.btnBorder(t)}`,
                fontSize: 12, color: T.text(t), lineHeight: 1.65, minHeight: 36,
              }}>
                {brainLoading
                  ? <span style={{ display: "flex", alignItems: "center", gap: 6, color: mu }}>
                      <I.Spinner c={mu} /> Thinking…
                    </span>
                  : brainResponse}
              </div>
            )}
          </div>

          <Divider t={t} />

          {/* ───── Sweep ───── */}
          <div style={{ padding: "11px 12px 13px" }}>
            <ColLabel text="Sweep" color={mu} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
              {([
                { key: "priority" as SweepMode, label: "Priority", Icon: () => <I.Sort c={sweepMode === "priority" ? T.green(t) : ic} /> },
                { key: "dueDate"  as SweepMode, label: "Due Date", Icon: () => <I.Cal  c={sweepMode === "dueDate"  ? T.green(t) : ic} /> },
                { key: "type"     as SweepMode, label: "Type",     Icon: () => <I.Tag  c={sweepMode === "type"     ? T.green(t) : ic} /> },
                { key: "smart"    as SweepMode, label: "Smart",    Icon: () => <I.Star c={sweepMode === "smart"    ? T.green(t) : ic} /> },
              ] as { key: SweepMode; label: string; Icon: () => ReactElement }[]).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setSweepMode(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 8px", borderRadius: 8,
                    border: `1px solid ${sweepMode === key ? T.greenBdr(t) : T.btnBorder(t)}`,
                    background: sweepMode === key ? T.greenBg(t) : T.btn(t),
                    color: sweepMode === key ? T.green(t) : T.text(t),
                    fontSize: 11, fontWeight: sweepMode === key ? 700 : 500,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all .12s",
                  }}
                >
                  <Icon />{label}
                </button>
              ))}
            </div>

            <button
              onClick={handleSweep}
              disabled={notes.length === 0}
              style={{
                width: "100%", padding: "8px 0", borderRadius: 9,
                border: sweepDone ? `1px solid ${T.greenBdr(t)}` : "none",
                background: sweepDone ? T.greenBg(t) : "linear-gradient(135deg,#6fc46b,#4a7ef5)",
                color:      sweepDone ? T.green(t)   : "#fff",
                fontSize: 12, fontWeight: 700,
                cursor: notes.length === 0 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: notes.length === 0 ? .4 : 1,
                transition: "all .2s",
              } as React.CSSProperties}
            >
              {sweepDone
                ? "Sorted"
                : notes.length === 0
                  ? "No cards"
                  : `Sort ${notes.length} card${notes.length !== 1 ? "s" : ""}`}
            </button>
          </div>

          <Divider t={t} />

          {/* ───── Voice ───── */}
          <div style={{ padding: "11px 12px 13px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <ColLabel text="Voice" color={mu} fullWidth />

            {!hasSpeech ? (
              <p style={{ fontSize: 11, color: mu, margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                Use Chrome or Edge for voice input.
              </p>
            ) : (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                <button
                  onClick={listening ? stopListening : startListening}
                  style={{
                    width: 44, height: 44, borderRadius: "50%", border: "none",
                    background: listening
                      ? "linear-gradient(135deg,#e05555,#c03030)"
                      : "linear-gradient(135deg,#6fc46b,#4a7ef5)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: listening
                      ? "0 0 0 6px rgba(192,48,48,.16), 0 3px 14px rgba(192,48,48,.28)"
                      : "0 3px 14px rgba(74,126,245,.28)",
                    transition: "background .2s, box-shadow .2s",
                    animation: listening ? "micPulse 1.2s ease-in-out infinite" : "none",
                    flexShrink: 0,
                  }}
                >
                  {listening ? <I.Stop /> : <I.Mic />}
                </button>

                {!transcript && !listening && !voiceResult && !voiceAdded && (
                  <span style={{ fontSize: 11, color: mu }}>Tap mic and speak</span>
                )}

                {transcript && (
                  <div style={{
                    width: "100%", fontSize: 11, color: T.text(t), lineHeight: 1.55,
                    padding: "7px 9px", borderRadius: 8,
                    background: T.btn(t), border: `1px solid ${T.btnBorder(t)}`,
                  }}>
                    {transcript}
                    {listening && <span style={{ opacity: .4 }}>█</span>}
                  </div>
                )}

                {transcript && !listening && !voiceLoading && !voiceResult && (
                  <button onClick={parseVoice} style={{
                    width: "100%", padding: "7px 0", borderRadius: 9, border: "none",
                    background: "linear-gradient(135deg,#6fc46b,#4a7ef5)",
                    color: "#fff", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    Structure with BOB
                  </button>
                )}

                {voiceLoading && (
                  <span style={{ fontSize: 11, color: mu, display: "flex", alignItems: "center", gap: 5 }}>
                    <I.Spinner c={mu} s={11} /> Structuring…
                  </span>
                )}

                {voiceResult && !voiceAdded && (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 5, marginBottom: 2,
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: voiceResult.type === "task" ? "#4a7ef5" : "#9b6fe8",
                        background: voiceResult.type === "task" ? "rgba(74,126,245,.12)" : "rgba(155,111,232,.12)",
                        padding: "2px 6px", borderRadius: 5,
                      }}>{voiceResult.type}</span>
                      {voiceResult.importance !== "none" && (
                        <span style={{ fontSize: 10, color: mu }}>{voiceResult.importance}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text(t), lineHeight: 1.4 }}>
                      {voiceResult.title}
                    </div>
                    {voiceResult.body && (
                      <div style={{ fontSize: 11, color: mu }}>{voiceResult.body}</div>
                    )}
                    <button onClick={() => addVoiceNote(voiceResult!)} style={{
                      width: "100%", padding: "7px 0", borderRadius: 9, border: "none",
                      background: "linear-gradient(135deg,#6fc46b,#4a7ef5)",
                      color: "#fff", fontSize: 11, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>
                      Add to board
                    </button>
                  </div>
                )}

                {voiceAdded && (
                  <span style={{ fontSize: 12, color: T.green(t), fontWeight: 700 }}>Added</span>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColLabel({ text, color, fullWidth }: { text: string; color: string; fullWidth?: boolean }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color,
      textTransform: "uppercase", letterSpacing: ".08em",
      marginBottom: 8,
      width: fullWidth ? "100%" : undefined,
    }}>
      {text}
    </div>
  );
}

function Divider({ t }: { t: ThemeMode }) {
  return <div style={{ width: 1, background: T.divider(t) }} />;
}

function BtnRow({
  label, icon, active, disabled, dimmed, theme, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  disabled: boolean;
  dimmed: boolean;
  theme: ThemeMode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "7px 10px", borderRadius: 9,
        border: `1px solid ${active ? T.greenBdr(theme) : T.btnBorder(theme)}`,
        background: active ? T.greenBg(theme) : T.btn(theme),
        color: T.text(theme),
        fontSize: 12, fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit", textAlign: "left",
        opacity: dimmed ? 0.38 : 1,
        transition: "all .12s",
        width: "100%",
      }}
    >
      <span style={{ flexShrink: 0, opacity: active ? 1 : .55 }}>{icon}</span>
      {label}
    </button>
  );
}
