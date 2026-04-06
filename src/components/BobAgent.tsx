"use client";

import { useState, useEffect, useRef, useCallback, type ReactElement } from "react";
import type { ThemeMode, Note, Importance } from "@/lib/board";

// ── Types ────────────────────────────────────────────────────────────────────
type BrainQuery = "whatFirst" | "summary" | "overdue";
type SweepMode  = "priority" | "dueDate" | "type" | "smart";

export type BobSweepResult = { id: number; x: number; y: number }[];
export type BobNewNote = {
  type: "task" | "idea";
  title: string;
  body: string;
  importance: Importance;
  steps: { title: string; minutes: number }[];
};

type QuickAction =
  | { id: string; label: string; type: "brain"; query: BrainQuery }
  | { id: string; label: string; type: "sweep"; mode: SweepMode }
  | { id: string; label: string; type: "chat" };

interface Props {
  theme: ThemeMode;
  notes: Note[];
  onSweep: (positions: BobSweepResult) => void;
  onAddNote: (note: BobNewNote) => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_ACTIONS: QuickAction[] = [];
const ACTIONS_KEY = "bob_quick_actions";

function loadActions(): QuickAction[] {
  try { const r = localStorage.getItem(ACTIONS_KEY); if (r) return JSON.parse(r); } catch {}
  return DEFAULT_ACTIONS;
}
function saveActions(a: QuickAction[]) {
  try { localStorage.setItem(ACTIONS_KEY, JSON.stringify(a)); } catch {}
}

// ── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg:        (t: ThemeMode) => t === "dark" ? "rgba(16,18,22,.98)" : "rgba(252,252,250,.99)",
  border:    (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.1)"  : "rgba(17,19,21,.1)",
  text:      (t: ThemeMode) => t === "dark" ? "#ededeb"               : "#111315",
  muted:     (t: ThemeMode) => t === "dark" ? "rgba(237,237,235,.38)" : "rgba(17,19,21,.38)",
  chip:      (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.07)" : "rgba(17,19,21,.05)",
  chipBdr:   (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.1)"  : "rgba(17,19,21,.1)",
  input:     (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.05)" : "rgba(17,19,21,.04)",
  inputBdr:  (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.09)" : "rgba(17,19,21,.09)",
};

