
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { ThemeMode, BoardType, Importance, FlowMode, Board, Step, Note } from "@/lib/board";

const BOARD_W = 6800;
const BOARD_H = 4200;
const NOTE_W = 228;
const NOTE_H = 138;
const STEP_W = 166;
const STEP_H = 62;

const INITIAL_BOARDS: Board[] = [
  { id: "my-board", name: "My Board", type: "task" },
  { id: "my-thoughts", name: "My Thoughts", type: "thought" },
];

function formatDate(date?: string) {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function nextBoardName(existing: Board[], type: BoardType) {
  const base = type === "task" ? "My Board" : "My Thoughts";
  const count = existing.filter((b) => b.type === type).length;
  return count === 0 ? base : `${base} #${count + 1}`;
}

function estimateTime(title: string) {
  const t = title.toLowerCase();
  if (t.includes("essay") || t.includes("paper") || t.includes("report")) return 90;
  if (t.includes("apply") || t.includes("resume") || t.includes("internship")) return 55;
  if (t.includes("study") || t.includes("chapter") || t.includes("exam")) return 60;
  if (t.includes("presentation") || t.includes("slides")) return 70;
  if (t.includes("email") || t.includes("reply")) return 20;
  if (t.includes("meeting") || t.includes("call")) return 30;
  if (t.includes("cook") || t.includes("meal")) return 45;
  if (t.includes("clean") || t.includes("organize")) return 35;
  return 30;
}

function buildBreakdown(title: string, total: number): Step[] {
  const t = title.toLowerCase().trim();
  let labels = ["Clarify", "Do", "Finish"];
  let weights = [0.25, 0.5, 0.25];

  if (t.includes("essay") || t.includes("paper") || t.includes("assignment") || t.includes("report")) {
    labels = total >= 70 ? ["Outline", "Research", "Draft", "Revise"] : ["Outline", "Draft", "Revise"];
    weights = labels.length === 4 ? [0.18, 0.22, 0.35, 0.25] : [0.2, 0.5, 0.3];
  } else if (t.includes("study") || t.includes("chapter") || t.includes("exam") || t.includes("quiz")) {
    labels = total >= 50 ? ["Review", "Practice", "Test yourself"] : ["Review", "Practice"];
    weights = labels.length === 3 ? [0.3, 0.45, 0.25] : [0.45, 0.55];
  } else if (t.includes("presentation") || t.includes("slides") || t.includes("deck")) {
    labels = ["Plan", "Build", "Practice"];
    weights = [0.25, 0.45, 0.3];
  } else if (t.includes("resume") || t.includes("cover letter") || t.includes("apply") || t.includes("internship")) {
    labels = total >= 45 ? ["Prepare", "Tailor", "Submit"] : ["Tailor", "Submit"];
    weights = labels.length === 3 ? [0.25, 0.45, 0.3] : [0.6, 0.4];
  } else if (total <= 20) {
    labels = ["Do", "Finish"];
    weights = [0.7, 0.3];
  } else if (total <= 35) {
    labels = ["Start", "Do", "Finish"];
    weights = [0.2, 0.6, 0.2];
  } else {
    labels = ["Prepare", "Do", "Review"];
    weights = [0.2, 0.55, 0.25];
  }

  const steps = labels.map((label, i) => ({
    id: Date.now() + i,
    title: label,
    minutes: Math.max(5, Math.round((total * weights[i]) / 5) * 5),
    done: false,
    x: 0,
    y: 0,
  }));

  const assigned = steps.reduce((sum, s) => sum + s.minutes, 0);
  const diff = total - assigned;
  if (diff !== 0) {
    steps[steps.length - 1].minutes = Math.max(5, steps[steps.length - 1].minutes + diff);
  }

  return steps;
}

function layoutWeb(noteX: number, noteY: number, steps: Step[]) {
  const cx = noteX + NOTE_W / 2 - STEP_W / 2;
  const cy = noteY + NOTE_H / 2 - STEP_H / 2;
  const spread = 220;
  return steps.map((step, index) => {
    const angle = (-Math.PI / 2) + (index - (steps.length - 1) / 2) * 0.82;
    return {
      ...step,
      x: cx + Math.cos(angle) * spread,
      y: cy + Math.sin(angle) * spread + index * 8,
    };
  });
}

function layoutChain(noteX: number, noteY: number, steps: Step[]) {
  const startX = noteX + NOTE_W + 72;
  const startY = noteY - 12;
  return steps.map((step, index) => ({
    ...step,
    x: startX + index * 210,
    y: startY + index * 24,
  }));
}

function pageBg(theme: ThemeMode) {
  return theme === "dark" ? "#0d0f12" : "#f3f1eb";
}
function pageText(theme: ThemeMode) {
  return theme === "dark" ? "#f5f5f2" : "#171613";
}
function muted(theme: ThemeMode) {
  return theme === "dark" ? "rgba(255,255,255,.72)" : "rgba(23,22,19,.62)";
}
function surface(theme: ThemeMode) {
  return theme === "dark" ? "#17191d" : "#ffffff";
}
function border(theme: ThemeMode) {
  return theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)";
}
function paper(theme: ThemeMode) {
  return theme === "dark" ? "#2d3137" : "#fafaf7";
}
function grid(theme: ThemeMode) {
  return theme === "dark" ? "rgba(255,255,255,.055)" : "rgba(78,78,78,.045)";
}
function panel(theme: ThemeMode) {
  return theme === "dark" ? "#1f2329" : "#ffffff";
}
function inputBg(theme: ThemeMode) {
  return theme === "dark" ? "#282c33" : "#ffffff";
}
function noteBg(type: BoardType, importance: Importance | undefined, theme: ThemeMode) {
  if (theme === "dark") {
    if (type === "thought") return "#3f444b";
    if (importance === "High") return "#66551e";
    if (importance === "Medium") return "#35503c";
    return "#4a4036";
  }
  if (type === "thought") return "#e6e7ea";
  if (importance === "High") return "#f3efcf";
  if (importance === "Medium") return "#e5ece1";
  return "#eee8e2";
}
function noteText(theme: ThemeMode) {
  return theme === "dark" ? "#f5f5f2" : "#1f1d1a";
}
function noteSub(theme: ThemeMode) {
  return theme === "dark" ? "#d9d9d7" : "#696257";
}
function noteHalo(type: BoardType, importance: Importance | undefined) {
  if (type === "thought") return "rgba(255,255,255,.10)";
  if (importance === "High") return "rgba(205,176,52,.18)";
  if (importance === "Medium") return "rgba(111,149,104,.16)";
  return "rgba(145,126,88,.12)";
}
function buttonStyle(theme: ThemeMode, dark = false, compact = false): CSSProperties {
  return {
    height: compact ? 36 : 40,
    borderRadius: 999,
    border: dark ? "1px solid #111315" : `1px solid ${border(theme)}`,
    backgroundColor: dark ? "#111315" : theme === "dark" ? "#23262b" : "#ffffff",
    color: dark ? "#f7f8fb" : theme === "dark" ? "#f5f5f2" : "#433d35",
    padding: compact ? "0 12px" : "0 14px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };
}
function fieldStyle(theme: ThemeMode): CSSProperties {
  return {
    borderRadius: 16,
    border: `1px solid ${border(theme)}`,
    backgroundColor: inputBg(theme),
    height: 52,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    color: pageText(theme),
    opacity: 1,
  };
}
function circleButton(theme: ThemeMode, size = 36): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `1px solid ${border(theme)}`,
    backgroundColor: theme === "dark" ? "#23262b" : "#ffffff",
    color: theme === "dark" ? "#f5f5f2" : "#433d35",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };
}
function pill(theme: ThemeMode): CSSProperties {
  return {
    padding: "5px 9px",
    borderRadius: 999,
    border: `1px solid ${border(theme)}`,
    backgroundColor: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.82)",
    fontSize: 11,
    fontWeight: 700,
    color: theme === "dark" ? "#eaeae8" : "#61594e",
    whiteSpace: "nowrap",
  };
}

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle board theme"
      style={{
        ...buttonStyle(theme, false, true),
        position: "relative",
        width: 70,
        padding: 0,
        overflow: "hidden",
        backgroundColor: theme === "dark" ? "#23262b" : "#ffffff",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: theme === "dark" ? 36 : 3,
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: theme === "dark" ? "#f5f5f2" : "#111315",
          transition: "left .18s ease",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke={theme === "dark" ? "#23262b" : "#eef3fa"} strokeWidth="1.4" />
          {theme === "dark" ? (
            <path d="M8 2.5a5.5 5.5 0 0 1 0 11Z" fill="#23262b" />
          ) : (
            <path d="M8 2.5a5.5 5.5 0 0 0 0 11Z" fill="#eef3fa" />
          )}
        </svg>
      </span>
    </button>
  );
}

