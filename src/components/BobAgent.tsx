"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ThemeMode, Note, Importance } from "@/lib/board";

// ── Types ────────────────────────────────────────────────────────────────────
type BrainQuery = "whatFirst" | "summary" | "overdue";
type SweepMode  = "priority" | "dueDate" | "type" | "smart";
type Mode       = "advisor" | "assistant" | "autopilot";

export type BobSweepResult = { id: number; x: number; y: number }[];
export type BobNewNote = {
  type: "task" | "thought";
  title: string;
  body?: string;
  importance?: Importance;
  dueDate?: string;
  steps?: { title: string; minutes: number }[];
};

type QuickAction =
  | { id: string; label: string; type: "brain"; query: BrainQuery }
  | { id: string; label: string; type: "sweep"; mode: SweepMode }
  | { id: string; label: string; type: "chat" };

type ChatMessage = { role: "user" | "bob"; content: string; streaming?: boolean };
type HistoryMsg  = { role: "user" | "assistant"; content: string };

interface Props {
  theme: ThemeMode;
  notes: Note[];
  onSweep: (positions: BobSweepResult) => void;
  onAddNote: (note: BobNewNote) => void;
  onEditNote: (id: number, fields: Partial<Note>) => void;
  onDeleteNotes: (ids: number[]) => void;
  onHighlightNotes: (ids: number[]) => void;
  onLaunchFocus: (noteId: number, chain?: boolean) => void;
  onSaveUndo: () => void;
  onUndo: () => void;
  isAdmin?: boolean;
}

// ── Quick actions ─────────────────────────────────────────────────────────────
const DEFAULT_ACTIONS: QuickAction[] = [];
const ACTIONS_KEY = "bob_quick_actions";
const MODE_KEY    = "bob_mode";

function loadActions(): QuickAction[] {
  try { const r = localStorage.getItem(ACTIONS_KEY); if (r) return JSON.parse(r); } catch {}
  return DEFAULT_ACTIONS;
}
function saveActions(a: QuickAction[]) {
  try { localStorage.setItem(ACTIONS_KEY, JSON.stringify(a)); } catch {}
}
function loadMode(): Mode {
  try { const m = localStorage.getItem(MODE_KEY); if (m === "advisor" || m === "assistant" || m === "autopilot") return m; } catch {}
  return "assistant";
}
function saveMode(m: Mode) {
  try { localStorage.setItem(MODE_KEY, m); } catch {}
}

// ── Compute sweep (client-side fallback) ──────────────────────────────────────
function computeSweep(notes: Note[], mode: SweepMode): BobSweepResult {
  const CARD_W = 252, ROW_H = 168, COL_GAP = 22, ROW_GAP = 18, COLS = 5, SX = 60, SY = 72;
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
    x: SX + (i % COLS) * (CARD_W + COL_GAP),
    y: SY + Math.floor(i / COLS) * (ROW_H + ROW_GAP),
  }));
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:       (t: ThemeMode) => t === "dark" ? "rgba(16,18,22,.98)"        : "rgba(252,252,250,.99)",
  border:   (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.1)"       : "rgba(17,19,21,.1)",
  text:     (t: ThemeMode) => t === "dark" ? "#ededeb"                    : "#111315",
  muted:    (t: ThemeMode) => t === "dark" ? "rgba(237,237,235,.38)"      : "rgba(17,19,21,.38)",
  chip:     (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.07)"      : "rgba(17,19,21,.05)",
  chipBdr:  (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.1)"       : "rgba(17,19,21,.1)",
  userBub:  (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.08)"      : "rgba(17,19,21,.06)",
  modeBg:   (t: ThemeMode) => t === "dark" ? "rgba(255,255,255,.1)"       : "rgba(17,19,21,.09)",
};

const MODE_LABELS: Record<Mode, string> = {
  advisor:   "Advisor",
  assistant: "Assistant",
  autopilot: "Autopilot",
};

