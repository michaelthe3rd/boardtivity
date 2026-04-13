"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ThemeMode, Note, Importance } from "@/lib/board";

// ── Types ────────────────────────────────────────────────────────────────────
type Mode       = "assistant" | "autopilot";

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

export type BobSettings = {
  taskColorMode?: "priority" | "single";
  taskHighColorIdx?: number; taskMedColorIdx?: number;
  taskLowColorIdx?: number; taskSingleColorIdx?: number;
  thoughtColorMode?: "random" | "fixed"; thoughtFixedColorIdx?: number;
  boardTheme?: string; boardGrid?: string;
  activeBoardType?: "task" | "thought";
  activeBoardName?: string;
  boards?: { id: string; name: string; type: "task" | "thought" }[];
};

interface Props {
  theme: ThemeMode;
  notes: Note[];
  activeBoardId?: string;
  onSweep: (positions: BobSweepResult) => void;
  onAddNote: (note: BobNewNote) => void;
  onEditNote: (id: number, fields: Partial<Note>) => void;
  onDeleteNotes: (ids: number[]) => void;
  onHighlightNotes: (ids: number[]) => void;
  onLaunchFocus: (noteId: number, chain?: boolean) => void;
  onSaveUndo: () => void;
  onUndo: () => void;
  onSetIdeaColor: (ids: number[], colorIdx: number | undefined) => void;
  onConfigureTaskColors: (patch: Partial<BobSettings>) => void;
  onConfigureBoard: (patch: { boardTheme?: string; boardGrid?: string; defaultIdeaColor?: string }) => void;
  isAdmin?: boolean;
  userInfo?: string;
  autoSend?: boolean;
  settings?: BobSettings;
  mobile?: boolean;
  focusStats?: { currentStreak: number; totalMinutes: number; totalTasksCompleted: number; days: { date: string; totalMinutes: number; tasksCompleted: number }[] };
}

const MODE_KEY = "bob_mode";
function loadMode(): Mode {
  try { const m = localStorage.getItem(MODE_KEY); if (m === "assistant" || m === "autopilot") return m; } catch {}
  return "assistant";
}
function saveMode(m: Mode) {
  try { localStorage.setItem(MODE_KEY, m); } catch {}
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
  assistant: "Assistant",
  autopilot: "Autopilot",
};