export function HomeShell() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [boards, setBoards] = useState<Board[]>(INITIAL_BOARDS);
  const [activeBoardId, setActiveBoardId] = useState("my-board");
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [detailNoteId, setDetailNoteId] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<{ noteId: number; stepId: number } | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [renameBoardId, setRenameBoardId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [importance, setImportance] = useState<Importance>("none");
  const [aiSteps, setAiSteps] = useState<Step[]>([]);
  const [composerError, setComposerError] = useState<{ title?: boolean; dueDate?: boolean; importance?: boolean }>({});

  const [focusOpen, setFocusOpen] = useState(false);
  const [focusNoteId, setFocusNoteId] = useState<number | null>(null);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boardMenuRef = useRef<HTMLDivElement | null>(null);
  const boardButtonRef = useRef<HTMLButtonElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const boardDragRef = useRef<null | { startX: number; startY: number; panX: number; panY: number }>(null);
  const noteDragRef = useRef<null | { pointerId: number; noteId: number; startX: number; startY: number; noteX: number; noteY: number }>(null);
  const stepDragRef = useRef<null | { pointerId: number; noteId: number; stepId: number; startX: number; startY: number; stepX: number; stepY: number }>(null);
  const pointerMapRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<null | { distance: number; scale: number }>(null);
  const draggedRef = useRef(false);
  const dragThresholdRef = useRef(6);

  const [scale, setScale] = useState(0.82);
  const [pan, setPan] = useState({ x: -420, y: -140 });

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? boards[0];
  const activeNotes = notes.filter((n) => n.boardId === activeBoardId);
  const detailNote = notes.find((n) => n.id === detailNoteId) ?? null;
  const stepModal = activeStep
    ? notes.find((n) => n.id === activeStep.noteId)?.steps.find((s) => s.id === activeStep.stepId) ?? null
    : null;
  const thoughtMode = activeBoard.type === "thought";

  const boardStyle = useMemo<CSSProperties>(
    () => ({
      position: "relative",
      minHeight: 620,
      borderRadius: 28,
      overflow: "hidden",
      border: `1px solid ${border(theme)}`,
      backgroundColor: surface(theme),
      boxShadow: theme === "dark" ? "0 24px 50px rgba(0,0,0,.28)" : "0 24px 50px rgba(0,0,0,.10)",
    }),
    [theme]
  );

  const taskBoards = boards.filter((b) => b.type === "task");
  const thoughtBoards = boards.filter((b) => b.type === "thought");
  const recentTasks = [...notes]
    .filter((n) => n.type === "task")
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.id - a.id;
    })
    .slice(0, 4);

  function clampPan(nextX: number, nextY: number, nextScale: number) {
    const viewport = viewportRef.current;
    if (!viewport) return { x: nextX, y: nextY };
    const edge = 160;
    const minX = viewport.clientWidth - BOARD_W * nextScale - edge;
    const minY = viewport.clientHeight - BOARD_H * nextScale - edge;
    return {
      x: Math.max(minX, Math.min(edge, nextX)),
      y: Math.max(minY, Math.min(edge, nextY)),
    };
  }

  function centerBoard() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextScale = 0.82;
    const nextX = viewport.clientWidth / 2 - (BOARD_W * nextScale) / 2;
    const nextY = viewport.clientHeight / 2 - (BOARD_H * nextScale) / 2;
    setScale(nextScale);
    setPan(clampPan(nextX, nextY, nextScale));
  }

  function zoomAt(clientX: number, clientY: number, nextScale: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const worldX = (px - pan.x) / scale;
    const worldY = (py - pan.y) / scale;

    const clamped = Math.max(0.38, Math.min(1.75, nextScale));
    const nextX = px - worldX * clamped;
    const nextY = py - worldY * clamped;

    setScale(clamped);
    setPan(clampPan(nextX, nextY, clamped));
  }

  useEffect(() => {
    const t = setTimeout(() => centerBoard(), 20);
    return () => clearTimeout(t);
  }, [activeBoardId]);

  // Load persisted state from localStorage on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("boardtivity");
      if (saved) {
        const data = JSON.parse(saved) as {
          theme?: ThemeMode;
          boards?: Board[];
          notes?: Note[];
          activeBoardId?: string;
        };
        if (data.theme) setTheme(data.theme);
        if (Array.isArray(data.boards) && data.boards.length > 0) setBoards(data.boards);
        if (Array.isArray(data.notes)) setNotes(data.notes);
        if (data.activeBoardId) setActiveBoardId(data.activeBoardId);
      }
    } catch {}
    setIsHydrated(true);
  }, []);

  // Persist state to localStorage whenever it changes (skip until initial load is done)
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("boardtivity", JSON.stringify({ theme, boards, notes, activeBoardId }));
    } catch {}
  }, [isHydrated, theme, boards, notes, activeBoardId]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!boardsOpen) return;
      if (boardMenuRef.current?.contains(target)) return;
      if (boardButtonRef.current?.contains(target)) return;
      setBoardsOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [boardsOpen]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const wheelHandler = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, scale + (event.deltaY > 0 ? -0.06 : 0.06));
    };

    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
  }, [scale, pan.x, pan.y]);

  useEffect(() => {
    if (!focusOpen) return;
    const id = window.setInterval(() => {
      setFocusSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [focusOpen]);

  function addBoard(type: BoardType) {
    const board = {
      id: `${type}-${Date.now()}`,
      name: nextBoardName(boards, type),
      type,
    };
    setBoards((prev) => [...prev, board]);
    setActiveBoardId(board.id);
    setBoardsOpen(false);
  }

  function deleteBoard(boardId: string) {
    if (boards.length <= 1) return;
    const remaining = boards.filter((b) => b.id !== boardId);
    setBoards(remaining);
    setNotes((prev) => prev.filter((n) => n.boardId !== boardId));
    if (activeBoardId === boardId) {
      setActiveBoardId(remaining[0].id);
    }
    setBoardsOpen(false);
  }

  function saveRename() {
    if (!renameBoardId || !renameValue.trim()) return;
    setBoards((prev) => prev.map((b) => (b.id === renameBoardId ? { ...b, name: renameValue.trim() } : b)));
    setRenameBoardId(null);
    setRenameValue("");
  }

  function onViewportPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-note='true']") || (e.target as HTMLElement).closest("[data-step='true']")) return;

    pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);

    if (pointerMapRef.current.size === 1) {
      boardDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      draggedRef.current = false;
    }

    if (pointerMapRef.current.size === 2) {
      const pts = Array.from(pointerMapRef.current.values());
      pinchRef.current = {
        distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        scale,
      };
      boardDragRef.current = null;
    }
  }

  function onViewportPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (pointerMapRef.current.has(e.pointerId)) {
      pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (stepDragRef.current && stepDragRef.current.pointerId === e.pointerId) {
      const drag = stepDragRef.current;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      const distance = Math.hypot(dx, dy);

      if (distance >= dragThresholdRef.current) {
        const nextX = Math.max(0, Math.min(BOARD_W - STEP_W - 24, drag.stepX + dx));
        const nextY = Math.max(0, Math.min(BOARD_H - STEP_H - 24, drag.stepY + dy));
        setNotes((prev) =>
          prev.map((note) =>
            note.id === drag.noteId
              ? {
                  ...note,
                  steps: note.steps.map((s) =>
                    s.id === drag.stepId ? { ...s, x: nextX, y: nextY } : s
                  ),
                }
              : note
          )
        );
        draggedRef.current = true;
      }
      return;
    }

    if (noteDragRef.current && noteDragRef.current.pointerId === e.pointerId) {
      const drag = noteDragRef.current;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      const distance = Math.hypot(dx, dy);

      if (distance >= dragThresholdRef.current) {
        const nextX = Math.max(0, Math.min(BOARD_W - NOTE_W - 32, drag.noteX + dx));
        const nextY = Math.max(0, Math.min(BOARD_H - NOTE_H - 32, drag.noteY + dy));
        setNotes((prev) => prev.map((n) => (n.id === drag.noteId ? { ...n, x: nextX, y: nextY } : n)));
        draggedRef.current = true;
      }
      return;
    }

    if (pointerMapRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointerMapRef.current.values());
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const centerX = (pts[0].x + pts[1].x) / 2;
      const centerY = (pts[0].y + pts[1].y) / 2;
      zoomAt(centerX, centerY, pinchRef.current.scale * (distance / pinchRef.current.distance));
      return;
    }

    if (!boardDragRef.current) return;
    const dx = e.clientX - boardDragRef.current.startX;
    const dy = e.clientY - boardDragRef.current.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      setPan(clampPan(boardDragRef.current.panX + dx, boardDragRef.current.panY + dy, scale));
    }
  }

  function onViewportPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointerMapRef.current.delete(e.pointerId);
    if (pointerMapRef.current.size < 2) pinchRef.current = null;
    if (pointerMapRef.current.size === 0) {
      boardDragRef.current = null;
      noteDragRef.current = null;
      stepDragRef.current = null;
    }
  }

  function createNote() {
    const nextError = {
      title: !title.trim(),
      dueDate: !thoughtMode && !dueDate,
      importance: !thoughtMode && importance === "none",
    };

    if (nextError.title || nextError.dueDate || nextError.importance) {
      setComposerError(nextError);
      return;
    }

    setComposerError({});

    const viewport = viewportRef.current;
    const centerX = viewport ? (viewport.clientWidth / 2 - pan.x) / scale : 180;
    const centerY = viewport ? (viewport.clientHeight / 2 - pan.y) / scale : 180;

    const taskMinutes = thoughtMode ? undefined : minutes;
    const rawSteps = thoughtMode ? [] : aiSteps;
    const noteX = Math.max(40, Math.min(BOARD_W - NOTE_W - 40, centerX - NOTE_W / 2));
    const noteY = Math.max(60, Math.min(BOARD_H - NOTE_H - 40, centerY - NOTE_H / 2));
    const laidOutSteps = rawSteps.length > 0 ? layoutWeb(noteX, noteY, rawSteps) : [];

    const note: Note = {
      id: Date.now(),
      boardId: activeBoardId,
      type: activeBoard.type,
      title: title.trim(),
      body: body.trim(),
      dueDate: thoughtMode ? undefined : dueDate,
      minutes: taskMinutes,
      importance: thoughtMode ? undefined : importance,
      createdAt: new Date().toISOString().slice(0, 10),
      completed: false,
      x: noteX,
      y: noteY,
      steps: laidOutSteps,
      showFlow: false,
      flowMode: "web",
      linkedNoteIds: [],
    };

    setNotes((prev) => [...prev, note]);
    setComposerOpen(false);
    setTitle("");
    setBody("");
    setDueDate("");
    setMinutes(30);
    setImportance("none");
    setAiSteps([]);
  }

  function openBreakdownFromDetails(note: Note) {
    const total = note.minutes ?? estimateTime(note.title);
    const steps = buildBreakdown(note.title, total);
    const laidOut = note.flowMode === "chain" ? layoutChain(note.x, note.y, steps) : layoutWeb(note.x, note.y, steps);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, minutes: total, steps: laidOut } : n)));
  }

  function toggleStepDone(noteId: number, stepId: number) {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? { ...note, steps: note.steps.map((step) => (step.id === stepId ? { ...step, done: !step.done } : step)) }
          : note
      )
    );
  }

  function setFlowMode(note: Note, mode: FlowMode) {
    const steps = mode === "chain" ? layoutChain(note.x, note.y, note.steps) : layoutWeb(note.x, note.y, note.steps);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, flowMode: mode, steps } : n)));
  }

  function toggleFlow(noteId: number) {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, showFlow: !n.showFlow } : n)));
  }

  function toggleThoughtLink(noteId: number, targetId: number) {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const exists = n.linkedNoteIds.includes(targetId);
        return {
          ...n,
          linkedNoteIds: exists ? n.linkedNoteIds.filter((id) => id !== targetId) : [...n.linkedNoteIds, targetId],
        };
      })
    );
  }

  function completeTask(noteId: number) {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, completed: true } : n)));
    setDetailNoteId(null);
  }

  function deleteTask(noteId: number) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId).map((n) => ({ ...n, linkedNoteIds: n.linkedNoteIds.filter((id) => id !== noteId) })));
    setDetailNoteId(null);
  }

  function startFocus(noteId: number) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const total = note.minutes ?? estimateTime(note.title);
    setFocusNoteId(noteId);
    setFocusSecondsLeft(total * 60);
    setFocusOpen(true);
  }

  return (
    <main style={{ minHeight: "100vh", backgroundColor: pageBg(theme), color: pageText(theme), fontFamily: "Inter, Arial, sans-serif" }}>
      <section style={{ maxWidth: 1220, margin: "0 auto", padding: "24px 20px 0" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: muted(theme) }}>
            Boardtivity
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button style={buttonStyle(theme)}>Sign in</button>
            <button style={buttonStyle(theme, true)}>Join waitlist</button>
          </div>
        </header>

        <div style={{ padding: "44px 0 32px", textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: muted(theme) }}>
            Whiteboard productivity app
          </div>
          <h1 style={{ margin: "14px auto 0", maxWidth: 820, fontSize: "clamp(32px, 4.4vw, 52px)", lineHeight: 1.02, letterSpacing: "-.05em", fontWeight: 700 }}>
            Turn messy tasks and scattered thoughts into one clear system.
          </h1>
          <p style={{ margin: "16px auto 0", maxWidth: 720, fontSize: 18, lineHeight: 1.65, color: muted(theme) }}>
            Drag tasks on a paper-like board, break them into steps, connect ideas, and lock into focus mode when you are ready to work.
          </p>
          <div style={{ marginTop: 22, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button style={buttonStyle(theme, true)}>Join beta waitlist</button>
            <button style={buttonStyle(theme)}>See pricing</button>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1220, margin: "0 auto", padding: "0 20px 24px" }}>
        <div style={boardStyle}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: paper(theme),
              backgroundImage: `linear-gradient(${grid(theme)} 1px, transparent 1px), linear-gradient(90deg, ${grid(theme)} 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
              pointerEvents: "none",
            }}
          />

          <div
            ref={viewportRef}
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              touchAction: "none",
              userSelect: "none",
              cursor: boardDragRef.current ? "grabbing" : "grab",
            }}
            onPointerDown={onViewportPointerDown}
            onPointerMove={onViewportPointerMove}
            onPointerUp={onViewportPointerUp}
            onPointerCancel={onViewportPointerUp}
            onClick={() => {
              draggedRef.current = false;
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: BOARD_W,
                height: BOARD_H,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: "0 0",
                backgroundColor: paper(theme),
                backgroundImage: `linear-gradient(${grid(theme)} 1px, transparent 1px), linear-gradient(90deg, ${grid(theme)} 1px, transparent 1px)`,
                backgroundSize: "48px 48px",
              }}
            >
              <svg width={BOARD_W} height={BOARD_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {activeNotes
                  .filter((n) => n.type === "thought")
                  .flatMap((note) =>
                    note.linkedNoteIds
                      .map((linkedId) => {
                        const target = activeNotes.find((n) => n.id === linkedId);
                        if (!target) return null;
                        return (
                          <line
                            key={`thought-link-${note.id}-${linkedId}`}
                            x1={note.x + NOTE_W / 2}
                            y1={note.y + NOTE_H / 2}
                            x2={target.x + NOTE_W / 2}
                            y2={target.y + NOTE_H / 2}
                            stroke={theme === "dark" ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)"}
                            strokeWidth="2"
                          />
                        );
                      })
                      .filter(Boolean) as React.ReactNode[]
                  )}

                {activeNotes
                  .filter((n) => n.showFlow && n.steps.length > 0)
                  .flatMap((note) => {
                    if (note.flowMode === "chain") {
                      return note.steps.map((step, index) => {
                        const prev =
                          index === 0
                            ? { x: note.x + NOTE_W / 2, y: note.y + NOTE_H / 2 }
                            : { x: note.steps[index - 1].x + STEP_W / 2, y: note.steps[index - 1].y + STEP_H / 2 };

                        return (
                          <line
                            key={`${note.id}-${step.id}-chain`}
                            x1={prev.x}
                            y1={prev.y}
                            x2={step.x + STEP_W / 2}
                            y2={step.y + STEP_H / 2}
                            stroke={theme === "dark" ? "rgba(255,255,255,.18)" : "rgba(70,70,70,.18)"}
                            strokeWidth="2"
                          />
                        );
                      });
                    }

                    return note.steps.map((step) => (
                      <line
                        key={`${note.id}-${step.id}-web`}
                        x1={note.x + NOTE_W / 2}
                        y1={note.y + NOTE_H / 2}
                        x2={step.x + STEP_W / 2}
                        y2={step.y + STEP_H / 2}
                        stroke={theme === "dark" ? "rgba(255,255,255,.18)" : "rgba(70,70,70,.18)"}
                        strokeWidth="2"
                      />
                    ));
                  })}
              </svg>

              {activeNotes
                .filter((n) => n.showFlow && n.steps.length > 0)
                .flatMap((note) =>
                  note.steps.map((step) => (
                    <button
                      key={`step-${note.id}-${step.id}`}
                      data-step="true"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        stepDragRef.current = {
                          pointerId: e.pointerId,
                          noteId: note.id,
                          stepId: step.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          stepX: step.x,
                          stepY: step.y,
                        };
                        draggedRef.current = false;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (draggedRef.current) {
                          draggedRef.current = false;
                          return;
                        }
                        setActiveStep({ noteId: note.id, stepId: step.id });
                      }}
                      style={{
                        position: "absolute",
                        left: step.x,
                        top: step.y,
                        width: STEP_W,
                        minHeight: STEP_H,
                        borderRadius: 16,
                        border: `1px solid ${border(theme)}`,
                        backgroundColor: noteBg(note.type, note.importance, theme),
                        boxShadow: "0 10px 18px rgba(0,0,0,.08)",
                        padding: "10px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              border: step.done ? "1px solid #3d8b40" : "1px solid rgba(0,0,0,.18)",
                              backgroundColor: step.done ? "#6fc46b" : theme === "dark" ? "rgba(255,255,255,.12)" : "#f1f1ef",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 700, fontSize: 13, color: noteText(theme) }}>{step.title}</span>
                        </div>
                        <span style={pill(theme)}>{step.minutes} min</span>
                      </div>
                    </button>
                  ))
                )}

              {activeNotes.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                  <div style={{ width: 360, color: theme === "dark" ? "#d8d8d6" : "#70695e" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
                      Click + to create your first {thoughtMode ? "thought" : "task"}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6 }}>
                      Drag the board, zoom in or out, and build your workspace from there.
                    </div>
                  </div>
                </div>
              )}

              {activeNotes.map((note) => (
                <button
                  key={note.id}
                  data-note="true"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    noteDragRef.current = {
                      pointerId: e.pointerId,
                      noteId: note.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      noteX: note.x,
                      noteY: note.y,
                    };
                    draggedRef.current = false;
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    noteDragRef.current = null;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (draggedRef.current) {
                      draggedRef.current = false;
                      return;
                    }
                    setDetailNoteId(note.id);
                  }}
                  style={{
                    position: "absolute",
                    left: note.x,
                    top: note.y,
                    width: NOTE_W,
                    minHeight: NOTE_H,
                    padding: "11px 11px 12px",
                    borderRadius: 16,
                    border: "1px solid rgba(0,0,0,.05)",
                    backgroundColor: noteBg(note.type, note.importance, theme),
                    opacity: note.completed ? 0.62 : 1,
                    boxShadow: `0 0 0 0 ${noteHalo(note.type, note.importance)}, 0 10px 18px rgba(59,43,16,.06)`,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={pill(theme)}>{note.type === "task" ? "Task" : "Thought"}</div>
                    {note.type === "task" && note.dueDate && <div style={{ ...pill(theme), fontWeight: 800 }}>Due {formatDate(note.dueDate)}</div>}
                  </div>

                  <div style={{ marginTop: 10, fontSize: 17, lineHeight: 1.12, fontWeight: 700, color: noteText(theme), maxWidth: 196 }}>
                    {note.title}
                  </div>

                  {note.body && note.type === "thought" && (
                    <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45, color: noteSub(theme), maxWidth: 196 }}>
                      {note.body}
                    </div>
                  )}

                  {note.type === "task" && (
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                        {Array.from({ length: Math.max(note.steps.length, 1) }).map((_, index) => {
                          const done = note.steps[index]?.done;
                          return (
                            <span
                              key={index}
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                border: done ? "1px solid #3d8b40" : "1px solid rgba(0,0,0,.18)",
                                backgroundColor: done ? "#6fc46b" : theme === "dark" ? "rgba(255,255,255,.12)" : "#f1f1ef",
                                display: "inline-block",
                              }}
                            />
                          );
                        })}
                      </div>
                      <span style={pill(theme)}>
                        {note.importance && note.importance !== "none" ? `${note.importance} priority` : "No priority"}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: "absolute", top: 12, left: 16, right: 16, zIndex: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: pageText(theme) }}>
              {activeBoard.name}
            </div>

            <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "center" }}>
              <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
              <button onClick={centerBoard} style={circleButton(theme)} aria-label="Center board">
                ◎
              </button>
              <button ref={boardButtonRef} onClick={() => setBoardsOpen((v) => !v)} style={buttonStyle(theme, boardsOpen, true)}>
                Boards
              </button>

              <div
                ref={boardMenuRef}
                style={{
                  position: "absolute",
                  top: 44,
                  right: 0,
                  width: 290,
                  maxHeight: 380,
                  overflow: "auto",
                  borderRadius: 16,
                  border: `1px solid ${border(theme)}`,
                  backgroundColor: panel(theme),
                  boxShadow: "0 12px 24px rgba(0,0,0,.10)",
                  padding: 10,
                  display: "grid",
                  gap: 10,
                  opacity: boardsOpen ? 1 : 0,
                  transform: boardsOpen ? "translateY(0)" : "translateY(-8px)",
                  pointerEvents: boardsOpen ? "auto" : "none",
                  transition: "opacity .14s ease, transform .14s ease",
                }}
              >
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", color: muted(theme) }}>Boards</div>

                {[...taskBoards, ...thoughtBoards].map((board) => (
                  <div
                    key={board.id}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${border(theme)}`,
                      backgroundColor: board.id === activeBoardId ? (theme === "dark" ? "#23262b" : "#f5f4ef") : panel(theme),
                      padding: 10,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <button
                      onClick={() => {
                        setActiveBoardId(board.id);
                        setBoardsOpen(false);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        textAlign: "left",
                        fontWeight: 700,
                        color: pageText(theme),
                        cursor: "pointer",
                      }}
                    >
                      {board.name}
                    </button>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <button
                        onClick={() => {
                          setRenameBoardId(board.id);
                          setRenameValue(board.name);
                        }}
                        style={buttonStyle(theme, false, true)}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => deleteBoard(board.id)}
                        style={{
                          ...buttonStyle(theme, false, true),
                          backgroundColor: theme === "dark" ? "#26171b" : "#fff4f4",
                          color: theme === "dark" ? "#ffbcbc" : "#8f2323",
                          border: `1px solid ${theme === "dark" ? "rgba(255,120,120,.16)" : "rgba(143,35,35,.12)"}`,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                  <button onClick={() => addBoard("task")} style={buttonStyle(theme, false, true)}>
                    + Task
                  </button>
                  <button onClick={() => addBoard("thought")} style={buttonStyle(theme, false, true)}>
                    + Thought
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setComposerOpen(true)}
            style={{
              position: "absolute",
              right: 18,
              bottom: 18,
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `1px solid ${border(theme)}`,
              backgroundColor: theme === "dark" ? "#f4f7fb" : "#ffffff",
              color: "#111111",
              display: "grid",
              placeItems: "center",
              fontSize: 20,
              fontWeight: 800,
              cursor: "pointer",
              zIndex: 3,
              boxShadow: "0 8px 16px rgba(89,72,48,.08)",
            }}
            aria-label="Add note"
          >
            +
          </button>
        </div>
      </section>

      <section style={{ maxWidth: 1220, margin: "0 auto", padding: "0 20px 64px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              borderRadius: 28,
              border: `1px solid ${border(theme)}`,
              backgroundColor: panel(theme),
              padding: 24,
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr",
              gap: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                Why Boardtivity
              </div>
              <div style={{ marginTop: 10, fontSize: 30, lineHeight: 1.08, fontWeight: 700, maxWidth: 620 }}>
                Plan visually, think clearly, and turn big work into smaller next steps.
              </div>
              <div style={{ marginTop: 14, color: muted(theme), lineHeight: 1.75, maxWidth: 640 }}>
                Boardtivity gives you one clean place to map tasks, connect related thoughts, organize subtasks into a task flow, and start focused work sessions without losing momentum.
              </div>
            </div>

            <div
              style={{
                borderRadius: 22,
                border: `1px solid ${border(theme)}`,
                backgroundColor: theme === "dark" ? "#23262b" : "#f7f5ef",
                padding: 18,
                display: "grid",
                gap: 12,
                alignContent: "start",
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                Included
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 700 }}>Task boards and thought boards</div>
                <div style={{ fontWeight: 700 }}>Task breakdowns, Taskweb, and Taskchain</div>
                <div style={{ fontWeight: 700 }}>Connected thoughts and focus sessions</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div style={{ borderRadius: 24, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: 22 }}>
              <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                Free
              </div>
              <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700 }}>Start free</div>
              <div style={{ marginTop: 12, color: muted(theme), lineHeight: 1.7 }}>
                Build boards, create notes, and try the planning workflow before launch.
              </div>
            </div>

            <div style={{ borderRadius: 24, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: 22 }}>
              <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                Pro
              </div>
              <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700 }}>$5.99<span style={{ fontSize: 16, color: muted(theme) }}> / month</span></div>
              <div style={{ marginTop: 12, color: muted(theme), lineHeight: 1.7 }}>
                Unlock the full premium workflow, smarter planning features, and expanded board usage.
              </div>
            </div>

            <div style={{ borderRadius: 24, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: 22 }}>
              <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                Beta access
              </div>
              <div style={{ marginTop: 10, fontSize: 26, lineHeight: 1.12, fontWeight: 700 }}>
                Join the waitlist before launch.
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={buttonStyle(theme, true)}>Join waitlist</button>
                <button style={buttonStyle(theme)}>Learn more</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {renameBoardId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 36,
            backgroundColor: theme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRenameBoardId(null);
          }}
        >
          <div style={{ width: "min(420px, 100%)", borderRadius: 22, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#1f2329" : "#fbf8f1", padding: 18 }}>
            <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
              Rename board
            </div>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              style={{
                width: "100%",
                height: 52,
                marginTop: 12,
                borderRadius: 16,
                border: `1px solid ${border(theme)}`,
                backgroundColor: inputBg(theme),
                color: pageText(theme),
                padding: "0 14px",
                outline: "none",
              }}
            />
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={() => setRenameBoardId(null)} style={buttonStyle(theme)}>Cancel</button>
              <button onClick={saveRename} style={buttonStyle(theme, true)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {composerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30,
            backgroundColor: theme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setComposerOpen(false);
          }}
        >
          <div
            style={{
              width: thoughtMode ? "min(760px, 100%)" : "min(960px, 100%)",
              backgroundColor: theme === "dark" ? "#1f2329" : "#fbf8f1",
              color: pageText(theme),
              borderRadius: 28,
              border: `1px solid ${border(theme)}`,
              boxShadow: "0 30px 100px rgba(0,0,0,.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${border(theme)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(theme) }}>
                  Adding to {activeBoard.name}
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>
                  {thoughtMode ? "Add a thought" : "Add a task"}
                </div>
              </div>
              <button onClick={() => setComposerOpen(false)} style={circleButton(theme, 42)}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: thoughtMode ? "1fr" : "1fr 360px", gap: 16, padding: 18, alignItems: "start" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    borderRadius: 24,
                    backgroundColor: thoughtMode ? (theme === "dark" ? "#3f444b" : "#e6e7ea") : (theme === "dark" ? "#66551e" : "#f3efcf"),
                    border: composerError.title ? "1px solid rgba(200,40,40,.5)" : "1px solid rgba(0,0,0,.05)",
                    padding: 18,
                    minHeight: thoughtMode ? 160 : 250,
                  }}
                >
                  <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(theme) }}>
                    {thoughtMode ? "Thought" : "Task"}
                  </div>
                  <textarea
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setComposerError((prev) => ({ ...prev, title: false }));
                      if (!thoughtMode && e.target.value.trim()) {
                        setMinutes(estimateTime(e.target.value));
                      }
                    }}
                    placeholder={thoughtMode ? "What’s on your mind?" : "What do you need to do?"}
                    style={{
                      width: "100%",
                      minHeight: thoughtMode ? 68 : 110,
                      marginTop: 10,
                      border: "none",
                      background: "transparent",
                      resize: "none",
                      outline: "none",
                      color: pageText(theme),
                      fontSize: 26,
                      lineHeight: 1.08,
                      fontWeight: 700,
                    }}
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={thoughtMode ? "Optional note" : "Optional details"}
                    style={{
                      width: "100%",
                      minHeight: 44,
                      border: "none",
                      background: "transparent",
                      resize: "none",
                      outline: "none",
                      color: muted(theme),
                      fontSize: 15,
                      lineHeight: 1.6,
                    }}
                  />
                </div>

                {!thoughtMode && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div
                      style={{
                        ...fieldStyle(theme),
                        position: "relative",
                        border: composerError.dueDate ? "1px solid rgba(200,40,40,.55)" : fieldStyle(theme).border,
                        boxShadow: composerError.dueDate ? "0 0 0 3px rgba(200,40,40,.12)" : "none",
                      }}
                    >
                      <span style={{ color: pageText(theme), opacity: 0.92 }}>
                        {dueDate ? formatDate(dueDate) : "Due date"}
                      </span>
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          setComposerError((prev) => ({ ...prev, dueDate: false }));
                        }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          opacity: 0.001,
                          cursor: "pointer",
                        }}
                      />
                    </div>

                    <select
                      value={importance}
                      onChange={(e) => {
                        setImportance(e.target.value as Importance);
                        setComposerError((prev) => ({ ...prev, importance: false }));
                      }}
                      style={{
                        ...fieldStyle(theme),
                        appearance: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        cursor: "pointer",
                        color: pageText(theme),
                        opacity: 0.92,
                        border: composerError.importance ? "1px solid rgba(200,40,40,.55)" : fieldStyle(theme).border,
                        boxShadow: composerError.importance ? "0 0 0 3px rgba(200,40,40,.12)" : "none",
                      }}
                    >
                      <option value="none">Set priority</option>
                      <option value="Low">Low priority</option>
                      <option value="Medium">Medium priority</option>
                      <option value="High">High priority</option>
                    </select>

                    <div style={{ ...fieldStyle(theme), justifyContent: "space-between" }}>
                      <button onClick={() => setMinutes((m) => Math.max(5, m - 5))} style={circleButton(theme, 30)}>-</button>
                      <div style={{ flex: 1, textAlign: "center", color: pageText(theme), opacity: 0.92 }}>{minutes} min</div>
                      <button onClick={() => setMinutes((m) => m + 5)} style={circleButton(theme, 30)}>+</button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: thoughtMode ? "none" : "grid", gap: 12, alignContent: "start" }}>
                {!thoughtMode && (
                  <>
                    <div style={{ borderRadius: 20, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: 16 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                        Current tasks
                      </div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {recentTasks.length === 0 ? (
                          <div style={{ color: muted(theme), fontSize: 14 }}>No current tasks yet.</div>
                        ) : (
                          recentTasks.map((task) => (
                            <div key={task.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                              <span style={{ fontSize: 14, color: pageText(theme) }}>{task.title}</span>
                              {task.dueDate ? <span style={pill(theme)}>{formatDate(task.dueDate)}</span> : <span style={pill(theme)}>No due date</span>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ borderRadius: 20, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: 16 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                        AI planning
                      </div>
                      <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, color: muted(theme) }}>
                        Break the task into more manageable steps with a rough time split.
                      </div>
                      <button onClick={() => setAiSteps(buildBreakdown(title || "New task", minutes))} style={{ ...buttonStyle(theme, true), marginTop: 14 }}>
                        Breakdown Task
                      </button>
                      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                        {aiSteps.length === 0 ? (
                          <div style={{ color: muted(theme), fontSize: 14 }}>No breakdown yet.</div>
                        ) : (
                          aiSteps.map((step) => (
                            <div key={step.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", paddingBottom: 8, borderBottom: `1px solid ${border(theme)}` }}>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{step.title}</div>
                              <div style={pill(theme)}>{step.minutes} min</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: "grid", gap: 10 }}>
                  {Object.values(composerError).some(Boolean) && (
                    <div style={{ color: theme === "dark" ? "#ffb4b4" : "#a32727", fontSize: 13, fontWeight: 600 }}>
                      Please fill out all required fields.
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button onClick={() => setComposerOpen(false)} style={buttonStyle(theme)}>Cancel</button>
                    <button onClick={createNote} style={buttonStyle(theme, true)}>{thoughtMode ? "Create thought" : "Create task"}</button>
                  </div>
                </div>
              </div>

              {thoughtMode && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button onClick={() => setComposerOpen(false)} style={buttonStyle(theme)}>Cancel</button>
                    <button onClick={createNote} style={buttonStyle(theme, true)}>Create thought</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {detailNote && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 32,
            backgroundColor: theme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailNoteId(null);
          }}
        >
          <div
            style={{
              width: "min(980px, 100%)",
              backgroundColor: theme === "dark" ? "#1f2329" : "#fbf8f1",
              color: pageText(theme),
              borderRadius: 28,
              border: `1px solid ${border(theme)}`,
              boxShadow: "0 30px 100px rgba(0,0,0,.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${border(theme)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(theme) }}>
                  {detailNote.type === "task" ? "Task details" : "Thought details"}
                </div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>{detailNote.title}</div>
              </div>
              <button onClick={() => setDetailNoteId(null)} style={circleButton(theme, 42)}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: detailNote.type === "task" ? "1fr 300px" : "1fr", gap: 16, padding: 18 }}>
              <div style={{ borderRadius: 20, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: 16 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 14, color: muted(theme) }}>Main focus</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{detailNote.title}</div>
                  {detailNote.dueDate && <div>Due {formatDate(detailNote.dueDate)}</div>}
                  {detailNote.body && <div style={{ color: muted(theme), lineHeight: 1.7 }}>{detailNote.body}</div>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={pill(theme)}>Created {formatDate(detailNote.createdAt)}</span>
                    {detailNote.minutes && <span style={pill(theme)}>{detailNote.minutes} min</span>}
                    {detailNote.importance && detailNote.importance !== "none" ? <span style={pill(theme)}>{detailNote.importance} priority</span> : <span style={pill(theme)}>Set priority</span>}
                    {detailNote.completed && <span style={pill(theme)}>Completed</span>}
                  </div>
                </div>

                {detailNote.type === "task" ? (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 14, color: muted(theme), marginBottom: 10 }}>Subtasks</div>
                    {detailNote.steps.length === 0 ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ color: muted(theme), lineHeight: 1.6 }}>
                          No subtasks yet. Break down your task into more manageable steps.
                        </div>
                        <button onClick={() => openBreakdownFromDetails(detailNote)} style={buttonStyle(theme, true)}>
                          Breakdown Task
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {detailNote.steps.map((step) => (
                          <button
                            key={step.id}
                            onClick={() => setActiveStep({ noteId: detailNote.id, stepId: step.id })}
                            style={{
                              borderRadius: 14,
                              border: `1px solid ${border(theme)}`,
                              backgroundColor: inputBg(theme),
                              padding: "12px 14px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: "50%",
                                  border: step.done ? "1px solid #3d8b40" : "1px solid rgba(0,0,0,.18)",
                                  backgroundColor: step.done ? "#6fc46b" : theme === "dark" ? "rgba(255,255,255,.12)" : "#f1f1ef",
                                  display: "inline-block",
                                }}
                              />
                              <span style={{ fontWeight: 700 }}>{step.title}</span>
                            </div>
                            <span style={pill(theme)}>{step.minutes} min</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 14, color: muted(theme), marginBottom: 10 }}>Connected thoughts</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {activeNotes.filter((n) => n.type === "thought" && n.id !== detailNote.id).length === 0 ? (
                        <div style={{ color: muted(theme) }}>Add more thought notes to connect them.</div>
                      ) : (
                        activeNotes
                          .filter((n) => n.type === "thought" && n.id !== detailNote.id)
                          .map((n) => {
                            const linked = detailNote.linkedNoteIds.includes(n.id);
                            return (
                              <button key={n.id} onClick={() => toggleThoughtLink(detailNote.id, n.id)} style={buttonStyle(theme, linked, false)}>
                                {linked ? "Unlink" : "Link"} {n.title}
                              </button>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {detailNote.type === "task" && (
                <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
                  <div style={{ borderRadius: 20, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: 16 }}>
                    <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                      Task flow
                    </div>
                    <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, color: muted(theme) }}>
                      Choose how your subtasks show on the board.
                    </div>

                    {detailNote.steps.length > 0 ? (
                      <>
                        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <button onClick={() => setFlowMode(detailNote, "web")} style={buttonStyle(theme, detailNote.flowMode === "web", true)}>
                            Taskweb
                          </button>
                          <button onClick={() => setFlowMode(detailNote, "chain")} style={buttonStyle(theme, detailNote.flowMode === "chain", true)}>
                            Taskchain
                          </button>
                        </div>
                        <button onClick={() => toggleFlow(detailNote.id)} style={{ ...buttonStyle(theme, true), marginTop: 10, width: "100%" }}>
                          {detailNote.showFlow ? "Hide flow" : "Show flow"}
                        </button>
                      </>
                    ) : (
                      <div style={{ marginTop: 14, color: muted(theme), fontSize: 14 }}>
                        Add subtasks to unlock Taskweb and Taskchain.
                      </div>
                    )}
                  </div>

                  <div style={{ borderRadius: 20, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: 16 }}>
                    <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme) }}>
                      Actions
                    </div>
                    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                      <button onClick={() => startFocus(detailNote.id)} style={buttonStyle(theme, true)}>
                        Start focus
                      </button>
                      <button onClick={() => completeTask(detailNote.id)} style={buttonStyle(theme, false)}>
                        Complete task
                      </button>
                      <button
                        onClick={() => deleteTask(detailNote.id)}
                        style={{
                          ...buttonStyle(theme, false),
                          backgroundColor: theme === "dark" ? "#26171b" : "#fff4f4",
                          color: theme === "dark" ? "#ffbcbc" : "#8f2323",
                          border: `1px solid ${theme === "dark" ? "rgba(255,120,120,.16)" : "rgba(143,35,35,.12)"}`,
                        }}
                      >
                        Delete task
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {stepModal && activeStep && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 34,
            backgroundColor: theme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveStep(null);
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              backgroundColor: theme === "dark" ? "#1f2329" : "#fbf8f1",
              color: pageText(theme),
              borderRadius: 24,
              border: `1px solid ${border(theme)}`,
              boxShadow: "0 30px 100px rgba(0,0,0,.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${border(theme)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(theme) }}>Subtask</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{stepModal.title}</div>
              </div>
              <button onClick={() => setActiveStep(null)} style={circleButton(theme, 40)}>✕</button>
            </div>
            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={pill(theme)}>{stepModal.minutes} min</span>
                <span style={pill(theme)}>{stepModal.done ? "Completed" : "Incomplete"}</span>
              </div>
              <button
                onClick={() => {
                  toggleStepDone(activeStep.noteId, activeStep.stepId);
                  setActiveStep(null);
                }}
                style={buttonStyle(theme, true)}
              >
                {stepModal.done ? "Mark incomplete" : "Mark complete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {focusOpen && focusNoteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            backgroundColor: "rgba(8,10,14,.92)",
            color: "#f7f8fb",
            display: "grid",
            placeItems: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 14, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(247,248,251,.64)" }}>
              Focus mode
            </div>
            <div style={{ marginTop: 14, fontSize: 40, fontWeight: 700 }}>
              {String(Math.floor(focusSecondsLeft / 60)).padStart(2, "0")}:{String(focusSecondsLeft % 60).padStart(2, "0")}
            </div>
            <div style={{ marginTop: 12, color: "rgba(247,248,251,.72)" }}>
              Leaving this session resets the timer.
            </div>
            <button
              onClick={() => {
                setFocusOpen(false);
                setFocusSecondsLeft(0);
                setFocusNoteId(null);
              }}
              style={{ ...buttonStyle("dark", true), marginTop: 20 }}
            >
              Exit and reset
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