// ── Sweep ────────────────────────────────────────────────────────────────────
function computeSweep(notes: Note[], mode: SweepMode): BobSweepResult {
  const CARD_W = 252, ROW_H = 168, COL_GAP = 22, ROW_GAP = 18, COLS = 5, START_X = 60, START_Y = 72;
  const sorted = notes.filter(n => !n.completed);
  if (mode === "priority") {
    const r: Record<string, number> = { High: 0, Medium: 1, Low: 2, none: 3 };
    sorted.sort((a, b) => (r[a.importance ?? "none"] ?? 3) - (r[b.importance ?? "none"] ?? 3));
  } else if (mode === "dueDate") {
    sorted.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1; if (!b.dueDate) return -1;
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

// ── Icons ────────────────────────────────────────────────────────────────────
// Animated speech-wave bars — 4 vertical bars that pump when listening
function SpeechWave({ c, listening, s = 16 }: { c: string; listening: boolean; s?: number }) {
  const bars = [
    { x: 1,    h: 5,  aH: 13, delay: "0s"    },
    { x: 5.5,  h: 9,  aH: 14, delay: "0.13s" },
    { x: 10,   h: 9,  aH: 14, delay: "0.26s" },
    { x: 14.5, h: 5,  aH: 13, delay: "0.07s" },
  ];
  const VH = 14;
  return (
    <svg width={s} height={Math.round(s * VH / 18)} viewBox="0 0 18 14" fill="none">
      {bars.map((b, i) => {
        const sy = (VH - b.h) / 2;
        const ay = (VH - b.aH) / 2;
        return (
          <rect key={i} x={b.x} width={2.5} rx={1.25} fill={c} y={sy} height={b.h}>
            {listening && (
              <>
                <animate attributeName="height" values={`${b.h};${b.aH};${b.h}`} dur="0.65s" begin={b.delay} repeatCount="indefinite"/>
                <animate attributeName="y"      values={`${sy};${ay};${sy}`}     dur="0.65s" begin={b.delay} repeatCount="indefinite"/>
              </>
            )}
          </rect>
        );
      })}
    </svg>
  );
}
function Send({ c, s = 14 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M1 7h12M8 2l5 5-5 5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function Spinner({ c, s = 13 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2.5" strokeDasharray="40 20" strokeLinecap="round"/>
    </svg>
  );
}

// ── Robot icon ────────────────────────────────────────────────────────────────
// viewBox 0 0 110 78 (no sparkle) — robot is vertically centered in bounds
function BobIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={Math.round(size * (78 / 110))} viewBox="0 0 110 78" fill="none" style={{ flexShrink: 0, display: "block" }}>
      <rect x="0"  y="23" width="12" height="27" rx="6"   fill={color}/>
      <rect x="98" y="23" width="12" height="27" rx="6"   fill={color}/>
      <rect x="13" y="4"  width="84" height="70" rx="22"  stroke={color} strokeWidth="8"  fill="none"/>
      <rect x="24" y="15" width="62" height="48" rx="13"  stroke={color} strokeWidth="5"  fill="none"/>
      <rect x="33" y="28" width="16" height="16" rx="3.5" fill={color}/>
      <rect x="61" y="28" width="16" height="16" rx="3.5" fill={color}/>
      <line x1="40" y1="52" x2="70" y2="52" stroke={color} strokeWidth="5.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BobAgent({ theme: t, notes, onSweep, onAddNote }: Props) {
  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Conversation
  const [inputText, setInputText] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [response,  setResponse]  = useState<string | null>(null);

  // Quick actions
  const [quickActions,    setQuickActions]    = useState<QuickAction[]>(DEFAULT_ACTIONS);
  const [addingAction,    setAddingAction]    = useState(false);
  const [newActionLabel,  setNewActionLabel]  = useState("");
  const [hoveredChip,     setHoveredChip]     = useState<string | null>(null);

  // Voice
  const [listening,  setListening]  = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setQuickActions(loadActions());
  }, []);

  useEffect(() => {
    if (!open || closing) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) doClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, closing]); // eslint-disable-line react-hooks/exhaustive-deps

  function doOpen()  { setOpen(true);  setClosing(false); setResponse(null); }
  function doClose() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 380);
  }

  // ── API calls ────────────────────────────────────────────────────────────
  const noteSnaps = notes.map(n => ({
    id: n.id, type: n.type, title: n.title, body: n.body,
    importance: n.importance, dueDate: n.dueDate, minutes: n.minutes,
    completed: n.completed,
    steps: n.steps.map(s => ({ title: s.title, minutes: s.minutes, done: s.done })),
  }));

  async function callApi(body: object): Promise<string> {
    const res  = await fetch("/api/bob", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.response ?? data.error ?? "Something went wrong.";
  }

  async function send(message?: string) {
    const msg = (message ?? inputText).trim();
    if (!msg || loading) return;
    setInputText("");
    setLoading(true);
    setResponse(null);
    try {
      const text = await callApi({ action: "chat", message: msg, notes: noteSnaps });
      setResponse(text);
    } catch { setResponse("Couldn't reach BOB right now."); }
    finally  { setLoading(false); }
  }

  async function brainQuery(query: BrainQuery) {
    setLoading(true);
    setResponse(null);
    try {
      const text = await callApi({ action: "brain", query, notes: noteSnaps });
      setResponse(text);
    } catch { setResponse("Couldn't reach BOB right now."); }
    finally  { setLoading(false); }
  }

  function handleQuickAction(action: QuickAction) {
    if (action.type === "brain") {
      brainQuery(action.query);
    } else if (action.type === "sweep") {
      const label = action.mode === "priority" ? "priority" : action.mode === "dueDate" ? "due date" : action.mode === "type" ? "type" : "alphabetically";
      onSweep(computeSweep(notes, action.mode));
      setResponse(`Sorted your board by ${label}.`);
    } else {
      send(action.label);
    }
  }

  function addAction() {
    const label = newActionLabel.trim();
    if (!label) return;
    const updated = [...quickActions, { id: Date.now().toString(), label, type: "chat" as const }];
    setQuickActions(updated);
    saveActions(updated);
    setAddingAction(false);
    setNewActionLabel("");
  }

  function deleteAction(id: string) {
    const updated = quickActions.filter(a => a.id !== id);
    setQuickActions(updated);
    saveActions(updated);
  }

  // ── Voice ────────────────────────────────────────────────────────────────
  const hasSpeech = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR();
    r.continuous = false; r.interimResults = true; r.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const txt = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>)
        .map(x => x[0].transcript).join(" ");
      setInputText(txt);
    };
    r.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      setListening(false);
      // Only surface an error for hard permission denials; everything else silently resets
      if (e.error === "service-not-allowed") {
        setResponse("Voice input isn't available in this browser. Try typing instead.");
      }
      // "not-allowed" can fire even when OS mic is on if the browser site permission
      // is 'Ask' — the browser will show its own prompt, so we don't need to say anything.
    };
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }, []);

  function stopListening() { recognitionRef.current?.stop(); setListening(false); }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isExpanded = open && !closing;
  const ic = T.text(t);
  const mu = T.muted(t);

  // Icon=20px wide, gap=8, "BOB"≈26px, padding=16×2 → ~86px natural content width
  const PILL_W  = 90;
  const OPEN_W  = 480;
  const PILL_H  = 44;

  const DI = "cubic-bezier(0.32, 0.72, 0, 1)";
  const transition = isExpanded
    ? [`width 0.38s ${DI}`, `max-height 0.36s ${DI} 0.03s`, `border-radius 0.34s ${DI}`].join(", ")
    : [`max-height 0.24s ease-in`, `width 0.26s ease-in 0.02s`, `border-radius 0.24s ease-in`].join(", ");

  const contentOpacity    = isExpanded ? 1 : 0;
  const contentTransition = isExpanded ? "opacity 0.15s ease 0.2s" : "opacity 0.07s ease";

  // Same base color for both collapsed and expanded — just vary opacity
  const pillBg  = t === "dark" ? "rgba(22,24,28,.72)"  : "rgba(255,255,255,.72)";
  const openBg  = t === "dark" ? "rgba(22,24,28,.94)"  : "rgba(255,255,255,.94)";
  const pillBdr = t === "dark" ? "rgba(255,255,255,.16)" : "rgba(17,19,21,.16)";

  return (
    <div
      ref={containerRef}
      style={{
        width:        open ? OPEN_W : PILL_W,
        maxHeight:    open ? 480    : PILL_H,
        borderRadius: open ? 18     : 999,
        overflow: "hidden",
        willChange: "width, max-height, border-radius",
        transition,
        backgroundColor: open ? openBg : pillBg,
        backdropFilter:       "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${pillBdr}`,
        boxShadow: open
          ? (t === "dark"
              ? "0 12px 48px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.07)"
              : "0 12px 40px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)")
          : "none",
        cursor:     open ? "default" : "pointer",
        userSelect: "none",
        zIndex: 30,
        position: "relative",
      }}
      onClick={!open ? doOpen : undefined}
    >
      {/* ── Header — fixed PILL_H height when closed keeps content vertically centered ── */}
      <div style={{
        height:         open ? "auto" : PILL_H,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        position:       "relative",
        padding:        open ? "10px 14px" : "0",
        flexShrink:     0,
        whiteSpace:     "nowrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BobIcon size={20} color={ic} />
          <span style={{
            fontSize: 13, fontWeight: 800, letterSpacing: "-.015em",
            color: T.text(t), lineHeight: 1,
            fontFamily: "'Satoshi', Arial, sans-serif",
          }}>BOB</span>
        </div>
        {open && (
          <button
            onClick={(e) => { e.stopPropagation(); doClose(); }}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: mu, fontSize: 18, lineHeight: 1, padding: "2px 4px",
              fontFamily: "inherit", opacity: .65,
            }}
          >×</button>
        )}
      </div>

      {/* ── Panel ────────────────────────────────────────────────────────────── */}
      {mounted && (
        <div style={{
          display: "flex", flexDirection: "column",
          borderTop: `1px solid ${T.border(t)}`,
          opacity:    contentOpacity,
          transition: contentTransition,
          pointerEvents: isExpanded ? "auto" : "none",
        }}>

          {/* Response area */}
          {(loading || response) && (
            <div style={{
              padding: "13px 14px 12px",
              fontSize: 13, color: T.text(t), lineHeight: 1.7,
              borderBottom: `1px solid ${T.border(t)}`,
              maxHeight: 180, overflowY: "auto",
            }}>
              {loading
                ? <span style={{ display: "flex", alignItems: "center", gap: 7, color: mu }}>
                    <Spinner c={mu} /> Thinking…
                  </span>
                : response}
            </div>
          )}

          {/* Input row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 10px",
            borderBottom: `1px solid ${T.border(t)}`,
          }}>
            {hasSpeech && (
              <button
                onClick={listening ? stopListening : startListening}
                title={listening ? "Stop listening" : "Speak to BOB"}
                style={{
                  width: 30, height: 30, borderRadius: "50%", border: "none", flexShrink: 0,
                  background: listening
                    ? "rgba(192,48,48,.18)"
                    : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  animation: listening ? "micPulse 1.2s ease-in-out infinite" : "none",
                  transition: "background .2s",
                }}
              >
                <SpeechWave
                  listening={listening}
                  s={15}
                  c={listening
                    ? "#e05555"
                    : t === "dark" ? "rgba(237,237,235,.55)" : "rgba(17,19,21,.4)"}
                />
              </button>
            )}

            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
              placeholder="Ask anything about your board…"
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontSize: 13, color: T.text(t), fontFamily: "'Satoshi', Arial, sans-serif",
                caretColor: T.text(t),
              }}
            />

            <button
              onClick={() => send()}
              disabled={!inputText.trim() || loading}
              style={{
                width: 28, height: 28, borderRadius: 8, border: "none", flexShrink: 0,
                background: inputText.trim() && !loading
                  ? t === "dark" ? "rgba(255,255,255,.18)" : "rgba(17,19,21,.14)"
                  : "transparent",
                cursor: inputText.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background .15s",
              }}
            >
              <Send c={inputText.trim() && !loading ? T.text(t) : mu} />
            </button>
          </div>

          {/* Quick actions */}
          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center",
            gap: 6, padding: "8px 10px 10px",
          }}>
            {quickActions.map(action => (
              <div
                key={action.id}
                style={{ position: "relative", display: "inline-flex" }}
                onMouseEnter={() => setHoveredChip(action.id)}
                onMouseLeave={() => setHoveredChip(null)}
              >
                <button
                  onClick={() => handleQuickAction(action)}
                  disabled={loading}
                  style={{
                    padding: "4px 10px", borderRadius: 99,
                    border:  `1px solid ${T.chipBdr(t)}`,
                    background: T.chip(t),
                    color:  T.text(t), fontSize: 11.5, fontWeight: 500,
                    cursor: loading ? "default" : "pointer",
                    fontFamily: "'Satoshi', Arial, sans-serif",
                    opacity: loading ? .5 : 1,
                    transition: "all .12s",
                    paddingRight: hoveredChip === action.id ? 22 : 10,
                  }}
                >
                  {action.label}
                </button>
                {hoveredChip === action.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAction(action.id); }}
                    style={{
                      position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: mu, fontSize: 12, lineHeight: 1, padding: 0,
                      display: "flex", alignItems: "center",
                    }}
                  >×</button>
                )}
              </div>
            ))}

            {/* Add new action */}
            {addingAction ? (
              <input
                autoFocus
                value={newActionLabel}
                onChange={e => setNewActionLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter")  addAction();
                  if (e.key === "Escape") { setAddingAction(false); setNewActionLabel(""); }
                }}
                onBlur={() => { if (!newActionLabel.trim()) { setAddingAction(false); } }}
                placeholder="Name this action…"
                style={{
                  padding: "4px 12px", borderRadius: 99,
                  border: `1px solid ${T.chipBdr(t)}`,
                  background: T.chip(t),
                  color: T.text(t), fontSize: 11.5,
                  fontFamily: "'Satoshi', Arial, sans-serif",
                  outline: "none", flex: 1, minWidth: 0,
                }}
              />
            ) : (
              <button
                onClick={() => setAddingAction(true)}
                style={{
                  padding: "4px 12px", borderRadius: 99,
                  border:  `1px dashed ${T.chipBdr(t)}`,
                  background: "transparent",
                  color: mu, fontSize: 11.5, cursor: "pointer",
                  fontFamily: "'Satoshi', Arial, sans-serif",
                  whiteSpace: "nowrap",
                }}
              >+ Add Quick Action</button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
