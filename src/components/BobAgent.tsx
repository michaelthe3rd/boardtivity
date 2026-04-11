"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ThemeMode, Note, Importance } from "@/lib/board";

// ── Types ────────────────────────────────────────────────────────────────────
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

const MODE_KEY    = "bob_mode";

function loadMode(): Mode {
  try { const m = localStorage.getItem(MODE_KEY); if (m === "advisor" || m === "assistant" || m === "autopilot") return m; } catch {}
  return "assistant";
}
function saveMode(m: Mode) {
  try { localStorage.setItem(MODE_KEY, m); } catch {}
}
const USER_INFO_KEY = "bob_user_info";
const AUTO_SEND_KEY = "bob_auto_send";
function loadUserInfo() { try { return localStorage.getItem(USER_INFO_KEY) || ""; } catch { return ""; } }
function saveUserInfo(v: string) { try { localStorage.setItem(USER_INFO_KEY, v); } catch {} }
function loadAutoSend() { try { return localStorage.getItem(AUTO_SEND_KEY) === "true"; } catch { return false; } }

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

  // Mode
  const [mode, setMode] = useState<Mode>("assistant");
  const [modeToast, setModeToast] = useState<string | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [userInfo,     setUserInfo]     = useState("");
  const [autoSend,     setAutoSend]     = useState(false);
  const autoSendRef    = useRef(false);

  // Usage tracking
  const usage       = useQuery(api.bob.getUsage);
  const recordUsage = useMutation(api.bob.recordUsage);

  // Voice
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptRef  = useRef("");

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setMode(loadMode());
    setUserInfo(loadUserInfo());
    setAutoSend(loadAutoSend());
  }, []);

  useEffect(() => { autoSendRef.current = autoSend; }, [autoSend]);

  // Auto-scroll only when user is already near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 80) el.scrollTop = el.scrollHeight;
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

  function changeMode(m: Mode) {
    setMode(m); saveMode(m);
    setModeToast(m);
    setTimeout(() => setModeToast(null), 1800);
  }

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

    // Slash command: /autopilot /assistant /advisor
    const slashMode = /^\/(autopilot|assistant|advisor)$/i.exec(msg);
    if (slashMode) {
      changeMode(slashMode[1].toLowerCase() as Mode);
      setInputText("");
      return;
    }

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
    let toolsFired = 0;

    try {
      const res = await fetch("/api/bob", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, notes: noteSnaps, mode, history, userInfo }),
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
              toolsFired++;
            } else if (data.type === "done") {
              const DONE_PHRASES = [
                "Done ✓", "All set ✓", "Consider it done ✓",
                "Handled ✓", "Done and dusted ✓", "Boom. Done ✓",
              ];
              const doneLine = toolsFired > 0 && bobText.trim().length < 8
                ? DONE_PHRASES[Math.floor(Math.random() * DONE_PHRASES.length)]
                : bobText;
              bobText = doneLine;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "bob", content: doneLine, streaming: false };
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

  // ── Voice ────────────────────────────────────────────────────────────────
  const hasSpeech = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages(prev => [...prev, { role: "bob", content: "Voice input isn't supported in this browser. Try Chrome or Edge." }]);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR();
    r.continuous = true; r.interimResults = true; r.lang = "en-US";
    // Only show the wave once recognition actually starts — avoids flash-of-red on permission failure
    r.onstart = () => setListening(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const txt = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>)
        .map(x => x[0].transcript).join(" ");
      transcriptRef.current = txt;
      setInputText(txt);
    };
    r.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      setListening(false);
      if (e.error === "aborted" || e.error === "no-speech") return;
      const msg = e.error === "not-allowed"
        ? "Mic access blocked — go to your browser's site settings and allow the microphone for this site."
        : e.error === "network"
        ? "Network error — voice recognition needs an internet connection."
        : `Voice error: ${e.error}`;
      setMessages(prev => [...prev, { role: "bob", content: msg }]);
    };
    recognitionRef.current = r;
    r.start();
  }, []);

  function stopListening() {
    const txt = transcriptRef.current;
    transcriptRef.current = "";
    recognitionRef.current?.stop();
    setListening(false);
    if (autoSendRef.current && txt.trim()) {
      setInputText("");
      send(txt);
    }
  }

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
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 2 }}>
            <button onClick={(e) => { e.stopPropagation(); setShowSettings(s => !s); }} style={{
              background: "none", border: "none", cursor: "pointer",
              color: mu, fontSize: 15, lineHeight: 1, padding: "4px 5px", opacity: showSettings ? 1 : .55,
            }}>⚙</button>
            <button onClick={(e) => { e.stopPropagation(); doClose(); }} style={{
              background: "none", border: "none", cursor: "pointer",
              color: mu, fontSize: 18, lineHeight: 1, padding: "2px 4px", opacity: .65,
            }}>×</button>
          </div>
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
              {/* ── Settings panel (overlay) ── */}
              {showSettings && (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${T.border(t)}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: mu, fontFamily: "'Satoshi', Arial, sans-serif", marginBottom: 10 }}>About You</div>
                    <textarea
                      value={userInfo}
                      onChange={e => { setUserInfo(e.target.value); saveUserInfo(e.target.value); }}
                      placeholder="Tell BOB about yourself — your name, role, goals, or anything helpful…"
                      rows={4}
                      style={{
                        width: "100%", boxSizing: "border-box", resize: "none",
                        background: t === "dark" ? "rgba(255,255,255,.05)" : "rgba(17,19,21,.04)",
                        border: `1px solid ${T.border(t)}`, borderRadius: 10,
                        padding: "8px 10px", fontSize: 12.5, color: T.text(t),
                        fontFamily: "'Satoshi', Arial, sans-serif", outline: "none", lineHeight: 1.6,
                      }}
                    />
                  </div>
                  <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border(t)}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text(t), fontFamily: "'Satoshi', Arial, sans-serif" }}>Auto-send after recording</div>
                      <div style={{ fontSize: 11, color: mu, fontFamily: "'Satoshi', Arial, sans-serif", marginTop: 1 }}>Send message automatically when you stop the mic</div>
                    </div>
                    <button
                      onClick={() => { const v = !autoSend; setAutoSend(v); try { localStorage.setItem(AUTO_SEND_KEY, String(v)); } catch {} }}
                      style={{
                        flexShrink: 0, width: 38, height: 22, borderRadius: 99, border: "none", cursor: "pointer",
                        background: autoSend ? "#6c63ff" : (t === "dark" ? "rgba(255,255,255,.15)" : "rgba(17,19,21,.15)"),
                        position: "relative", transition: "background .2s",
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3, left: autoSend ? 19 : 3,
                        width: 16, height: 16, borderRadius: "50%", background: "#fff",
                        transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                      }} />
                    </button>
                  </div>
                  <div style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 10.5, color: mu, fontFamily: "'Satoshi', Arial, sans-serif", lineHeight: 1.5 }}>
                      Use <code style={{ fontFamily: "monospace", opacity: .8 }}>/advisor</code>, <code style={{ fontFamily: "monospace", opacity: .8 }}>/assistant</code>, or <code style={{ fontFamily: "monospace", opacity: .8 }}>/autopilot</code> in the chat to switch modes.
                    </div>
                  </div>
                </div>
              )}

              {/* ── Conversation area ── */}
              {!showSettings && messages.length > 0 && (
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
                      alignItems: "center", gap: 6,
                    }}>
                      {msg.role === "bob" && (
                        <div style={{ flexShrink: 0 }}>
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
              {!showSettings && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderBottom: `1px solid ${T.border(t)}` }}>
                {hasSpeech && (
                  <button
                    onClick={listening ? stopListening : startListening}
                    title={listening ? "Stop recording" : "Speak to BOB"}
                    style={{
                      width: 30, height: 30, borderRadius: "50%", border: "none", flexShrink: 0,
                      background: listening ? "rgba(192,48,48,.18)" : "transparent",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
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
                  placeholder={listening ? "Listening…" : mode === "autopilot" ? "Tell BOB what to do…" : mode === "advisor" ? "Ask BOB anything…" : "Ask or tell BOB…"}
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
              </div>}

              {/* ── Mode toast (appears where the mode bar was, fades out) ── */}
              {modeToast && (
                <div style={{
                  borderTop: `1px solid ${T.border(t)}`,
                  padding: "7px 10px", textAlign: "center",
                  pointerEvents: "none", animation: "bobToastFade 1.8s ease forwards",
                }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: mu, fontFamily: "'Satoshi', Arial, sans-serif", letterSpacing: ".02em" }}>
                    {MODE_LABELS[modeToast as Mode]}
                  </span>
                </div>
              )}

              {/* ── Usage meter ── */}
              {usage && (() => {
                const cap = usage.baseLimit + usage.purchasedTokens;
                const pct = Math.min(100, Math.round((usage.totalUsed / cap) * 100));
                const modeCost = mode === "autopilot" ? "High" : mode === "assistant" ? "Med" : "Low";
                const barColor = pct >= 100
                  ? "#e05555"
                  : pct >= 90
                  ? "#e08c30"
                  : t === "dark" ? "rgba(255,255,255,.5)" : "rgba(17,19,21,.4)";
                return (
                  <div style={{
                    padding: "6px 14px 10px",
                    borderTop: `1px solid ${T.border(t)}`,
                    display: "flex", flexDirection: "column", gap: 5,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10.5, color: mu, fontFamily: "'Satoshi', Arial, sans-serif" }}>
                        {pct}% used this month
                      </span>
                      <span style={{ fontSize: 10.5, color: mu, fontFamily: "'Satoshi', Arial, sans-serif", opacity: .7 }}>
                        {modeCost} usage · {mode}
                      </span>
                    </div>
                    <div style={{
                      height: 3, borderRadius: 99,
                      background: t === "dark" ? "rgba(255,255,255,.1)" : "rgba(17,19,21,.1)",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        width: `${pct}%`,
                        background: barColor,
                        transition: "width .4s ease",
                      }} />
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