// ── Icons ─────────────────────────────────────────────────────────────────────
function SpeechWave({ c, listening, s = 14 }: { c: string; listening: boolean; s?: number }) {
  // 5 slim bars, varied resting heights, staggered animation
  const bars = [
    { x: 0,    h: 4,  aH: 10, dur: "0.9s",  delay: "0s"     },
    { x: 3.5,  h: 7,  aH: 14, dur: "0.75s", delay: "0.15s"  },
    { x: 7,    h: 10, aH: 14, dur: "0.8s",  delay: "0s"     },
    { x: 10.5, h: 7,  aH: 13, dur: "0.75s", delay: "0.1s"   },
    { x: 14,   h: 4,  aH: 10, dur: "0.9s",  delay: "0.2s"   },
  ];
  const VH = 14;
  return (
    <svg width={s} height={s} viewBox="0 0 16 14" fill="none">
      {bars.map((b, i) => {
        const sy = (VH - b.h) / 2, ay = (VH - b.aH) / 2;
        return (
          <rect key={i} x={b.x} width={2} rx={1} fill={c} y={sy} height={b.h}>
            {listening && (
              <>
                <animate attributeName="height" values={`${b.h};${b.aH};${b.h}`} dur={b.dur} begin={b.delay} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
                <animate attributeName="y"      values={`${sy};${ay};${sy}`}     dur={b.dur} begin={b.delay} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
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
const IDEA_COLOR_NAMES = ["pink","orchid","coral","peach","butter","lilac","blue","mint"] as const;
const TASK_COLOR_NAMES = ["red","orange","yellow","pink","orchid","coral","peach","butter","lilac","blue","mint"] as const;

export default function BobAgent({
  theme: t, notes, activeBoardId, onSweep, onAddNote, onEditNote, onDeleteNotes,
  onHighlightNotes, onLaunchFocus, onSaveUndo, onUndo, isAdmin = true,
  userInfo = "", autoSend = false,
  onSetIdeaColor, onConfigureTaskColors, onConfigureBoard, settings,
  mobile = false, focusStats,
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

  // Usage tracking
  const usage       = useQuery(api.bob.getUsage);
  const recordUsage = useMutation(api.bob.recordUsage);

  // Voice
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null);
  const transcriptRef   = useRef("");
  const autoSendRef     = useRef(autoSend);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); setMode(loadMode()); }, []);
  useEffect(() => { autoSendRef.current = autoSend; }, [autoSend]);

  // Auto-scroll only when user is already near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 80) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!open || closing || mobile) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) doClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, closing, mobile]); // eslint-disable-line react-hooks/exhaustive-deps

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
    id: n.id, boardId: n.boardId, type: n.type, title: n.title, body: n.body,
    importance: n.importance, dueDate: n.dueDate, minutes: n.minutes,
    completed: n.completed, x: n.x, y: n.y,
    colorIdx: n.colorIdx,
    totalTimeSpent: n.totalTimeSpent,
    attemptCount: n.attemptCount,
    steps: (n.steps ?? []).map(s => ({ title: s.title, minutes: s.minutes, done: s.done })),
  }));

  // ── Execute tool calls from BOB ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function executeTool(name: string, input: any) {
    if (!input || typeof input !== "object") return;
    switch (name) {
      case "create_note":
        if (typeof input.title !== "string") break;
        onAddNote({
          type: input.type === "task" ? "task" : "thought",
          title: String(input.title).slice(0, 200),
          body: typeof input.body === "string" ? input.body.slice(0, 2000) : undefined,
          importance: (["High","Medium","Low","none"] as const).includes(input.importance) ? input.importance : "none",
          dueDate: typeof input.dueDate === "string" ? input.dueDate : undefined,
          steps: Array.isArray(input.steps) ? input.steps.filter(
            (s: unknown) => s && typeof s === "object" && typeof (s as {title:unknown}).title === "string"
          ).slice(0, 20) : [],
        });
        break;
      case "edit_note": {
        const eid = Number(input.id);
        if (!isNaN(eid) && input.fields && typeof input.fields === "object")
          onEditNote(eid, input.fields);
        break;
      }
      case "delete_notes":
        if (Array.isArray(input.ids))
          onDeleteNotes(input.ids.map(Number).filter((id: number) => !isNaN(id)));
        break;
      case "organize_board":
        if (Array.isArray(input.positions)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const positions = input.positions.map((p: any) => ({
            id: Number(p.id), x: Number(p.x), y: Number(p.y),
          })).filter((p: {id:number;x:number;y:number}) => !isNaN(p.id) && !isNaN(p.x) && !isNaN(p.y));
          if (positions.length) onSweep(positions);
        }
        break;
      case "highlight_notes":
        if (Array.isArray(input.ids))
          onHighlightNotes(input.ids.map(Number).filter((id: number) => !isNaN(id)));
        break;
      case "launch_focus": {
        const nid = Number(input.noteId);
        if (!isNaN(nid)) onLaunchFocus(nid, input.chain === true);
        break;
      }
      case "set_idea_color": {
        if (Array.isArray(input.ids) && typeof input.color === "string") {
          const colorIdx = input.color === "none"
            ? undefined
            : (IDEA_COLOR_NAMES as readonly string[]).indexOf(input.color);
          onSetIdeaColor(input.ids.map(Number).filter((id: number) => !isNaN(id)), colorIdx === -1 ? undefined : colorIdx as number | undefined);
        }
        break;
      }
      case "configure_task_colors": {
        const patch: Partial<BobSettings> = {};
        if (input.mode === "priority" || input.mode === "single") patch.taskColorMode = input.mode;
        if (typeof input.high   === "string") { const i = (TASK_COLOR_NAMES as readonly string[]).indexOf(input.high);   if (i !== -1) patch.taskHighColorIdx   = i; }
        if (typeof input.medium === "string") { const i = (TASK_COLOR_NAMES as readonly string[]).indexOf(input.medium); if (i !== -1) patch.taskMedColorIdx    = i; }
        if (typeof input.low    === "string") { const i = (TASK_COLOR_NAMES as readonly string[]).indexOf(input.low);    if (i !== -1) patch.taskLowColorIdx    = i; }
        if (typeof input.single === "string") { const i = (TASK_COLOR_NAMES as readonly string[]).indexOf(input.single); if (i !== -1) patch.taskSingleColorIdx = i; }
        if (Object.keys(patch).length) onConfigureTaskColors(patch);
        break;
      }
      case "configure_board": {
        const patch: { boardTheme?: string; boardGrid?: string; defaultIdeaColor?: string } = {};
        if (input.board_theme) patch.boardTheme = input.board_theme;
        if (input.board_grid)  patch.boardGrid  = input.board_grid;
        if (typeof input.default_idea_color === "string") patch.defaultIdeaColor = input.default_idea_color;
        if (Object.keys(patch).length) onConfigureBoard(patch);
        break;
      }
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
    let toolsFired = 0;

    try {
      console.log(`[BOB send] noteSnaps=${noteSnaps.length} activeBoardId=${activeBoardId} boardIds=${[...new Set(noteSnaps.map(n => n.boardId))].join(",")}`);
      const res = await fetch("/api/bob", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, notes: noteSnaps, activeBoardId, mode, history, userInfo, settings, focusStats }),
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
            if (data.type === "debug") {
              console.log("[BOB debug]", data);
            } else if (data.type === "token") {
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
              bobText = `Error: ${data.message ?? "unknown"}`;
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

  function cancelListening() {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    transcriptRef.current = "";
    setInputText("");
    recognitionRef.current?.stop();
    setListening(false);
  }

  function finishListening() {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    const txt = transcriptRef.current;
    transcriptRef.current = "";
    recognitionRef.current?.stop();
    setListening(false);
    if (autoSendRef.current && txt.trim()) {
      setInputText("");
      send(txt);
    }
    // If autoSend is off, the transcript stays in the input for the user to review
  }

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

      // Reset silence timer — send after 1.8 s of no new speech
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => finishListening(), 1800);
    };
    r.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ───────────────────────────────────────────────────────────────
  const isExpanded = open && !closing;
  const ic = T.text(t);
  const mu = T.muted(t);

  const PILL_W = mobile ? "100%" : 90, OPEN_W = mobile ? "100%" : 480, PILL_H = 44;
  const DI  = "cubic-bezier(0.22, 1, 0.36, 1)";  // spring-like ease-out
  const DI2 = "cubic-bezier(0.4, 0, 0.2, 1)";    // material ease for collapse
  const transition = mobile
    ? (isExpanded
        ? "max-height 0.5s ease-out"  // open: no border-radius transition (avoids circle artifact)
        : "max-height 0.28s ease-in, border-radius 0.28s ease-in")  // close: reverse the pill shape
    : (isExpanded
        ? [`width 0.42s ${DI}`, `max-height 0.44s ${DI} 0.02s`, `border-radius 0.38s ${DI}`].join(", ")
        : [`max-height 0.28s ${DI2}`, `width 0.30s ${DI2} 0.02s`, `border-radius 0.28s ${DI2}`].join(", "));

  const contentOpacity    = isExpanded ? 1 : 0;
  const contentTransition = mobile
    ? (isExpanded ? "opacity 0.25s ease 0.15s" : "opacity 0.1s ease")
    : (isExpanded ? "opacity 0.18s ease 0.22s" : "opacity 0.08s ease");

  const pillBg  = t === "dark" ? "rgba(22,24,28,.72)"   : "rgba(255,255,255,.72)";
  const openBg  = t === "dark" ? "rgba(22,24,28,.94)"   : "rgba(255,255,255,.94)";
  const pillBdr = t === "dark" ? "rgba(255,255,255,.16)" : "rgba(17,19,21,.16)";

  return (
    <div
      ref={containerRef}
      style={{
        width: open ? OPEN_W : PILL_W, maxHeight: open ? (mobile ? 560 : 560) : PILL_H,
        borderRadius: open ? 18 : 999, overflow: "hidden",
        willChange: mobile ? "auto" : "width, max-height, border-radius", transition,
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderBottom: `1px solid ${T.border(t)}` }}>
                {hasSpeech && (
                  <button
                    onClick={listening ? cancelListening : startListening}
                    title={listening ? "Cancel recording" : "Speak to BOB"}
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
                  onFocus={() => {
                    if (!mobile) return;
                    const vp = document.querySelector("meta[name=viewport]");
                    if (vp) vp.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1");
                  }}
                  onBlur={() => {
                    if (!mobile) return;
                    const vp = document.querySelector("meta[name=viewport]");
                    if (vp) vp.setAttribute("content", "width=device-width, initial-scale=1");
                  }}
                  placeholder={listening ? "Listening… (pause to send)" : mode === "autopilot" ? "Tell BOB what to do…" : "Ask BOB about anything…"}
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

              {/* ── Mode selector ── */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "8px 10px",
                borderTop: `1px solid ${T.border(t)}`,
              }}>
                {(["assistant", "autopilot"] as Mode[]).map(m => (
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
              {usage && (() => {
                const cap = usage.baseLimit + usage.purchasedTokens;
                const pct = Math.min(100, Math.round((usage.totalUsed / cap) * 100));
                const modeCost = mode === "autopilot" ? "High" : "Med";
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
                        {modeCost} usage
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