// ── Icons ─────────────────────────────────────────────────────────────────────
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
        const sy = (VH - b.h) / 2, ay = (VH - b.aH) / 2;
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
export default function BobAgent({
  theme: t, notes, onSweep, onAddNote, onEditNote, onDeleteNotes,
  onHighlightNotes, onLaunchFocus, onSaveUndo, onUndo, isAdmin = true,
}: Props) {
  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Conversation
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [inputText,  setInputText]  = useState("");
  const [streaming,  setStreaming]  = useState(false);
  const [history,    setHistory]    = useState<HistoryMsg[]>([]);

  // Quick actions
  const [quickActions,   setQuickActions]   = useState<QuickAction[]>(DEFAULT_ACTIONS);
  const [addingAction,   setAddingAction]   = useState(false);
  const [newActionLabel, setNewActionLabel] = useState("");
  const [hoveredChip,    setHoveredChip]    = useState<string | null>(null);

  // Mode
  const [mode, setMode] = useState<Mode>("assistant");

  // Usage tracking
  const usage       = useQuery(api.bob.getUsage);
  const recordUsage = useMutation(api.bob.recordUsage);

  // Voice
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setQuickActions(loadActions());
    setMode(loadMode());
  }, []);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!open || closing) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) doClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, closing]); // eslint-disable-line react-hooks/exhaustive-deps

  function doOpen()  { setOpen(true); setClosing(false); }
  function doClose() {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setMessages([]);
      setHistory([]);
    }, 380);
  }

  function changeMode(m: Mode) { setMode(m); saveMode(m); }

  // ── Note snaps for API ───────────────────────────────────────────────────
  const noteSnaps = notes.map(n => ({
    id: n.id, type: n.type, title: n.title, body: n.body,
    importance: n.importance, dueDate: n.dueDate, minutes: n.minutes,
    completed: n.completed, x: n.x, y: n.y,
    steps: n.steps.map(s => ({ title: s.title, minutes: s.minutes, done: s.done })),
  }));

  // ── Execute tool calls from BOB ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function executeTool(name: string, input: any) {
    switch (name) {
      case "create_note":
        onAddNote({
          type: input.type === "task" ? "task" : "thought",
          title: input.title ?? "Untitled",
          body: input.body,
          importance: input.importance ?? "none",
          dueDate: input.dueDate,
          steps: input.steps ?? [],
        });
        break;
      case "edit_note":
        if (typeof input.id === "number" && input.fields)
          onEditNote(input.id, input.fields);
        break;
      case "delete_notes":
        if (Array.isArray(input.ids))
          onDeleteNotes(input.ids);
        break;
      case "organize_board":
        if (Array.isArray(input.positions))
          onSweep(input.positions);
        break;
      case "highlight_notes":
        if (Array.isArray(input.ids))
          onHighlightNotes(input.ids);
        break;
      case "launch_focus":
        if (typeof input.noteId === "number")
          onLaunchFocus(input.noteId, input.chain ?? false);
        break;
    }
  }

  // ── Main send ────────────────────────────────────────────────────────────
  async function send(message?: string) {
    const msg = (message ?? inputText).trim();
    if (!msg || streaming) return;

    // Quota check — block if Plus monthly limit is exhausted
    if (usage !== undefined && usage !== null && usage.isPlus && usage.remaining <= 0) {
      setMessages(prev => [
        ...prev,
        { role: "user", content: msg },
        { role: "bob", content: "You've used your monthly BOB tokens. Upgrade to Plus or buy credits to continue." },
      ]);
      setInputText("");
      return;
    }
    setInputText("");

    // Undo detection — handle locally without API call
    if (/^undo$/i.test(msg) || /^undo (last|that|it)$/i.test(msg)) {
      onUndo();
      setMessages(prev => [
        ...prev,
        { role: "user", content: msg },
        { role: "bob",  content: "Reverted my last action." },
      ]);
      return;
    }

    // Save undo snapshot before any action
    onSaveUndo();

    // Add user message + empty streaming BOB message
    setMessages(prev => [
      ...prev,
      { role: "user", content: msg },
      { role: "bob",  content: "", streaming: true },
    ]);
    setStreaming(true);

    let bobText = "";

    try {
      const res = await fetch("/api/bob", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, notes: noteSnaps, mode, history }),
      });

      if (!res.body) throw new Error("No stream");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "token") {
              bobText += data.text;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "bob", content: bobText, streaming: true };
                return next;
              });
            } else if (data.type === "usage") {
              recordUsage({ inputTokens: data.inputTokens, outputTokens: data.outputTokens }).catch(() => {});
            } else if (data.type === "tool") {
              executeTool(data.name, data.input);
            } else if (data.type === "done") {
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "bob", content: bobText, streaming: false };
                return next;
              });
            } else if (data.type === "error") {
              bobText = "Something went wrong. Try again.";
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "bob", content: bobText, streaming: false };
                return next;
              });
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: "bob", content: "Couldn't reach BOB right now.", streaming: false };
        return next;
      });
      bobText = "Couldn't reach BOB right now.";
    } finally {
      setStreaming(false);
      // Update rolling history (last 6 messages)
      setHistory(prev => (([
        ...prev,
        { role: "user"      as const, content: msg    },
        { role: "assistant" as const, content: bobText },
      ]).slice(-6)));
    }
  }

  // ── Quick actions ────────────────────────────────────────────────────────
  function handleQuickAction(action: QuickAction) {
    if (action.type === "brain") {
      const prompts: Record<string, string> = {
        whatFirst: "What should I work on first?",
        summary:   "Summarize my board.",
        overdue:   "What's overdue or coming up soon?",
      };
      send(prompts[action.query] ?? action.label);
    } else if (action.type === "sweep") {
      onSaveUndo();
      onSweep(computeSweep(notes, action.mode));
      setMessages(prev => [...prev, { role: "bob", content: `Organized your board by ${action.mode}.` }]);
    } else {
      send(action.label);
    }
  }

  function addAction() {
    const label = newActionLabel.trim();
    if (!label) return;
    const updated = [...quickActions, { id: Date.now().toString(), label, type: "chat" as const }];
    setQuickActions(updated); saveActions(updated);
    setAddingAction(false); setNewActionLabel("");
  }
  function deleteAction(id: string) {
    const updated = quickActions.filter(a => a.id !== id);
    setQuickActions(updated); saveActions(updated);
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
      if (e.error === "service-not-allowed")
        setMessages(prev => [...prev, { role: "bob", content: "Voice input isn't supported in this browser." }]);
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

  const PILL_W = 90, OPEN_W = 480, PILL_H = 44;
  const DI = "cubic-bezier(0.32, 0.72, 0, 1)";
  const transition = isExpanded
    ? [`width 0.38s ${DI}`, `max-height 0.36s ${DI} 0.03s`, `border-radius 0.34s ${DI}`].join(", ")
    : [`max-height 0.24s ease-in`, `width 0.26s ease-in 0.02s`, `border-radius 0.24s ease-in`].join(", ");

  const contentOpacity    = isExpanded ? 1 : 0;
  const contentTransition = isExpanded ? "opacity 0.15s ease 0.2s" : "opacity 0.07s ease";

  const pillBg  = t === "dark" ? "rgba(22,24,28,.72)"   : "rgba(255,255,255,.72)";
  const openBg  = t === "dark" ? "rgba(22,24,28,.94)"   : "rgba(255,255,255,.94)";
  const pillBdr = t === "dark" ? "rgba(255,255,255,.16)" : "rgba(17,19,21,.16)";

  return (
    <div
      ref={containerRef}
      style={{
        width: open ? OPEN_W : PILL_W, maxHeight: open ? 560 : PILL_H,
        borderRadius: open ? 18 : 999, overflow: "hidden",
        willChange: "width, max-height, border-radius", transition,
        backgroundColor: open ? openBg : pillBg,
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${pillBdr}`,
        boxShadow: open
          ? (t === "dark"
              ? "0 12px 48px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.07)"
              : "0 12px 40px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)")
          : "none",
        cursor: open ? "default" : "pointer",
        userSelect: "none", zIndex: 30, position: "relative",
      }}
      onClick={!open ? doOpen : undefined}
    >
      {/* ── Header ── */}
      <div style={{
        height: open ? "auto" : PILL_H,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", padding: open ? "10px 14px" : "0",
        flexShrink: 0, whiteSpace: "nowrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BobIcon size={20} color={ic} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.015em", color: ic, lineHeight: 1, fontFamily: "'Satoshi', Arial, sans-serif" }}>BOB</span>
        </div>
        {open && (
          <button onClick={(e) => { e.stopPropagation(); doClose(); }} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: mu, fontSize: 18, lineHeight: 1, padding: "2px 4px", opacity: .65,
          }}>×</button>
        )}
      </div>

      {/* ── Panel ── */}
      {mounted && (
        <div style={{
          display: "flex", flexDirection: "column",
          borderTop: `1px solid ${T.border(t)}`,
          opacity: contentOpacity, transition: contentTransition,
          pointerEvents: isExpanded ? "auto" : "none",
        }}>
          {(!isAdmin && !usage?.isPlus) ? (
            /* Plus-only gate */
            <div style={{ padding: "20px 18px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
              <BobIcon size={28} color={mu} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: ic, fontFamily: "'Satoshi', Arial, sans-serif" }}>BOB is a Plus feature</span>
                <span style={{ fontSize: 12, color: mu, lineHeight: 1.55, maxWidth: 260, fontFamily: "'Satoshi', Arial, sans-serif" }}>
                  Your AI board brain — smart prioritization, voice tasks, autopilot sweeps, and more.
                </span>
              </div>
              <a
                href="/billing"
                style={{
                  display: "inline-block", padding: "7px 18px", borderRadius: 99,
                  background: t === "dark" ? "rgba(255,255,255,.12)" : "rgba(17,19,21,.1)",
                  color: ic, fontSize: 12, fontWeight: 700,
                  textDecoration: "none", fontFamily: "'Satoshi', Arial, sans-serif",
                }}
              >Upgrade to Plus →</a>
            </div>
          ) : (
            <>
              {/* ── Conversation area ── */}
              {messages.length > 0 && (
                <div
                  ref={scrollRef}
                  style={{
                    maxHeight: 240, overflowY: "auto", padding: "10px 14px 4px",
                    display: "flex", flexDirection: "column", gap: 8,
                    borderBottom: `1px solid ${T.border(t)}`,
                  }}
                >
                  {messages.map((msg, i) => (
                    <div key={i} style={{
                      display: "flex",
                      flexDirection: msg.role === "user" ? "row-reverse" : "row",
                      alignItems: "flex-start", gap: 6,
                    }}>
                      {msg.role === "bob" && (
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          <BobIcon size={14} color={mu} />
                        </div>
                      )}
                      <div style={{
                        maxWidth: "82%",
                        padding: msg.role === "user" ? "5px 10px" : "0",
                        borderRadius: 10,
                        background: msg.role === "user" ? T.userBub(t) : "transparent",
                        fontSize: 12.5, color: msg.role === "user" ? T.text(t) : T.text(t),
                        lineHeight: 1.65, fontFamily: "'Satoshi', Arial, sans-serif",
                      }}>
                        {msg.content || (msg.streaming && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: mu }}>
                            <Spinner c={mu} s={11} /> thinking…
                          </span>
                        ))}
                        {msg.streaming && msg.content && <span style={{ opacity: .5, animation: "pulse 1s ease infinite" }}>▍</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Input row ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderBottom: `1px solid ${T.border(t)}` }}>
                {hasSpeech && (
                  <button
                    onClick={listening ? stopListening : startListening}
                    title={listening ? "Stop" : "Speak to BOB"}
                    style={{
                      width: 30, height: 30, borderRadius: "50%", border: "none", flexShrink: 0,
                      background: listening ? "rgba(192,48,48,.18)" : "transparent",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      animation: listening ? "micPulse 1.2s ease-in-out infinite" : "none",
                      transition: "background .2s",
                    }}
                  >
                    <SpeechWave listening={listening} s={15}
                      c={listening ? "#e05555" : t === "dark" ? "rgba(237,237,235,.55)" : "rgba(17,19,21,.4)"} />
                  </button>
                )}
                <input
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={mode === "autopilot" ? "Tell BOB what to do…" : mode === "advisor" ? "Ask BOB anything…" : "Ask or tell BOB…"}
                  style={{
                    flex: 1, border: "none", outline: "none", background: "transparent",
                    fontSize: 13, color: T.text(t), fontFamily: "'Satoshi', Arial, sans-serif",
                    caretColor: T.text(t),
                  }}
                />
                <button
                  onClick={() => send()}
                  disabled={!inputText.trim() || streaming}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: "none", flexShrink: 0,
                    background: inputText.trim() && !streaming
                      ? t === "dark" ? "rgba(255,255,255,.18)" : "rgba(17,19,21,.14)"
                      : "transparent",
                    cursor: inputText.trim() && !streaming ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background .15s",
                  }}
                >
                  <Send c={inputText.trim() && !streaming ? T.text(t) : mu} />
                </button>
              </div>

              {/* ── Quick actions ── */}
              {quickActions.length > 0 || !addingAction ? (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "8px 10px 6px" }}>
                  {quickActions.map(action => (
                    <div key={action.id} style={{ position: "relative", display: "inline-flex" }}
                      onMouseEnter={() => setHoveredChip(action.id)}
                      onMouseLeave={() => setHoveredChip(null)}
                    >
                      <button
                        onClick={() => handleQuickAction(action)}
                        disabled={streaming}
                        style={{
                          padding: "4px 10px", borderRadius: 99,
                          border: `1px solid ${T.chipBdr(t)}`, background: T.chip(t),
                          color: T.text(t), fontSize: 11.5, fontWeight: 500,
                          cursor: streaming ? "default" : "pointer",
                          fontFamily: "'Satoshi', Arial, sans-serif",
                          opacity: streaming ? .5 : 1, transition: "all .12s",
                          paddingRight: hoveredChip === action.id ? 22 : 10,
                        }}
                      >{action.label}</button>
                      {hoveredChip === action.id && (
                        <button onClick={(e) => { e.stopPropagation(); deleteAction(action.id); }} style={{
                          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer",
                          color: mu, fontSize: 12, lineHeight: 1, padding: 0, display: "flex", alignItems: "center",
                        }}>×</button>
                      )}
                    </div>
                  ))}
                  {addingAction ? (
                    <input
                      autoFocus value={newActionLabel}
                      onChange={e => setNewActionLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addAction(); if (e.key === "Escape") { setAddingAction(false); setNewActionLabel(""); } }}
                      onBlur={() => { if (!newActionLabel.trim()) setAddingAction(false); }}
                      placeholder="Name this action…"
                      style={{
                        padding: "4px 12px", borderRadius: 99,
                        border: `1px solid ${T.chipBdr(t)}`, background: T.chip(t),
                        color: T.text(t), fontSize: 11.5, fontFamily: "'Satoshi', Arial, sans-serif",
                        outline: "none", flex: 1, minWidth: 0,
                      }}
                    />
                  ) : (
                    <button onClick={() => setAddingAction(true)} style={{
                      padding: "4px 12px", borderRadius: 99,
                      border: `1px dashed ${T.chipBdr(t)}`, background: "transparent",
                      color: mu, fontSize: 11.5, cursor: "pointer",
                      fontFamily: "'Satoshi', Arial, sans-serif", whiteSpace: "nowrap",
                    }}>+ Add Quick Action</button>
                  )}
                </div>
              ) : null}

              {/* ── Mode selector ── */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "8px 10px 8px",
                borderTop: `1px solid ${T.border(t)}`,
              }}>
                {(["advisor", "assistant", "autopilot"] as Mode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => changeMode(m)}
                    style={{
                      padding: "3px 10px", borderRadius: 99, border: "none",
                      background: mode === m ? T.modeBg(t) : "transparent",
                      color: mode === m ? T.text(t) : mu,
                      fontSize: 11, fontWeight: mode === m ? 600 : 400,
                      cursor: "pointer", fontFamily: "'Satoshi', Arial, sans-serif",
                      transition: "all .15s",
                    }}
                  >{MODE_LABELS[m]}</button>
                ))}
              </div>

              {/* ── Usage meter ── */}
              {usage && (
                <div style={{
                  padding: "6px 14px 10px",
                  borderTop: `1px solid ${T.border(t)}`,
                  display: "flex", flexDirection: "column", gap: 5,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10.5, color: mu, fontFamily: "'Satoshi', Arial, sans-serif" }}>
                      {usage.totalUsed.toLocaleString()} / {(usage.baseLimit + usage.purchasedTokens).toLocaleString()} tokens this month
                    </span>
                  </div>
                  <div style={{
                    height: 3, borderRadius: 99,
                    background: t === "dark" ? "rgba(255,255,255,.1)" : "rgba(17,19,21,.1)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      width: `${Math.min(100, (usage.totalUsed / (usage.baseLimit + usage.purchasedTokens)) * 100)}%`,
                      background: usage.remaining === 0
                        ? "#e05555"
                        : usage.remaining < (usage.baseLimit + usage.purchasedTokens) * 0.1
                        ? "#e08c30"
                        : t === "dark" ? "rgba(255,255,255,.5)" : "rgba(17,19,21,.4)",
                      transition: "width .4s ease",
                    }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
