"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { ThemeMode, BoardType, Importance, FlowMode, Board, Step, Note, Draft } from "@/lib/board";
import type { BobNewNote, BobSettings } from "@/components/BobAgent";
import { useMutation, useQuery } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { useIsMobile, useRevealOnScroll } from "@/lib/hooks";
import { NOTE_PALETTE, TASK_PALETTE, hexToRgba, blendHex, clampCardBg, PRIORITY_COLORS } from "@/lib/colors";
import { pageBg, surface, border } from "@/lib/ui";
import { BOARD_W, BOARD_H, NOTE_W, NOTE_H, STEP_W, STEP_H, INITIAL_BOARDS, genId, nextBoardName, layoutWeb, layoutChain, readLocal } from "@/lib/boardLayout";

// All HomeShell state, effects and handlers. Views read it through HomeContext (see HomeContext.tsx).
export function useHomeState() {
  const [theme, setTheme] = useState<ThemeMode>(() => readLocal("theme", "light"));
  const [boardTheme, setBoardTheme] = useState<ThemeMode>(() => readLocal("boardTheme", "light"));
  const [boards, setBoards] = useState<Board[]>(INITIAL_BOARDS);
  const [activeBoardId, setActiveBoardId] = useState("my-board");
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [highlightedNoteIds, setHighlightedNoteIds] = useState<Set<number>>(new Set());
  const [undoSnapshot,       setUndoSnapshot]       = useState<Note[] | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detailNoteId, setDetailNoteId] = useState<number | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailEditTitle, setDetailEditTitle] = useState("");
  const [detailEditBody, setDetailEditBody] = useState("");
  const [detailEditDueDate, setDetailEditDueDate] = useState("");
  const [detailEditDueTime, setDetailEditDueTime] = useState("");
  const [detailEditImportance, setDetailEditImportance] = useState<Importance>("none");
  const [detailEditMinutes, setDetailEditMinutes] = useState(60);
  const [detailEditSteps, setDetailEditSteps] = useState<Step[]>([]);
  const [detailEditColorIdx, setDetailEditColorIdx] = useState<number | undefined>(undefined);
  const [detailBreakdownVariant, setDetailBreakdownVariant] = useState(0);
  const [activeStep, setActiveStep] = useState<{ noteId: number; stepId: number } | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [renameBoardId, setRenameBoardId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [importance, setImportance] = useState<Importance>("none");
  const [aiSteps, setAiSteps] = useState<Step[]>([]);
  const [breakdownVariant, setBreakdownVariant] = useState(0);
  const [composerError, setComposerError] = useState<{ title?: boolean; dueDate?: boolean; importance?: boolean }>({});

  const [focusOpen, setFocusOpen] = useState(false);
  const [focusNoteId, setFocusNoteId] = useState<number | null>(null);
  const [focusStepId, setFocusStepId] = useState<number | null>(null);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(0);
  const [focusCompleted, setFocusCompleted] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0);
  const [focusChainMode, setFocusChainMode] = useState(false);
  const [focusNextStep, setFocusNextStep] = useState<{ id: number; title: string; minutes: number } | null>(null);
  const [focusExitConfirm, setFocusExitConfirm] = useState(false);
  // Duration picker (shown before focus starts)
  const [focusPicker, setFocusPicker] = useState<{ noteId: number; chain: boolean } | null>(null);
  // Session review (shown after focus ends)
  const [focusReview, setFocusReview] = useState<{ elapsedMin: number; noteId: number; stepId: number | null } | null>(null);
  const focusSessionStartRef = useRef<number>(0); // epoch ms when session started
  // Profile panel
  const [profileOpen, setProfileOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [limitReachedOpen, setLimitReachedOpen] = useState(false);
  const [showSubscribedModal, setShowSubscribedModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const focusNoteIdRef = useRef<number | null>(null);
  const focusStepIdRef = useRef<number | null>(null);
  // Wall-clock timer: stores the epoch ms when the current segment started running
  const focusStartedAtRef = useRef<number>(0);
  // Total seconds for the current segment (so we can recompute after backgrounding)
  const focusTotalSecsRef = useRef<number>(0);
  // Seconds remaining when paused — used to reset wall-clock on resume
  const focusPausedSecsRef = useRef<number>(0);
  const notesRef = useRef<typeof notes>([]);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [composerColorIdx, setComposerColorIdx] = useState<number | undefined>(0);
  const [thoughtUnlinkTarget, setThoughtUnlinkTarget] = useState<number | null>(null);
  const thoughtUnlinkTargetRef = useRef<number | null>(null);
  const thoughtHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const boardMenuRef = useRef<HTMLDivElement | null>(null);
  const boardButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [heroRef, heroVisible] = useRevealOnScroll();
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  const [mobileExpandedIds, setMobileExpandedIds] = useState<Set<number>>(new Set());
  const [mobileAddMode, setMobileAddMode] = useState<"task" | "thought" | null>(null);
  const [mobileAddTitle, setMobileAddTitle] = useState("");
  const [mobileAddBody, setMobileAddBody] = useState("");
  const [mobileAddImportance, setMobileAddImportance] = useState<Importance>("Low");
  const [mobileAddDueDate, setMobileAddDueDate] = useState("");
  const [mobileAddDueTime, setMobileAddDueTime] = useState("");
  const [mobileActionNoteId, setMobileActionNoteId] = useState<number | null>(null);
  const [mobileEditTitle, setMobileEditTitle] = useState("");
  const [mobileEditDueDate, setMobileEditDueDate] = useState("");
  const [mobileEditDueTime, setMobileEditDueTime] = useState("");
  const [mobileEditImportance, setMobileEditImportance] = useState<Importance>("none");
  const [mobileEditMinutes, setMobileEditMinutes] = useState("");
  const [mobileAddColorIdx, setMobileAddColorIdx] = useState<number | undefined>(undefined);
  const [mobileEditColorIdx, setMobileEditColorIdx] = useState<number | undefined>(undefined);
  const [mobileAddRemindIn, setMobileAddRemindIn] = useState<number | null>(null);
  const [mobileEditSteps, setMobileEditSteps] = useState<{ id: number; title: string; minutes: number }[]>([]);
  const [mobileDeleteConfirm, setMobileDeleteConfirm] = useState(false);
  const [mobileBoardTypePicker, setMobileBoardTypePicker] = useState(false);
  const [mobileBoardActionId, setMobileBoardActionId] = useState<string | null>(null);
  const [mobileBoardRename, setMobileBoardRename] = useState("");
  const [mobileBoardRenaming, setMobileBoardRenaming] = useState(false);
  const [mobileFilterPriority, setMobileFilterPriority] = useState<"all" | "High" | "Medium" | "Low">("all");
  const [mobileSortDate, setMobileSortDate] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState<"header" | "settings" | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showSyncPill, setShowSyncPill] = useState(() => {
    try { return !!sessionStorage.getItem("boardtivity_just_signed_in"); } catch { return false; }
  });
  const subscription = useQuery(api.subscriptions.getMySubscription);
  const isPlus = !!subscription;

  async function startCheckout(plan: "monthly" | "annual") {
    if (!isSignedIn) { openSignUp(); return; }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error ?? "Something went wrong. Try again.");
      }
    } catch (e) {
      console.error("Checkout failed", e);
      setCheckoutError("Network error. Try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function startPortal() {
    if (!subscription) return;
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error("Portal failed", e);
    }
  }

  const isAdmin = useQuery(api.admin.checkAdmin);
  const { user, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { openSignIn, openSignUp, signOut } = useClerk();

  const isNativeApp = typeof navigator !== "undefined" && navigator.userAgent.includes("BoardtivityApp");

  const [titleMounted, setTitleMounted] = useState(false);
  useEffect(() => {
    if (isSignedIn) {
      setTitleMounted(true);
    } else {
      const t = setTimeout(() => setTitleMounted(false), 450);
      return () => clearTimeout(t);
    }
  }, [isSignedIn]);

  const saveBoard = useMutation(api.boards.save);
  const logFocusSession = useMutation(api.focusStats.logSession);
  const localToday = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const focusStatsData = useQuery(api.focusStats.getStats, isSignedIn ? { days: 7, clientToday: localToday } : "skip");
  const setReminderMut = useMutation(api.reminders.set);
  const cancelReminderMut = useMutation(api.reminders.cancel);
  const emailPrefs = useQuery(api.emailPrefs.get);
  const updateEmailPrefs = useMutation(api.emailPrefs.update);
  const savedBoard = useQuery(api.boards.load);
  const convexReadyRef = useRef(false);
  const convexSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set true in effect-2 when we apply cloud data; cleared in effect-3 so we
  // don't immediately push the same data back to Convex (prevents apply→save loop)
  const justAppliedCloudRef = useRef(false);
  // updatedAt of the last Convex snapshot we applied to state.
  // Prevents re-applying the same snapshot on every subscription tick.
  const lastAppliedCloudAtRef = useRef(0);
  // Tracks the exact boardState string we last pushed to Convex so we can
  // detect our own saves reflected back by the subscription and skip re-applying them.
  const lastSavedStateRef = useRef<string | null>(null);
  // Tracks the known Convex document ID so saves can skip the read and use
  // db.replace() directly, eliminating write conflicts on concurrent saves.
  const savedBoardIdRef = useRef<string | undefined>(undefined);
  // Always-current board state string — updated in the persist effect so that
  // pushToCloud() and the flush handler always save the LATEST state even when
  // called from a stale closure (e.g. the pagehide / visibilitychange handler).
  const latestBoardStateRef = useRef<string>("");
  // Single-in-flight save guard: prevents two concurrent pushToCloud() calls from
  // racing each other. If a save is already running, mark dirty so we re-push the
  // latest state immediately after it completes.
  const saveInFlightRef = useRef(false);
  const saveDirtyRef = useRef(false);
  // Deletion tombstones: IDs the user has explicitly deleted in this session.
  // When a stale cloud save from another device "restores" a deleted item, the
  // sync effect re-filters it out and re-pushes, so the deletion always wins.
  const localDeletedNoteIdsRef = useRef<Set<number>>(new Set());
  const localDeletedBoardIdsRef = useRef<Set<string>>(new Set());

  const [settingsOpen, setSettingsOpen] = useState(false);
  const bobUserInfoData  = useQuery(api.bob.getBobUserInfo);
  const setBobUserInfoFn = useMutation(api.bob.setBobUserInfo);
  const bobUserInfo = bobUserInfoData ?? "";
  const [bobAutoSend, setBobAutoSend] = useState(() => { try { return localStorage.getItem("bob_auto_send") === "true"; } catch { return false; } });
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false); // noteId (number) or boardId (string)
  const [boardGrid, setBoardGrid] = useState<"grid" | "dots" | "blank">(() => readLocal("boardGrid", "grid"));
  const [thoughtColorMode, setThoughtColorMode] = useState<"random" | "fixed">(() => readLocal("thoughtColorMode", "random"));
  const [thoughtFixedColorIdx, setThoughtFixedColorIdx] = useState<number>(() => readLocal("thoughtFixedColorIdx", 0));
  const [taskColorMode, setTaskColorMode] = useState<"priority" | "single">(() => readLocal("taskColorMode", "priority"));
  const [taskHighColorIdx, setTaskHighColorIdx] = useState<number>(() => readLocal("taskHighColorIdx", 0));
  const [taskMedColorIdx, setTaskMedColorIdx] = useState<number>(() => readLocal("taskMedColorIdx", 1));
  const [taskLowColorIdx, setTaskLowColorIdx] = useState<number>(() => readLocal("taskLowColorIdx", 2));
  const [taskSingleColorIdx, setTaskSingleColorIdx] = useState<number>(() => readLocal("taskSingleColorIdx", 0));
  const [taskSingleCustom, setTaskSingleCustom] = useState<string>(() => readLocal("taskSingleCustom", ""));
  const [taskHighCustom, setTaskHighCustom]     = useState<string>(() => readLocal("taskHighCustom", ""));
  const [taskMedCustom, setTaskMedCustom]       = useState<string>(() => readLocal("taskMedCustom", ""));
  const [taskLowCustom, setTaskLowCustom]       = useState<string>(() => readLocal("taskLowCustom", ""));
  const colorWheelSingleRef = useRef<HTMLInputElement | null>(null);
  const colorWheelHighRef   = useRef<HTMLInputElement | null>(null);
  const colorWheelMedRef    = useRef<HTMLInputElement | null>(null);
  const colorWheelLowRef    = useRef<HTMLInputElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<"loading" | "synced" | "saving" | "error">("loading");

  const boardDragRef = useRef<null | { startX: number; startY: number; panX: number; panY: number }>(null);
  const noteDragRef = useRef<null | { pointerId: number; noteId: number; noteType: BoardType; boardId: string; startX: number; startY: number; noteX: number; noteY: number }>(null);
  const thoughtDropTargetRef = useRef<number | null>(null);
  const [thoughtDropTarget, setThoughtDropTarget] = useState<number | null>(null);
  const stepDragRef = useRef<null | { pointerId: number; noteId: number; stepId: number; startX: number; startY: number; stepX: number; stepY: number }>(null);
  const pointerMapRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<null | { distance: number; scale: number }>(null);
  const draggedRef = useRef(false);
  const dragThresholdRef = useRef(6);

  const [scale, setScale] = useState(0.82);
  const [pan, setPan] = useState({ x: -420, y: -140 });

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? boards[0];
  const activeNotes = notes.filter((n) => n.boardId === activeBoardId);

  // Resolve effective task color for a given priority level
  const taskPaletteEntry = (importance: "High" | "Medium" | "Low") => {
    if (taskColorMode === "single") {
      if (taskSingleColorIdx >= TASK_PALETTE.length && taskSingleCustom)
        return { swatch: taskSingleCustom, light: taskSingleCustom, dark: taskSingleCustom, halo: hexToRgba(taskSingleCustom, 0.22) };
      return TASK_PALETTE[taskSingleColorIdx % TASK_PALETTE.length];
    }
    const idx = importance === "High" ? taskHighColorIdx : importance === "Medium" ? taskMedColorIdx : taskLowColorIdx;
    const custom = importance === "High" ? taskHighCustom : importance === "Medium" ? taskMedCustom : taskLowCustom;
    if (idx >= TASK_PALETTE.length && custom)
      return { swatch: custom, light: custom, dark: custom, halo: hexToRgba(custom, 0.22) };
    return TASK_PALETTE[idx % TASK_PALETTE.length];
  };
  const getBg = (importance: Importance | undefined) => {
    if (!importance || importance === "none") return boardTheme === "dark" ? "#2a2d32" : "#ebebeb";
    const custom = taskPaletteEntry(importance as "High"|"Medium"|"Low");
    const c = custom ? custom.swatch : PRIORITY_COLORS[importance as "High"|"Medium"|"Low"];
    return clampCardBg(blendHex(c, boardTheme === "dark" ? "#17191d" : "#ffffff", boardTheme === "dark" ? 0.28 : 0.32), boardTheme === "dark" ? "#17191d" : "#ffffff", 28);
  };
  const getHalo = (importance: Importance | undefined) => {
    if (!importance || importance === "none") return boardTheme === "dark" ? "rgba(140,140,140,.18)" : "rgba(0,0,0,.10)";
    const custom = taskPaletteEntry(importance as "High"|"Medium"|"Low");
    if (custom) return custom.halo;
    return hexToRgba(PRIORITY_COLORS[importance as "High"|"Medium"|"Low"], boardTheme === "dark" ? 0.30 : 0.48);
  };
  const getNoteBorder = (importance: Importance | undefined) => {
    if (!importance || importance === "none") return `1px solid ${boardTheme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.10)"}`;
    const custom = taskPaletteEntry(importance as "High"|"Medium"|"Low");
    const c = custom ? custom.swatch : PRIORITY_COLORS[importance as "High"|"Medium"|"Low"];
    return `1.5px solid ${hexToRgba(c, boardTheme === "dark" ? 0.28 : 0.42)}`;
  };
  const detailNote = notes.find((n) => n.id === detailNoteId) ?? null;
  const stepModal = activeStep
    ? notes.find((n) => n.id === activeStep.noteId)?.steps.find((s) => s.id === activeStep.stepId) ?? null
    : null;
  const thoughtMode = activeBoard.type === "thought";

  const boardStyle = useMemo<CSSProperties>(
    () => ({
      position: "relative",
      height: "min(82vh, 1000px)",
      minHeight: 560,
      borderRadius: 16,
      overflow: "hidden",
      border: `1px solid ${border(boardTheme)}`,
      backgroundColor: surface(boardTheme),
      boxShadow: boardTheme === "dark" ? "0 24px 50px rgba(0,0,0,.28)" : "0 24px 50px rgba(0,0,0,.10)",
    }),
    [boardTheme]
  );

  // In fullscreen, overflow:hidden clips fixed-position modals — override it
  const fullscreenOverride: CSSProperties = isFullscreen
    ? { borderRadius: 0, border: "none", minHeight: "100vh", overflow: "visible" }
    : {};

  // In native app, board always fills the screen (no fullscreen button needed)
  const nativeAppOverride: CSSProperties = isNativeApp
    ? { position: "fixed", inset: 0, width: "100%", height: "100%", borderRadius: 0, border: "none", minHeight: "unset", overflow: "visible", zIndex: 10 }
    : {};

  const taskBoards = boards.filter((b) => b.type === "task");
  const thoughtBoards = boards.filter((b) => b.type === "thought");
  const recentTasks = [...notes]
    .filter((n) => n.type === "task" && !n.completed && !(n.steps.length > 0 && n.steps.every(s => s.done)))
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.id - a.id;
    })
    .slice(0, 3);

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

  // Find a board position that doesn't overlap existing notes for the active board.
  function findFreeSpot(
    existing: Note[], preferredX: number, preferredY: number,
    minX = 40, maxX = BOARD_W - NOTE_W - 40,
    minY = 60, maxY = BOARD_H - NOTE_H - 40,
  ): { x: number; y: number } {
    const W = NOTE_W + 24;
    const H = NOTE_H + 24;
    // Ensure bounds are valid (can collapse if visible area is tiny).
    const bMinX = Math.min(minX, maxX);
    const bMaxX = Math.max(minX, maxX);
    const bMinY = Math.min(minY, maxY);
    const bMaxY = Math.max(minY, maxY);
    function overlaps(x: number, y: number) {
      return existing.some(n => Math.abs(n.x - x) < W && Math.abs(n.y - y) < H);
    }
    const px = Math.max(bMinX, Math.min(bMaxX, preferredX));
    const py = Math.max(bMinY, Math.min(bMaxY, preferredY));
    if (!overlaps(px, py)) return { x: px, y: py };
    for (let ring = 1; ring <= 30; ring++) {
      const step = Math.max(W, H);
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const cx = Math.max(bMinX, Math.min(bMaxX, px + dx * step));
          const cy = Math.max(bMinY, Math.min(bMaxY, py + dy * step));
          if (!overlaps(cx, cy)) return { x: cx, y: cy };
        }
      }
    }
    return { x: px, y: py };
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

  // Check for ?subscribed=true after Stripe redirect; handle fresh sign-in flag
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") === "true") {
      setShowSubscribedModal(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    try {
      if (sessionStorage.getItem("boardtivity_just_signed_in")) {
        didJustSignInRef.current = true;
        sessionStorage.removeItem("boardtivity_just_signed_in");
        // Pill already visible from initial state — schedule hide
        const t = setTimeout(() => setShowSyncPill(false), 4000);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  // Show one-time sync-overhaul update notice to signed-in users
  useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return;
    try {
      const seen = localStorage.getItem("boardtivity_update_sync_v1_seen");
      if (!seen) setShowUpdateModal(true);
    } catch {}
  }, [clerkLoaded, isSignedIn]);

  // Prompt existing users without a name to set one
  useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return;
    if (user?.firstName) return; // already has name
    try {
      const dismissed = localStorage.getItem("boardtivity_name_prompt_dismissed");
      if (!dismissed) setNamePromptOpen(true);
    } catch {}
  }, [clerkLoaded, isSignedIn, user?.firstName]);

  // When user signs in (false → true), reload for fresh state.
  // When user signs out (true → false), immediately clear board data.
  const prevSignedInRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (prevSignedInRef.current === false && isSignedIn === true) {
      try { sessionStorage.setItem("boardtivity_just_signed_in", "1"); } catch {}
      window.location.reload();
    }
    if (prevSignedInRef.current === true && isSignedIn === false) {
      setBoards(INITIAL_BOARDS);
      setNotes([]);
      setActiveBoardId(INITIAL_BOARDS[0].id);
    }
    if (isSignedIn !== undefined) prevSignedInRef.current = isSignedIn;
  }, [isSignedIn]);

  // Load persisted state — wait for Clerk to resolve before hydrating.
  // localStorage gives instant initial render; Convex then overwrites with
  // authoritative cloud data when it arrives.
  useEffect(() => {
    if (isSignedIn === undefined) return;
    try {
      const saved = localStorage.getItem("boardtivity");
      if (saved) {
        const data = JSON.parse(saved) as {
          theme?: ThemeMode; boardTheme?: ThemeMode;
          boards?: Board[]; notes?: Note[]; activeBoardId?: string;
          drafts?: Draft[]; thoughtColorMode?: "random" | "fixed";
          thoughtFixedColorIdx?: number; boardGrid?: "grid" | "dots" | "blank";
          taskColorMode?: "priority" | "single"; taskHighColorIdx?: number;
          taskMedColorIdx?: number; taskLowColorIdx?: number; taskSingleColorIdx?: number;
        };
        if (data.theme) setTheme(data.theme);
        if (data.boardTheme) setBoardTheme(data.boardTheme);
        if (isSignedIn) {
          if (Array.isArray(data.boards) && data.boards.length > 0) setBoards(data.boards);
          if (Array.isArray(data.notes)) setNotes(data.notes);
          if (data.activeBoardId) setActiveBoardId(data.activeBoardId);
          if (Array.isArray(data.drafts)) setDrafts(data.drafts);
          if (data.thoughtColorMode) setThoughtColorMode(data.thoughtColorMode);
          if (typeof data.thoughtFixedColorIdx === "number") setThoughtFixedColorIdx(data.thoughtFixedColorIdx);
          if (data.boardGrid) setBoardGrid(data.boardGrid);
          if (data.taskColorMode) setTaskColorMode(data.taskColorMode);
          if (typeof data.taskHighColorIdx === "number") setTaskHighColorIdx(data.taskHighColorIdx);
          if (typeof data.taskMedColorIdx === "number") setTaskMedColorIdx(data.taskMedColorIdx);
          if (typeof data.taskLowColorIdx === "number") setTaskLowColorIdx(data.taskLowColorIdx);
          if (typeof data.taskSingleColorIdx === "number") setTaskSingleColorIdx(data.taskSingleColorIdx);
        }
      }
    } catch {}
    setIsHydrated(true);
  }, [isSignedIn]);

  // Reveal page only after Clerk auth + localStorage have resolved (prevents signed-out flash)
  useEffect(() => {
    if (isHydrated) {
      document.documentElement.style.visibility = "";
    }
  }, [isHydrated]);

  // Safety fallback: if Clerk fails to initialize (e.g. domain not whitelisted), never leave page blank
  useEffect(() => {
    const t = setTimeout(() => { document.documentElement.style.visibility = ""; }, 4000);
    return () => clearTimeout(t);
  }, []);


  // ── Cloud sync helpers ──────────────────────────────────────────────────────


  function exportToIcs() {
    const dueTasks = notes.filter(n => n.dueDate && !n.completed);
    if (!dueTasks.length) return;

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Boardtivity//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const n of dueTasks) {
      // dueDate is "YYYY-MM-DD" — convert to YYYYMMDD for all-day event
      const d = n.dueDate!.replace(/-/g, "");
      // DTEND is the day after for all-day events in iCal
      const endDate = new Date(n.dueDate!);
      endDate.setDate(endDate.getDate() + 1);
      const dEnd = endDate.toISOString().slice(0, 10).replace(/-/g, "");
      const uid = `task-${n.id}-${n.boardId}@boardtivity.com`;
      const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
      const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART;VALUE=DATE:${d}`);
      lines.push(`DTEND;VALUE=DATE:${dEnd}`);
      lines.push(`SUMMARY:${esc(n.title)}`);
      if (n.body) lines.push(`DESCRIPTION:${esc(n.body)}`);
      if (n.importance && n.importance !== "none") {
        const prio = n.importance === "High" ? 1 : n.importance === "Medium" ? 5 : 9;
        lines.push(`PRIORITY:${prio}`);
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url  = URL.createObjectURL(blob);

    // iOS Safari doesn't support the download attribute — open in new tab
    // which triggers the native "Add to Calendar" / "Open in Calendar" prompt
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.open(url, "_blank");
      // Revoke after a short delay so the new tab can read the blob
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } else {
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "boardtivity-tasks.ics";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function currentBoardState() {
    return JSON.stringify({
      boards, notes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid,
      taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx,
      taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom,
      // Persist tombstones so the server merge can union them — deletions survive
      // stale saves from other devices even across page reloads.
      deletedNoteIds: [...localDeletedNoteIdsRef.current],
      deletedBoardIds: [...localDeletedBoardIdsRef.current],
    });
  }

  async function pushToCloud() {
    // Single-in-flight guard: if a save is already running, mark dirty so we
    // re-push the latest state immediately after it completes. This prevents a
    // stale in-flight save (e.g. captured before a deletion) from racing a newer one.
    if (saveInFlightRef.current) {
      saveDirtyRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    saveDirtyRef.current = false;

    // Read from ref so stale closures (e.g. pagehide flush) still save the latest state
    const stateToSave = latestBoardStateRef.current || currentBoardState();
    lastSavedStateRef.current = stateToSave;
    setCloudSyncState("saving");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const id = savedBoardIdRef.current as import("convex/values").GenericId<"userBoards"> | undefined;
        const newId = await saveBoard({ boardState: stateToSave, id });
        if (newId && !savedBoardIdRef.current) savedBoardIdRef.current = newId as string;
        // Stamp localStorage with the time we last successfully pushed so the
        // sync effect can compare local vs cloud freshness on next page load.
        try {
          const raw = localStorage.getItem("boardtivity");
          const existing = raw ? JSON.parse(raw) : {};
          localStorage.setItem("boardtivity", JSON.stringify({ ...existing, savedAt: Date.now() }));
        } catch {}
        setCloudSyncState("synced");
        break;
      } catch (e) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, attempt)));
        } else {
          console.error("[Boardtivity] Convex save failed after retries:", e);
          setCloudSyncState("error");
        }
      }
    }

    saveInFlightRef.current = false;
    // If state changed while we were saving (e.g. user made another edit or
    // deleted something), push the latest state now.
    if (saveDirtyRef.current) {
      saveDirtyRef.current = false;
      pushToCloud();
    }
  }

  // ── Sync with Convex — Convex is the sole source of truth for board data ──────
  useEffect(() => {
    if (!isSignedIn || savedBoard === undefined) return;
    convexReadyRef.current = true;

    if (!savedBoard) {
      // No Convex document yet. Push whatever is in local state so localStorage-only
      // users get migrated to Convex on first load.
      const localHasRealData = notes.length > 0 || boards.some(b => b.id !== "my-board" && b.id !== "my-thoughts");
      if (localHasRealData) pushToCloud();
      else setCloudSyncState("synced");
      return;
    }

    savedBoardIdRef.current = savedBoard._id as string;

    // Skip if we've already applied this exact snapshot.
    if (savedBoard.updatedAt <= lastAppliedCloudAtRef.current) {
      setCloudSyncState("synced");
      return;
    }

    // Skip if this is our own save reflected back by the subscription.
    if (savedBoard.boardState === lastSavedStateRef.current) {
      lastAppliedCloudAtRef.current = savedBoard.updatedAt;
      setCloudSyncState("synced");
      return;
    }

    // Cloud has real data — always apply it. Cloud is the sole source of truth.
    // NOTE: We no longer skip "empty" cloud states. An empty cloud state can mean
    // the user intentionally deleted everything on another device. Pushing stale
    // local data back in that case would undo the deletion.
    lastAppliedCloudAtRef.current = savedBoard.updatedAt;
    // Default: suppress push-back. Overridden below if pending local deletions need re-asserting.
    justAppliedCloudRef.current = true;
    // Cancel any pending debounced save so a stale timer can't fire and push
    // old settings (e.g. stale colors) over the cloud state we're about to apply.
    if (convexSaveTimerRef.current) {
      clearTimeout(convexSaveTimerRef.current);
      convexSaveTimerRef.current = null;
    }
    // Stamp localStorage savedAt with the cloud timestamp so that if this tab
    // immediately refreshes, the sync logic sees local == cloud and doesn't push stale data.
    try {
      const raw = localStorage.getItem("boardtivity");
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem("boardtivity", JSON.stringify({ ...existing, savedAt: savedBoard.updatedAt }));
    } catch {}
    try {
      const data = JSON.parse(savedBoard.boardState) as {
        boards?: Board[]; notes?: Note[]; activeBoardId?: string;
        drafts?: Draft[]; thoughtColorMode?: "random" | "fixed";
        thoughtFixedColorIdx?: number; boardGrid?: "grid" | "dots" | "blank";
        taskColorMode?: "priority" | "single"; taskHighColorIdx?: number;
        taskMedColorIdx?: number; taskLowColorIdx?: number; taskSingleColorIdx?: number;
        taskSingleCustom?: string; taskHighCustom?: string; taskMedCustom?: string; taskLowCustom?: string;
        deletedNoteIds?: number[]; deletedBoardIds?: string[];
      };
      // ── Merge deletion tombstones from cloud ─────────────────────────────────
      // The server already performs a union merge on deletedNoteIds/deletedBoardIds,
      // so the cloud snapshot always contains the superset of all deletions ever made
      // on any device. We absorb those into our local refs so that future saves
      // carry the full deletion history even if this device didn't originate them.
      // We also check whether WE have local deletions the cloud hasn't confirmed yet
      // (i.e., our last push is still in-flight or hasn't been picked up). If so,
      // we allow a re-push so the server can merge them in.
      const cloudDeletedNoteIds = new Set<number>(data.deletedNoteIds ?? []);
      const cloudDeletedBoardIds = new Set<string>(data.deletedBoardIds ?? []);
      const hadPendingNoteDeletes = [...localDeletedNoteIdsRef.current].some(id => !cloudDeletedNoteIds.has(id));
      const hadPendingBoardDeletes = [...localDeletedBoardIdsRef.current].some(id => !cloudDeletedBoardIds.has(id));
      // Absorb cloud deletions into local refs.
      for (const id of cloudDeletedNoteIds) localDeletedNoteIdsRef.current.add(id);
      for (const id of cloudDeletedBoardIds) localDeletedBoardIdsRef.current.add(id);

      if (Array.isArray(data.boards) && data.boards.length > 0) {
        // Server already filtered deleted boards from the notes array; filter
        // client-side too as a belt-and-suspenders guard against races.
        const filteredBoards = data.boards.filter(b => !localDeletedBoardIdsRef.current.has(b.id));
        if (filteredBoards.length > 0) setBoards(filteredBoards);
      }
      if (Array.isArray(data.notes)) {
        // Server already filtered deleted notes; filter client-side for safety.
        const cloudNotes = data.notes.filter(n =>
          !localDeletedNoteIdsRef.current.has(n.id) &&
          !localDeletedBoardIdsRef.current.has(n.boardId)
        );
        // Merge focus-tracking fields: never let a cloud sync reduce time already
        // logged locally. Last-write-wins on the blob would otherwise clobber
        // totalTimeSpent when a save from another session (e.g. desktop) arrives.
        setNotes(prev => cloudNotes.map(cloudNote => {
          const local = prev.find(n => n.id === cloudNote.id);
          return {
            ...cloudNote,
            totalTimeSpent: Math.max(cloudNote.totalTimeSpent ?? 0, local?.totalTimeSpent ?? 0) || undefined,
            attemptCount: Math.max(cloudNote.attemptCount ?? 0, local?.attemptCount ?? 0) || undefined,
            lastTackledAt: Math.max(cloudNote.lastTackledAt ?? 0, local?.lastTackledAt ?? 0) || undefined,
          };
        }));
      }
      if (data.activeBoardId) setActiveBoardId(data.activeBoardId);
      if (Array.isArray(data.drafts)) setDrafts(data.drafts);
      if (data.thoughtColorMode) setThoughtColorMode(data.thoughtColorMode);
      if (typeof data.thoughtFixedColorIdx === "number") setThoughtFixedColorIdx(data.thoughtFixedColorIdx);
      if (data.boardGrid) setBoardGrid(data.boardGrid);
      if (data.taskColorMode) setTaskColorMode(data.taskColorMode);
      if (typeof data.taskHighColorIdx === "number") setTaskHighColorIdx(data.taskHighColorIdx);
      if (typeof data.taskMedColorIdx === "number") setTaskMedColorIdx(data.taskMedColorIdx);
      if (typeof data.taskLowColorIdx === "number") setTaskLowColorIdx(data.taskLowColorIdx);
      if (typeof data.taskSingleColorIdx === "number") setTaskSingleColorIdx(data.taskSingleColorIdx);
      if (typeof data.taskSingleCustom === "string") setTaskSingleCustom(data.taskSingleCustom);
      if (typeof data.taskHighCustom   === "string") setTaskHighCustom(data.taskHighCustom);
      if (typeof data.taskMedCustom    === "string") setTaskMedCustom(data.taskMedCustom);
      if (typeof data.taskLowCustom    === "string") setTaskLowCustom(data.taskLowCustom);

      // If local had deletions the cloud hasn't merged yet, allow one more push.
      // Unlike the old "hasPendingDeletions" check, this is precise: it only
      // fires when our local refs have IDs that aren't in the server's snapshot,
      // meaning our deletion save is still in-flight. One push is all it takes —
      // the server merge guarantees the deletion is permanent after that.
      if (hadPendingNoteDeletes || hadPendingBoardDeletes) {
        justAppliedCloudRef.current = false;
      }
      setCloudSyncState("synced");
    } catch { setCloudSyncState("error"); }
  }, [isSignedIn, savedBoard]);

  // ── Persist to localStorage (instant reload cache) + debounced Convex save ───
  useEffect(() => {
    if (!isHydrated) return;

    if (isSignedIn) {
      // Always keep the latest board state in a ref so pushToCloud() (even stale closures)
      // can read the freshest data. This fixes the pagehide/visibilitychange flush saving stale state.
      const freshState = currentBoardState();
      latestBoardStateRef.current = freshState;

      // Save full state to localStorage as a fast-load cache for same-browser visits.
      // Preserve the existing savedAt — it must only be stamped when we actually push to
      // Convex (see pushToCloud). Overwriting it here would make the sync logic think a
      // freshly-opened stale tab is newer than a recent save from another device.
      try {
        const existing = (() => { try { const r = localStorage.getItem("boardtivity"); return r ? JSON.parse(r) : {}; } catch { return {}; } })();
        localStorage.setItem("boardtivity", JSON.stringify({ ...existing, theme, boardTheme, boards, notes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom }));
      } catch {}

      if (!convexReadyRef.current) return;

      if (justAppliedCloudRef.current) {
        // State changed because we applied cloud data — don't push it back.
        justAppliedCloudRef.current = false;
        return;
      }

      // User made a change — debounce-save to Convex.
      // When pending tombstones exist, the sync effect sets justAppliedCloudRef = false
      // and calls setNotes(), which re-triggers this effect with a fresh 300ms timer.
      // That re-schedule is sufficient to re-assert deletions without immediate-push
      // ping-pong between devices.
      if (convexSaveTimerRef.current) clearTimeout(convexSaveTimerRef.current);
      convexSaveTimerRef.current = setTimeout(() => { pushToCloud(); }, 300);
    } else {
      try { localStorage.setItem("boardtivity", JSON.stringify({ theme, boardTheme })); } catch {}
    }
  }, [isHydrated, isSignedIn, theme, boardTheme, boards, notes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom]);

  // ── Flush any pending debounced save when tab hides or closes ────────────────
  useEffect(() => {
    function flush() {
      if (!convexReadyRef.current || !isSignedIn) return;
      if (!convexSaveTimerRef.current) return; // nothing pending
      clearTimeout(convexSaveTimerRef.current);
      convexSaveTimerRef.current = null;
      pushToCloud();
    }
    function onVisibility() { if (document.visibilityState === "hidden") flush(); }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onVisibility); };
  }, [isSignedIn]);

  // ── Error fallback if Convex never connects ──────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;
    const timer = setTimeout(() => {
      setCloudSyncState((s) => (s === "loading" ? "error" : s));
    }, 15000);
    return () => clearTimeout(timer);
  }, [isSignedIn]);

  const didJustSignInRef = useRef(false);

  // Sync theme attributes to document root so CSS data-theme rules apply reactively
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.backgroundColor = pageBg(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-board-theme", boardTheme);
  }, [boardTheme]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!boardsOpen && !settingsOpen && !userMenuOpen) return;
      if (boardMenuRef.current?.contains(target)) return;
      if (boardButtonRef.current?.contains(target)) return;
      if (settingsRef.current?.contains(target)) return;
      if (settingsButtonRef.current?.contains(target)) return;
      if (userMenuRef.current?.contains(target)) return;
      setBoardsOpen(false);
      setSettingsOpen(false);
      setUserMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [boardsOpen, settingsOpen, userMenuOpen]);

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

  useEffect(() => { focusNoteIdRef.current = focusNoteId; }, [focusNoteId]);
  useEffect(() => { focusStepIdRef.current = focusStepId; }, [focusStepId]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  // Warn on refresh/close while in focus mode
  useEffect(() => {
    if (!focusOpen) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You're in a focus session — refreshing will reset your timer.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [focusOpen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      boardContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Wall-clock timer: tick every second, compute remaining from start time
  useEffect(() => {
    if (!focusOpen || focusCompleted || focusPaused) return;
    // If startedAt not yet set (e.g. resume from pause), stamp now
    if (!focusStartedAtRef.current) focusStartedAtRef.current = Date.now();

    function tick() {
      const elapsed = (Date.now() - focusStartedAtRef.current) / 1000;
      const remaining = Math.max(0, focusTotalSecsRef.current - elapsed);
      setFocusSecondsLeft(Math.round(remaining));
      if (remaining <= 0) {
        const nId = focusNoteIdRef.current;
        const sId = focusStepIdRef.current;
        if (sId && nId) {
          setNotes((ns) => ns.map((n) =>
            n.id === nId
              ? { ...n, steps: n.steps.map((s) => s.id === sId ? { ...s, done: true } : s) }
              : n
          ));
        } else if (nId) {
          setNotes((ns) => ns.map((n) => n.id === nId ? { ...n, completed: true, steps: n.steps.map((s) => ({ ...s, done: true })) } : n));
        }
        setFocusCompleted(true);
        clearInterval(id);
      }
    }
    tick(); // immediate first tick so display is right away correct
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [focusOpen, focusCompleted, focusPaused]);

  // Recalculate remaining when app comes back to foreground (phone unlock / tab switch)
  useEffect(() => {
    if (!focusOpen || focusCompleted || focusPaused) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const elapsed = (Date.now() - focusStartedAtRef.current) / 1000;
      const remaining = Math.max(0, focusTotalSecsRef.current - elapsed);
      setFocusSecondsLeft(Math.round(remaining));
      if (remaining <= 0) {
        const nId = focusNoteIdRef.current;
        const sId = focusStepIdRef.current;
        if (sId && nId) {
          setNotes((ns) => ns.map((n) =>
            n.id === nId
              ? { ...n, steps: n.steps.map((s) => s.id === sId ? { ...s, done: true } : s) }
              : n
          ));
        } else if (nId) {
          setNotes((ns) => ns.map((n) => n.id === nId ? { ...n, completed: true, steps: n.steps.map((s) => ({ ...s, done: true })) } : n));
        }
        setFocusCompleted(true);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [focusOpen, focusCompleted, focusPaused]);

  useEffect(() => {
    if (!focusPaused) return;
    const id = window.setInterval(() => {
      setBreakSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setFocusPaused(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [focusPaused]);

  useEffect(() => {
    if (!focusCompleted) return;
    const note = notesRef.current.find(n => n.id === focusNoteIdRef.current);
    const next = focusChainMode ? (note?.steps.find(s => !s.done) ?? null) : null;
    setFocusNextStep(next ? { id: next.id, title: next.title, minutes: next.minutes ?? 25 } : null);
    // All subtasks done in chain mode — mark the parent task complete
    if (!next && focusChainMode && note) {
      setNotes(ns => ns.map(n => n.id === note.id ? { ...n, completed: true, steps: n.steps.map(s => ({ ...s, done: true })) } : n));
    }
  }, [focusCompleted, focusChainMode]);

  // Lock body scroll when focus overlay is open on mobile
  useEffect(() => {
    if (!focusOpen || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [focusOpen, isMobile]);

  function advanceToNext() {
    const next = focusNextStep;
    setFocusCompleted(false);
    setFocusNextStep(null);
    if (next) {
      const nextSecs = (next.minutes ?? 25) * 60;
      focusTotalSecsRef.current = nextSecs;
      focusStartedAtRef.current = Date.now();
      setFocusStepId(next.id);
      focusStepIdRef.current = next.id;
      setFocusSecondsLeft(nextSecs);
    } else {
      setFocusOpen(false);
      setFocusNoteId(null);
      setFocusStepId(null);
      setFocusChainMode(false);
    }
  }

  function addBoard(type: BoardType) {
    const existingOfType = boards.filter((b) => b.type === type);
    const boardLimit = isPlus ? (type === "task" ? 10 : 5) : 1;
    if (existingOfType.length >= boardLimit) {
      if (isPlus) {
        setLimitReachedOpen(true);
      } else {
        setUpgradeOpen(true);
      }
      setBoardsOpen(false);
      return;
    }
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
    const board = boards.find((b) => b.id === boardId);
    if (!board) return;
    const sameType = boards.filter((b) => b.type === board.type);

    if (sameType.length <= 1) {
      // Last board of this type — clear notes and reset name instead of deleting
      const defaultName = board.type === "task" ? "My Board" : "My Ideas";
      setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, name: defaultName } : b));
      // Track cleared notes as tombstones so a stale cloud sync can't restore them
      notes.filter((n) => n.boardId === boardId).forEach((n) => localDeletedNoteIdsRef.current.add(n.id));
      setNotes((prev) => prev.filter((n) => n.boardId !== boardId));
      setActiveBoardId(boardId);
    } else {
      localDeletedBoardIdsRef.current.add(boardId);
      const remaining = boards.filter((b) => b.id !== boardId);
      setBoards(remaining);
      setNotes((prev) => prev.filter((n) => n.boardId !== boardId));
      if (activeBoardId === boardId) {
        setActiveBoardId(remaining.find((b) => b.type === board.type)?.id ?? remaining[0].id);
      }
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
    if (noteDragRef.current || stepDragRef.current) return;

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

        if (drag.noteType === "thought") {
          const cx = nextX + NOTE_W / 2;
          const cy = nextY + NOTE_H / 2;
          const target = notes.find(
            (n) => n.id !== drag.noteId && n.type === "thought" && n.boardId === drag.boardId &&
              cx >= n.x - 24 && cx <= n.x + NOTE_W + 24 && cy >= n.y - 24 && cy <= n.y + NOTE_H + 24
          );
          const targetId = target?.id ?? null;

          if (targetId === null) {
            // Moved away — clear both states and cancel timer
            if (thoughtDropTargetRef.current !== null) { thoughtDropTargetRef.current = null; setThoughtDropTarget(null); }
            if (thoughtUnlinkTargetRef.current !== null) {
              if (thoughtHoverTimerRef.current) { clearTimeout(thoughtHoverTimerRef.current); thoughtHoverTimerRef.current = null; }
              thoughtUnlinkTargetRef.current = null;
              setThoughtUnlinkTarget(null);
            }
          } else {
            const draggedNote = notes.find(n => n.id === drag.noteId);
            const targetNote = notes.find(n => n.id === targetId);
            const isLinked =
              (draggedNote?.linkedNoteIds.includes(targetId) ?? false) ||
              (targetNote?.linkedNoteIds.includes(drag.noteId) ?? false);

            if (isLinked) {
              // Over a LINKED thought — show red glow and start unlink timer
              if (thoughtDropTargetRef.current !== null) { thoughtDropTargetRef.current = null; setThoughtDropTarget(null); }
              if (thoughtUnlinkTargetRef.current !== targetId) {
                if (thoughtHoverTimerRef.current) { clearTimeout(thoughtHoverTimerRef.current); thoughtHoverTimerRef.current = null; }
                thoughtUnlinkTargetRef.current = targetId;
                setThoughtUnlinkTarget(targetId);
                thoughtHoverTimerRef.current = setTimeout(() => {
                  unlinkNotes(drag.noteId, targetId);
                  thoughtUnlinkTargetRef.current = null;
                  setThoughtUnlinkTarget(null);
                  thoughtHoverTimerRef.current = null;
                }, 650);
              }
            } else {
              // Over an UNLINKED thought — show blue glow, link on drop
              if (thoughtUnlinkTargetRef.current !== null) {
                if (thoughtHoverTimerRef.current) { clearTimeout(thoughtHoverTimerRef.current); thoughtHoverTimerRef.current = null; }
                thoughtUnlinkTargetRef.current = null;
                setThoughtUnlinkTarget(null);
              }
              if (thoughtDropTargetRef.current !== targetId) { thoughtDropTargetRef.current = targetId; setThoughtDropTarget(targetId); }
            }
          }
        } else if (thoughtDropTargetRef.current !== null || thoughtUnlinkTargetRef.current !== null) {
          if (thoughtHoverTimerRef.current) { clearTimeout(thoughtHoverTimerRef.current); thoughtHoverTimerRef.current = null; }
          thoughtDropTargetRef.current = null; setThoughtDropTarget(null);
          thoughtUnlinkTargetRef.current = null; setThoughtUnlinkTarget(null);
        }
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

    if (noteDragRef.current || stepDragRef.current) return;
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
      thoughtDropTargetRef.current = null;
      setThoughtDropTarget(null);
      if (thoughtHoverTimerRef.current) { clearTimeout(thoughtHoverTimerRef.current); thoughtHoverTimerRef.current = null; }
      thoughtUnlinkTargetRef.current = null;
      setThoughtUnlinkTarget(null);
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
    const boardNotes = notes.filter(n => n.boardId === activeBoardId);
    const { x: noteX, y: noteY } = findFreeSpot(boardNotes, centerX - NOTE_W / 2, centerY - NOTE_H / 2);
    const laidOutSteps = rawSteps.length > 0 ? layoutWeb(noteX, noteY, rawSteps) : [];

    const note: Note = {
      id: genId(),
      boardId: activeBoardId,
      type: activeBoard.type,
      title: title.trim(),
      body: body.trim(),
      dueDate: thoughtMode ? undefined : dueDate,
      dueTime: (!thoughtMode && dueTime) ? dueTime : undefined,
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
      colorIdx: composerColorIdx !== undefined ? composerColorIdx : (thoughtColorMode === "random" ? Math.floor(Math.random() * NOTE_PALETTE.length) : thoughtFixedColorIdx),
    };

    setNotes((prev) => [...prev, note]);
    if (note.type === "task") {
      scheduleDueDateReminder(note.id, note.title, note.dueDate, note.dueTime);
    }
    resetComposer();
    setComposerOpen(false);
  }

  function hasComposerContent() {
    return title.trim() !== "" || body.trim() !== "" || dueDate !== "" || importance !== "none" || aiSteps.length > 0;
  }

  function resetComposer() {
    setTitle("");
    setBody("");
    setDueDate("");
    setDueTime("");
    setMinutes(30);
    setImportance("none");
    setAiSteps([]);
    setBreakdownVariant(0);
    setComposerError({});
  }

  function closeComposer() {
    if (hasComposerContent()) {
      setDraftPromptOpen(true);
    } else {
      resetComposer();
      setComposerOpen(false);
    }
  }

  function saveDraft() {
    const draft: Draft = {
      id: genId(),
      title: title.trim(),
      body: body.trim(),
      dueDate,
      dueTime,
      minutes,
      importance,
      aiSteps,
      boardId: activeBoardId,
      boardType: activeBoard.type,
      boardName: activeBoard.name,
      savedAt: new Date().toISOString(),
    };
    setDrafts((prev) => [draft, ...prev].slice(0, 10));
    setDraftPromptOpen(false);
    resetComposer();
    setComposerOpen(false);
  }

  function loadDraft(draft: Draft) {
    setTitle(draft.title);
    setBody(draft.body);
    setDueDate(draft.dueDate);
    setDueTime(draft.dueTime ?? "");
    setMinutes(draft.minutes);
    setImportance(draft.importance);
    setAiSteps(draft.aiSteps);
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
  }

  function deleteDraft(draftId: number) {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
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

  function unlinkNotes(noteIdA: number, noteIdB: number) {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === noteIdA && n.linkedNoteIds.includes(noteIdB))
          return { ...n, linkedNoteIds: n.linkedNoteIds.filter((id) => id !== noteIdB) };
        if (n.id === noteIdB && n.linkedNoteIds.includes(noteIdA))
          return { ...n, linkedNoteIds: n.linkedNoteIds.filter((id) => id !== noteIdA) };
        return n;
      })
    );
  }


  function deleteTask(noteId: number) {
    localDeletedNoteIdsRef.current.add(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId).map((n) => ({ ...n, linkedNoteIds: n.linkedNoteIds.filter((id) => id !== noteId) })));
    cancelReminderMut({ noteId }).catch(() => {});
    setDetailNoteId(null);
  }

  function handleBobSweep(positions: { id: number; x: number; y: number }[]) {
    setNotes(prev => prev.map(n => {
      const pos = positions.find(p => p.id === n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    }));
    // Don't reset the viewport — leave the user where they are.
  }

  function handleBobEditNote(id: number, fields: Partial<Note>) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...fields } : n));
  }

  function handleBobDeleteNotes(ids: number[]) {
    const idSet = new Set(ids);
    for (const id of ids) localDeletedNoteIdsRef.current.add(id);
    setNotes(prev => prev.filter(n => !idSet.has(n.id)).map(n => ({
      ...n,
      linkedNoteIds: n.linkedNoteIds.filter(id => !idSet.has(id)),
    })));
  }

  function handleBobHighlightNotes(ids: number[]) {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedNoteIds(new Set(ids));
    highlightTimerRef.current = setTimeout(() => setHighlightedNoteIds(new Set()), 4000);
  }

  function handleBobLaunchFocus(noteId: number, chain = false) {
    startFocus(noteId, chain);
  }

  function handleBobSaveUndo() {
    setUndoSnapshot([...notes]);
  }

  function handleBobUndo() {
    if (undoSnapshot) { setNotes(undoSnapshot); setUndoSnapshot(null); }
  }

  function handleBobSetIdeaColor(ids: number[], colorIdx: number | undefined) {
    setNotes(prev => prev.map(n =>
      ids.includes(n.id) && n.type === "thought" ? { ...n, colorIdx } : n
    ));
  }

  function handleBobConfigureTaskColors(patch: Partial<BobSettings>) {
    if (patch.taskColorMode !== undefined) setTaskColorMode(patch.taskColorMode);
    if (typeof patch.taskHighColorIdx   === "number") setTaskHighColorIdx(patch.taskHighColorIdx);
    if (typeof patch.taskMedColorIdx    === "number") setTaskMedColorIdx(patch.taskMedColorIdx);
    if (typeof patch.taskLowColorIdx    === "number") setTaskLowColorIdx(patch.taskLowColorIdx);
    if (typeof patch.taskSingleColorIdx === "number") setTaskSingleColorIdx(patch.taskSingleColorIdx);
  }

  const IDEA_COLOR_NAMES_HOMESHELL = ["sky-blue","peach","sage","lavender","butter","teal","rose","periwinkle"] as const;
  function handleBobConfigureBoard(patch: { boardTheme?: string; boardGrid?: string; defaultIdeaColor?: string }) {
    if (patch.boardTheme === "light" || patch.boardTheme === "dark") setBoardTheme(patch.boardTheme);
    if (patch.boardGrid === "grid" || patch.boardGrid === "dots" || patch.boardGrid === "blank") setBoardGrid(patch.boardGrid);
    if (typeof patch.defaultIdeaColor === "string") {
      if (patch.defaultIdeaColor === "none") {
        setThoughtColorMode("random");
      } else {
        const idx = (IDEA_COLOR_NAMES_HOMESHELL as readonly string[]).indexOf(patch.defaultIdeaColor);
        if (idx !== -1) {
          setThoughtColorMode("fixed");
          setThoughtFixedColorIdx(idx);
        }
      }
    }
  }

  function handleBobAddNote(note: BobNewNote) {
    const id = genId();
    const now = new Date().toISOString();
    const viewport = viewportRef.current;

    // Viewport center in board coordinates — always the anchor point so notes
    // land where the user is currently looking.
    const vpCx = viewport ? (viewport.clientWidth  / 2 - pan.x) / scale - NOTE_W / 2 : BOARD_W / 2;
    const vpCy = viewport ? (viewport.clientHeight / 2 - pan.y) / scale - NOTE_H / 2 : BOARD_H / 2;

    // Visible board rect so we can clamp the final position onto the screen.
    const visMinX = viewport ? Math.max(40,               (        -pan.x) / scale)            : 40;
    const visMinY = viewport ? Math.max(60,               (        -pan.y) / scale)            : 60;
    const visMaxX = viewport ? Math.min(BOARD_W-NOTE_W-40, (viewport.clientWidth  - pan.x) / scale - NOTE_W) : BOARD_W - NOTE_W - 40;
    const visMaxY = viewport ? Math.min(BOARD_H-NOTE_H-40, (viewport.clientHeight - pan.y) / scale - NOTE_H) : BOARD_H - NOTE_H - 40;

    // Use functional setNotes so each BOB note sees the previously added notes
    // (prevents overlap when BOB creates multiple notes in one request).
    // Pass visible bounds into findFreeSpot so the spiral is constrained to the
    // visible area — no separate clamp needed, note always lands on screen.
    setNotes(prev => {
      const boardNotes = prev.filter(n => n.boardId === activeBoardId);
      const { x, y } = findFreeSpot(boardNotes, vpCx, vpCy, visMinX, visMaxX, visMinY, visMaxY);
      const newNote: Note = {
        id,
        boardId: activeBoardId,
        type: note.type === "task" ? "task" : "thought",
        title: note.title,
        body: note.body ?? "",
        importance: note.importance ?? "none",
        dueDate: note.dueDate,
        createdAt: now,
        completed: false,
        x, y,
        steps: (note.steps ?? []).map((s, i) => ({ id: id + i + 1, title: s.title, minutes: s.minutes, done: false, x: 0, y: 0 })),
        showFlow: false,
        flowMode: "web",
        linkedNoteIds: [],
        colorIdx: note.type === "thought"
          ? (thoughtColorMode === "fixed" ? thoughtFixedColorIdx : Math.floor(Math.random() * NOTE_PALETTE.length))
          : undefined,
      };
      return [...prev, newNote];
    });
  }

  function startFocus(noteId: number, chain = false) {
    // Show duration picker first — actual timer starts after user commits
    setFocusPicker({ noteId, chain });
  }

  function commitFocus(noteId: number, chain: boolean, minutes: number) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    let stepId: number | undefined;
    if (chain && note.steps.length > 0) {
      const first = note.steps.find(s => !s.done);
      if (first) stepId = first.id;
    }
    const totalSecs = minutes * 60;
    focusTotalSecsRef.current = totalSecs;
    focusStartedAtRef.current = Date.now();
    focusSessionStartRef.current = Date.now();
    setFocusNoteId(noteId);
    setFocusStepId(stepId ?? null);
    setFocusChainMode(chain);
    setFocusSecondsLeft(totalSecs);
    setFocusCompleted(false);
    setFocusPaused(false);
    setFocusExitConfirm(false);
    setFocusNextStep(null);
    setFocusPicker(null);
    // Track attempt on the note
    setNotes(prev => prev.map(n => n.id === noteId ? {
      ...n,
      attemptCount: (n.attemptCount ?? 0) + 1,
      lastTackledAt: Date.now(),
    } : n));
    setFocusOpen(true);
  }

  function closeFocusWithReview(noteId: number) {
    const elapsedMin = Math.floor((Date.now() - focusSessionStartRef.current) / 60000);
    setFocusReview({ elapsedMin, noteId, stepId: focusStepId });
    setFocusOpen(false);
    setFocusCompleted(false);
    setFocusPaused(false);
    setFocusExitConfirm(false);
    setBreakSecondsLeft(0);
    setFocusNextStep(null);
    setFocusStepId(null);
  }

  async function handleFocusReviewDone(markFinished: boolean) {
    if (!focusReview) return;
    const { elapsedMin, noteId, stepId } = focusReview;
    const _d = new Date();
    const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,"0")}-${String(_d.getDate()).padStart(2,"0")}`;
    // Compute updated notes immediately so we can push to cloud right away
    const updatedNotes = notes.map(n => {
      if (n.id !== noteId) return n;
      let updatedSteps = n.steps;
      if (markFinished && stepId) {
        // Mark the focused subtask done
        updatedSteps = n.steps.map(s => s.id === stepId ? { ...s, done: true } : s);
      }
      const allStepsDone = updatedSteps.length > 0 && updatedSteps.every(s => s.done);
      return {
        ...n,
        steps: updatedSteps,
        totalTimeSpent: (n.totalTimeSpent ?? 0) + elapsedMin,
        lastTackledAt: Date.now(),
        // Mark parent complete if: no subtasks + markFinished, OR all subtasks now done
        completed: markFinished && (!stepId || allStepsDone) ? true : n.completed,
      };
    });
    setNotes(updatedNotes);
    if (isSignedIn) {
      const freshState = JSON.stringify({ boards, notes: updatedNotes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom });
      latestBoardStateRef.current = freshState;
      pushToCloud();
    }
    // Log focus session to Convex (skip if less than 1 minute)
    if (isSignedIn && elapsedMin > 0) {
      await logFocusSession({ date: today, minutes: elapsedMin, taskCompleted: markFinished });
    }
    setFocusReview(null);
    setFocusNoteId(null);
  }


  function scheduleDueDateReminder(noteId: number, noteTitle: string, dueDate: string | undefined, dueTimeVal: string | undefined) {
    if (!isSignedIn || !dueDate || !dueTimeVal) {
      cancelReminderMut({ noteId }).catch(() => {});
      return;
    }
    const dueDatetime = new Date(`${dueDate}T${dueTimeVal}:00`).getTime();
    const remindAt = dueDatetime - 60 * 60 * 1000; // 1 hour before
    const delayMs = remindAt - Date.now();
    if (delayMs <= 0) return;
    setReminderMut({ noteId, noteTitle, delayMs }).catch(() => {});
  }


  return {
    theme, setTheme, boardTheme, setBoardTheme, boards, setBoards, activeBoardId, setActiveBoardId,
    boardsOpen, setBoardsOpen, notes, setNotes, highlightedNoteIds, setDetailNoteId, detailEditing, setDetailEditing,
    detailEditTitle, setDetailEditTitle, detailEditBody, setDetailEditBody, detailEditDueDate, setDetailEditDueDate, detailEditDueTime, setDetailEditDueTime,
    detailEditImportance, setDetailEditImportance, detailEditMinutes, setDetailEditMinutes, detailEditSteps, setDetailEditSteps, detailEditColorIdx, setDetailEditColorIdx,
    detailBreakdownVariant, setDetailBreakdownVariant, activeStep, setActiveStep, composerOpen, setComposerOpen, renameBoardId, setRenameBoardId,
    renameValue, setRenameValue, title, setTitle, body, setBody, dueDate, setDueDate,
    dueTime, setDueTime, minutes, setMinutes, importance, setImportance, aiSteps, setAiSteps,
    breakdownVariant, setBreakdownVariant, composerError, setComposerError, focusOpen, setFocusOpen, focusNoteId, setFocusNoteId,
    focusStepId, setFocusStepId, focusSecondsLeft, setFocusSecondsLeft, focusCompleted, setFocusCompleted, focusPaused, setFocusPaused,
    breakSecondsLeft, setBreakSecondsLeft, focusChainMode, setFocusChainMode, focusNextStep, focusExitConfirm, setFocusExitConfirm, focusPicker,
    setFocusPicker, focusReview, setFocusReview, profileOpen, setProfileOpen, upgradeOpen, setUpgradeOpen, limitReachedOpen,
    setLimitReachedOpen, showSubscribedModal, setShowSubscribedModal, showUpdateModal, setShowUpdateModal, namePromptOpen, setNamePromptOpen, userMenuOpen,
    setUserMenuOpen, drafts, draftPromptOpen, setDraftPromptOpen, composerColorIdx, setComposerColorIdx, thoughtUnlinkTarget, setThoughtUnlinkTarget,
    heroRef, heroVisible, mobileExpandedIds, setMobileExpandedIds, mobileAddMode, setMobileAddMode, mobileAddTitle, setMobileAddTitle,
    mobileAddBody, setMobileAddBody, mobileAddImportance, setMobileAddImportance, mobileAddDueDate, setMobileAddDueDate, mobileAddDueTime, setMobileAddDueTime,
    mobileActionNoteId, setMobileActionNoteId, mobileEditTitle, setMobileEditTitle, mobileEditDueDate, setMobileEditDueDate, mobileEditDueTime, setMobileEditDueTime,
    mobileEditImportance, setMobileEditImportance, mobileEditMinutes, setMobileEditMinutes, mobileAddColorIdx, setMobileAddColorIdx, mobileEditColorIdx, setMobileEditColorIdx,
    mobileAddRemindIn, setMobileAddRemindIn, mobileEditSteps, setMobileEditSteps, mobileDeleteConfirm, setMobileDeleteConfirm, mobileBoardTypePicker, setMobileBoardTypePicker,
    mobileBoardActionId, setMobileBoardActionId, mobileBoardRename, setMobileBoardRename, mobileBoardRenaming, setMobileBoardRenaming, mobileFilterPriority, setMobileFilterPriority,
    mobileSortDate, setMobileSortDate, confirmSignOut, setConfirmSignOut, checkoutLoading, checkoutError, showSyncPill, titleMounted,
    settingsOpen, setSettingsOpen, bobAutoSend, setBobAutoSend, mobileSettingsOpen, setMobileSettingsOpen, confirmDeleteId, setConfirmDeleteId,
    isFullscreen, boardGrid, setBoardGrid, thoughtColorMode, setThoughtColorMode, thoughtFixedColorIdx, setThoughtFixedColorIdx, taskColorMode,
    setTaskColorMode, taskHighColorIdx, setTaskHighColorIdx, taskMedColorIdx, setTaskMedColorIdx, taskLowColorIdx, setTaskLowColorIdx, taskSingleColorIdx,
    setTaskSingleColorIdx, taskSingleCustom, setTaskSingleCustom, taskHighCustom, setTaskHighCustom, taskMedCustom, setTaskMedCustom, taskLowCustom,
    setTaskLowCustom, cloudSyncState, setCloudSyncState, thoughtDropTarget, setThoughtDropTarget, scale, pan, focusSessionStartRef,
    focusStartedAtRef, focusTotalSecsRef, focusPausedSecsRef, thoughtUnlinkTargetRef, thoughtHoverTimerRef, viewportRef, boardContainerRef, boardMenuRef,
    boardButtonRef, settingsButtonRef, userMenuRef, dateInputRef, feedbackRef, isMobile, subscription, isPlus,
    isAdmin, isNativeApp, localToday, focusStatsData, setReminderMut, emailPrefs, updateEmailPrefs, latestBoardStateRef,
    setBobUserInfoFn, bobUserInfo, colorWheelSingleRef, colorWheelHighRef, colorWheelMedRef, colorWheelLowRef, settingsRef, boardDragRef,
    noteDragRef, thoughtDropTargetRef, stepDragRef, draggedRef, activeBoard, activeNotes, taskPaletteEntry, getBg,
    getHalo, getNoteBorder, detailNote, stepModal, thoughtMode, boardStyle, fullscreenOverride, nativeAppOverride,
    taskBoards, thoughtBoards, recentTasks, startCheckout, startPortal, centerBoard, findFreeSpot, exportToIcs,
    pushToCloud, toggleFullscreen, advanceToNext, addBoard, deleteBoard, saveRename, onViewportPointerDown, onViewportPointerMove,
    onViewportPointerUp, createNote, resetComposer, closeComposer, saveDraft, loadDraft, deleteDraft, setFlowMode,
    toggleFlow, toggleThoughtLink, deleteTask, handleBobSweep, handleBobEditNote, handleBobDeleteNotes, handleBobHighlightNotes, handleBobLaunchFocus,
    handleBobSaveUndo, handleBobUndo, handleBobSetIdeaColor, handleBobConfigureTaskColors, handleBobConfigureBoard, handleBobAddNote, startFocus, commitFocus,
    closeFocusWithReview, handleFocusReviewDone, scheduleDueDateReminder, user, isSignedIn, clerkLoaded, openSignIn, openSignUp,
    signOut,
  };
}

export type HomeState = ReturnType<typeof useHomeState>;
