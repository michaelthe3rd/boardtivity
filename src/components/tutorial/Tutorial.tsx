"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ThemeMode } from "@/lib/board";
import { border, muted, pageText, panel } from "@/lib/ui";
import BoardtivityLogo from "@/components/BoardtivityLogo";
import { BobIcon } from "@/components/BobAgent";
import { useHome } from "@/components/home/HomeContext";

// ── Interactive tour ──────────────────────────────────────────────────────────
// Each step spotlights a real control (found by its data-tour="…" attribute), explains it,
// and either waits for Next or for the user to actually do the thing. Steps whose control
// isn't on screen (e.g. desktop-only buttons on a phone) are skipped automatically.
// While the tour is open, only the tour card and (on interactive steps) the highlighted
// control respond to clicks and keys, so stray input can't open panels behind the spotlight.

type Home = ReturnType<typeof useHome>;
type Layout = "phone" | "desktop" | "touch";

type Step = {
  id: string;
  target?: string; // data-tour id; omit for a centered card
  icon?: "logo" | "bob" | "done";
  title: string | ((l: Layout, h: Home) => string);
  body: (l: Layout, h: Home) => ReactNode;
  only?: Layout[];
  // "action": the step completes when `done` turns true (user clicked the highlighted control)
  advance?: "next" | "action" | ((l: Layout) => "next" | "action");
  // The highlighted control can be used on "action" steps and on steps marked interactive
  // (typing a name, picking a date). On every other step it's look-only.
  interactive?: boolean;
  done?: (h: Home) => boolean;
  enter?: (h: Home) => void; // tidy up before showing this step (e.g. close dialogs)
  awaitTarget?: boolean; // the control appears only after `enter` (e.g. it opens a panel): wait briefly instead of skipping
  reset?: (h: Home) => void; // undo this step's action when returning to it with Back, so it can be redone
};

const isComposing = (h: Home) => h.composerOpen || h.mobileAddMode !== null;
const isFocusing = (h: Home) => h.focusPicker !== null || h.focusOpen || h.focusReview !== null;
const taskWord = (h: Home) => (h.activeBoard?.type === "thought" ? "idea" : "task");
const verb = (l: Layout) => (l === "desktop" ? "Click" : "Tap");

// Panels a stray click or the focus-mode pause might have left open. Closed on every step.
function closeStrayPanels(h: Home) {
  if (h.settingsOpen) h.setSettingsOpen(false);
  if (h.mobileSettingsOpen) h.setMobileSettingsOpen(false);
  if (h.boardsOpen) h.setBoardsOpen(false);
  if (h.profileOpen) h.setProfileOpen(false);
  if (h.userMenuOpen) h.setUserMenuOpen(false);
  if (h.upgradeOpen) h.setUpgradeOpen(false);
  if (h.limitReachedOpen) h.setLimitReachedOpen(false);
  if (h.mobileBoardTypePicker) h.setMobileBoardTypePicker(false);
  if (h.draftPromptOpen) h.setDraftPromptOpen(false);
}

// Closes the tour's own dialogs without asking. (closeComposer() would pop the "save draft?"
// prompt, which belongs to the user's flow, not the tour's.)
function closeOpenPanels(h: Home) {
  if (h.composerOpen) { h.resetComposer(); h.setComposerOpen(false); }
  if (h.draftPromptOpen) h.setDraftPromptOpen(false);
  if (h.mobileAddMode !== null) h.setMobileAddMode(null);
  if (h.detailNoteId !== null) { h.setDetailNoteId(null); h.setDetailEditing(false); }
}

const openSettings = (h: Home) => { if (h.isMobile && !h.isNativeApp) h.setMobileSettingsOpen(true); else h.setSettingsOpen(true); };

// A look-only stop on one section of Settings.
function settingsStep(id: string, title: string, body: Step["body"], only?: Layout[]): Step {
  return { id, target: `settings-${id}`, title, body, only, awaitTarget: true, enter: openSettings };
}

// Opens Settings and spotlights the colors section, which only shows the current board type's colors.
function colorsStep(kind: "task" | "idea"): Step {
  return {
    id: "colors", target: "settings-colors", title: kind === "task" ? "Task colors" : "Idea colors", interactive: true, awaitTarget: true,
    enter: openSettings,
    body: () => kind === "task"
      ? <>Color tasks by priority, or give them all one color. Settings only shows colors for the board you&apos;re on, so switch to an idea board to change idea colors.</>
      : <>Pick a default color for new ideas, or shuffle for a random one each time. Settings only shows colors for the board you&apos;re on, so switch to a task board to change task colors.</>,
  };
}

// The Email section of Settings. Signed out, it's a short pitch with a Sign in button.
function emailStep(kind: "task" | "idea"): Step {
  return {
    id: "email", target: "settings-email", title: "Email summaries", awaitTarget: true,
    enter: openSettings,
    body: (_, h) => !h.isSignedIn
      ? <>Sign in to get a daily summary of what&apos;s due, a weekly plan on Sundays, and the reminders you set on {kind === "idea" ? "ideas" : "tasks"}.</>
      : <>A daily summary of what&apos;s due and a weekly plan on Sundays. Choose which ones you want and what time they arrive.</>,
  };
}

// Settings sections both tours point out.
const LOOK_STEP = settingsStep("look", "Make it yours", () => <>Switch between light and dark, and pick a grid, dots or a blank background for your board.</>, ["desktop", "touch"]);
const CALENDAR_STEP = settingsStep("calendar", "Add to your calendar", () => <>Export every task with a due date to Apple or Google Calendar in one go.</>);
const APP_STEP = settingsStep("app", "Get the app", () => <>Install Boardtivity on your phone or computer so it opens like any other app.</>);

// Toolbar and page features both tours point out.
const SYNC_STEP: Step = {
  id: "sync", target: "sync", title: "Saved everywhere",
  body: (_, h) => h.isSignedIn
    ? <>Your boards save to your account as you go. This shows when everything&apos;s synced, so you can pick up on any device.</>
    : <>Your boards are saved on this device. Sign in here to back them up and use them on any device.</>,
};
const FEEDBACK_STEP: Step = {
  id: "feedback", target: "feedback", title: "Tell us what to build",
  enter: closeOpenPanels,
  body: () => <>Down here you can suggest features, report problems and vote on what other people want.</>,
};

// Steps every tour ends with: view controls and a wrap-up.
const CENTER_STEP: Step = {
  id: "center", target: "center-board", only: ["desktop", "touch"], title: "Lost your board?",
  body: () => <>Panned or zoomed too far? This button brings your board right back to the middle.</>,
};
const FULLSCREEN_STEP: Step = {
  id: "fullscreen", target: "fullscreen", only: ["desktop", "touch"], title: "Go fullscreen",
  body: () => <>Fill the screen with your board when you want zero distractions.</>,
};
const DONE_STEP: Step = {
  id: "done", icon: "done", title: "You're all set",
  enter: closeOpenPanels,
  body: () => <>That&apos;s everything you need to get going. Replay this tour from <strong>Settings → Help</strong> anytime.</>,
};

const TASK_STEPS: Step[] = [
  {
    id: "welcome", icon: "logo", title: "Welcome to Boardtivity",
    enter: closeOpenPanels,
    body: () => <>Let&apos;s set up your first task together and take a quick look around. It takes about a minute.</>,
  },
  {
    id: "add", target: "add-task", advance: "action", title: (_, h) => `Add your first ${taskWord(h)}`,
    enter: closeOpenPanels,
    done: h => isComposing(h),
    reset: closeOpenPanels,
    body: (l, h) => <>{verb(l)} <strong>Add {taskWord(h) === "idea" ? "Idea" : "Task"}</strong> to start.</>,
  },
  {
    id: "name", target: "composer-title", title: "Name it", interactive: true,
    body: (_, h) => <>Type what you need to do{taskWord(h) === "task" ? <>, like <em>&ldquo;Finish essay draft&rdquo;</em></> : ""}.</>,
  },
  {
    id: "details", target: "composer-details", title: "Due date and priority", interactive: true,
    body: l => l === "phone"
      ? <>Set a due date here (required), and pick a priority with the buttons just above. The color shows how urgent it is.</>
      : <>Pick a due date and a priority. Both are required for tasks, and the card&apos;s color shows how urgent it is.</>,
  },
  {
    id: "remind", target: "composer-remind", title: "Remind me", interactive: true,
    body: (_, h) => h.isSignedIn
      ? <>Optional: pick when to get an email about this task. Use a preset, or <strong>Custom time</strong> for an exact date and time.</>
      : <>Sign in to get an email about this task at a time you pick.</>,
  },
  {
    id: "breakdown", target: "composer-bob", icon: "bob", title: "Let BOB break it down", interactive: true,
    body: () => <>Optional: press <strong>BOB Breakdown</strong> to split your task into smaller steps you can check off.</>,
  },
  {
    id: "create", target: "composer-create", advance: "action", title: "Create it",
    done: h => !isComposing(h),
    body: (l, h) => <>{verb(l)} <strong>{l === "phone" ? `Add ${taskWord(h) === "idea" ? "Idea" : "Task"}` : `Create ${taskWord(h)}`}</strong> when you&apos;re ready. If you close it halfway, you can keep it as a draft.</>,
  },
  {
    id: "card", target: "newest-card", title: (_, h) => `Here's your ${taskWord(h)}`,
    enter: h => { if (isComposing(h)) closeOpenPanels(h); },
    advance: l => (l === "phone" ? "next" : "action"),
    done: h => h.detailNoteId !== null,
    reset: h => { if (h.detailNoteId !== null) { h.setDetailNoteId(null); h.setDetailEditing(false); } },
    body: l => l === "phone"
      ? <>Tap <strong>···</strong> on a card to edit it, set a reminder or add subtasks. Tap the dots under the title to check subtasks off.</>
      : <>Drag it anywhere on the board. {l === "touch" ? "Press and hold" : "Right-click"} to lock it in place. <strong>{verb(l)} it</strong> to open the details, check off subtasks and edit it.</>,
  },
  {
    id: "focus", target: "focus-button", title: "Focus mode", advance: "action",
    done: h => isFocusing(h),
    body: l => <>{verb(l)} <strong>{l === "phone" ? "Focus" : "Start focus"}</strong> to work on it with a timer. Every session builds your streak. Try it now (the tour picks up when you&apos;re done) or press Next.</>,
  },
  {
    id: "focus-stats", target: "focus-stats", title: "Your focus stats",
    enter: closeOpenPanels,
    body: () => <>Your streak, focus time this week and all-time totals live here.</>,
  },
  {
    id: "bob", target: "bob", icon: "bob", title: "Meet BOB",
    enter: closeOpenPanels,
    body: () => <>Your AI assistant (Plus). Ask BOB to plan your day, sort your board or add tasks for you.</>,
  },
  {
    id: "boards", target: "boards", title: "Your boards",
    body: l => l === "phone"
      ? <>Tap here to switch between your task and idea boards, or to add a new one.</>
      : <>Switch between task boards and idea boards, or create new ones.</>,
  },
  {
    id: "settings", target: "settings", title: "Settings",
    body: () => <>Themes, colors, emails, BOB, your plan and help. You can replay this tour anytime under <strong>Help</strong>.</>,
  },
  LOOK_STEP,
  colorsStep("task"),
  emailStep("task"),
  CALENDAR_STEP,
  APP_STEP,
  SYNC_STEP,
  CENTER_STEP,
  FULLSCREEN_STEP,
  FEEDBACK_STEP,
  DONE_STEP,
];

// Idea boards: free-form notes you color, connect and get reminded about. No due dates or focus timer.
const IDEA_STEPS: Step[] = [
  {
    id: "welcome", icon: "logo", title: "Your idea board",
    enter: closeOpenPanels,
    body: l => l === "phone"
      ? <>A place to catch ideas before they slip away. Let&apos;s add your first one and take a quick look around.</>
      : <>A free-form space to catch ideas and connect them. Let&apos;s add your first one and take a quick look around.</>,
  },
  {
    id: "add", target: "add-task", advance: "action", title: "Add your first idea",
    enter: closeOpenPanels,
    done: h => isComposing(h),
    reset: closeOpenPanels,
    body: l => <>{verb(l)} <strong>Add Idea</strong> to start.</>,
  },
  {
    id: "name", target: "composer-title", title: "Write it down", interactive: true,
    body: () => <>Type your idea, like <em>&ldquo;Podcast about study habits&rdquo;</em>. Add a note underneath if you want more detail. Nothing here is required but the idea itself.</>,
  },
  {
    id: "idea-options", target: "composer-idea-options", title: "Color and reminder", interactive: true,
    body: (_, h) => <>Give related ideas the same color so they&apos;re easy to spot together. {h.isSignedIn ? <>Set a reminder with a preset or a <strong>Custom time</strong> if you want an email about it later.</> : <>Sign in to get an email reminder about it later.</>}</>,
  },
  {
    id: "create", target: "composer-create", advance: "action", title: "Save it",
    done: h => !isComposing(h),
    body: l => <>{verb(l)} <strong>{l === "phone" ? "Add Idea" : "Create idea"}</strong> when you&apos;re ready.</>,
  },
  {
    id: "card", target: "newest-card", title: "Here's your idea",
    enter: h => { if (isComposing(h)) closeOpenPanels(h); },
    advance: l => (l === "phone" ? "next" : "action"),
    done: h => h.detailNoteId !== null,
    reset: h => { if (h.detailNoteId !== null) { h.setDetailNoteId(null); h.setDetailEditing(false); } },
    body: l => l === "phone"
      ? <>Tap <strong>···</strong> on an idea to edit it, change its color or set a reminder.</>
      : <>Drag it anywhere on the board. {l === "touch" ? "Press and hold" : "Right-click"} to lock it in place. <strong>{verb(l)} it</strong> to open it.</>,
  },
  {
    id: "connect", only: ["desktop", "touch"], icon: "logo", title: "Connect your ideas",
    enter: closeOpenPanels,
    body: () => <>Drag one idea onto another and let go to <strong>link them</strong> with a line. To unlink, drag it over a linked idea and hold for a moment until it shakes.</>,
  },
  {
    id: "bob", target: "bob", icon: "bob", title: "Brainstorm with BOB",
    enter: closeOpenPanels,
    body: () => <>Your AI assistant (Plus). Ask BOB to brainstorm with you, build on an idea, or add ideas to your board for you.</>,
  },
  {
    id: "boards", target: "boards", title: "Your boards",
    body: l => l === "phone"
      ? <>Tap here to switch between idea and task boards. When an idea turns into real work, make it a task on a task board.</>
      : <>Switch between idea boards and task boards, or create new ones. When an idea turns into real work, make it a task.</>,
  },
  {
    id: "settings", target: "settings", title: "Settings",
    body: () => <>Themes, colors, emails, BOB, your plan and help. You can replay this tour anytime under <strong>Help</strong>.</>,
  },
  LOOK_STEP,
  colorsStep("idea"),
  emailStep("idea"),
  CALENDAR_STEP,
  APP_STEP,
  SYNC_STEP,
  {
    id: "focus-stats", target: "focus-stats", title: "Focus mode",
    body: () => <>On task boards, every task has a focus timer that builds a daily streak. Your stats live here.</>,
  },
  CENTER_STEP,
  FULLSCREEN_STEP,
  FEEDBACK_STEP,
  DONE_STEP,
];

function findTarget(id: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`));
  return els.find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
}

type Rect = { top: number; left: number; width: number; height: number; radius: number };

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8;
  return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), radius: Math.min(radius, 28) };
}

function sameRect(a: Rect | null, b: Rect | null) {
  return !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height && a.radius === b.radius;
}

function StepIcon({ icon, theme, size }: { icon: Step["icon"]; theme: ThemeMode; size: number }) {
  const dark = theme === "dark";
  const ink = dark ? "#f5f5f2" : "#171613";
  if (icon === "logo") return <BoardtivityLogo size={size} dark={dark} />;
  if (icon === "bob") return <BobIcon size={size} color={ink} />;
  if (icon === "done") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block" }}>
        <circle cx="24" cy="24" r="21" fill={dark ? "#0e2e18" : "#e6f9ee"} stroke="rgba(60,180,90,.45)" strokeWidth="1.5" />
        <path d="M15 24.5l6 6L33 18" fill="none" stroke="#3db83d" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

export default function Tutorial() {
  const home = useHome();
  const { tutorialOpen, closeTutorial, theme, isMobile, isNativeApp } = home;
  // `index` is the step being loaded; `shown` is the step on screen. They differ only for the
  // moment it takes to find the next control, so content and spotlight always switch together.
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [searching, setSearching] = useState(false);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  // How the spotlight moves to the next control. Short hops glide; long jumps (or ones that need
  // the page to scroll) hide the spotlight under a plain dim layer, move it, then fade it back in,
  // so it never chases a scrolling target across the screen. Between steps it follows its control
  // exactly, with no easing, so scrolling or panning can't make it wobble.
  const [glide, setGlide] = useState(false);
  const [veil, setVeil] = useState(false);
  const moveTimersRef = useRef<number[]>([]);
  const rectRef = useRef<Rect | null>(null);
  rectRef.current = rect;
  const targetRef = useRef<HTMLElement | null>(null);
  const targetIdRef = useRef<string | null>(null);
  // An action step only completes when its action happens *while it's showing*. If it's already
  // satisfied on arrival (e.g. Back onto a step whose dialog is still open), show Next instead.
  const sawNotDoneRef = useRef(false);
  // Set when the user's own click moved the tour forward: the next control may still be mounting.
  const afterActionRef = useRef(false);
  const directionRef = useRef<1 | -1>(1);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const homeRef = useRef(home);
  homeRef.current = home;

  const layout: Layout = isMobile && !isNativeApp
    ? "phone"
    : typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "desktop";
  // The tour follows the board you're on: idea boards get their own walkthrough.
  const allSteps = home.activeBoard?.type === "thought" ? IDEA_STEPS : TASK_STEPS;
  const steps = allSteps.filter(s => !s.only || s.only.includes(layout));
  const step = steps[Math.min(index, steps.length - 1)];
  const shownStep = steps[Math.min(shown, steps.length - 1)];
  const advance = typeof shownStep.advance === "function" ? shownStep.advance(layout) : shownStep.advance ?? "next";
  const interactive = advance === "action" || !!shownStep.interactive;
  const isLast = shown >= steps.length - 1;

  function go(next: number) {
    directionRef.current = next >= shown ? 1 : -1;
    if (next >= steps.length) { finish(); return; }
    setIndex(Math.max(0, next));
  }
  function finish() {
    // Leave the board tidy. A half-written task goes through the normal close, so the user is
    // asked whether to keep it as a draft instead of losing it.
    const h = homeRef.current;
    closeStrayPanels(h);
    if (h.composerOpen) h.closeComposer();
    if (h.mobileAddMode !== null) h.setMobileAddMode(null);
    if (h.detailNoteId !== null) { h.setDetailNoteId(null); h.setDetailEditing(false); }
    closeTutorial();
  }

  // (Re)start from the top whenever the tour opens.
  // Reset on close (not on open) so a reopened tour never flashes the step it ended on.
  useEffect(() => {
    if (tutorialOpen) return;
    setIndex(0); setShown(0); setRect(null); setTipPos(null); setSearching(false); setGlide(false); setVeil(false);
    moveTimersRef.current.forEach(clearTimeout); moveTimersRef.current = [];
    directionRef.current = 1; targetRef.current = null; targetIdRef.current = null;
  }, [tutorialOpen]);

  // Enter a step: tidy up, then find its control. The previous spotlight stays on screen
  // while we look, so the ring glides to the new control instead of blinking out and back.
  useEffect(() => {
    if (!tutorialOpen) return;
    moveTimersRef.current.forEach(clearTimeout); moveTimersRef.current = [];
    setVeil(false);
    sawNotDoneRef.current = false;
    const justActed = afterActionRef.current; // consume the flag for this step only
    afterActionRef.current = false;
    if (directionRef.current === -1) step.reset?.(homeRef.current);
    closeStrayPanels(homeRef.current);
    step.enter?.(homeRef.current);
    if (!step.target) {
      targetRef.current = null; targetIdRef.current = null;
      setRect(null); setTipPos(null); setSearching(false); setGlide(false); setShown(index);
      return;
    }

    const attach = (el: HTMLElement) => {
      setSearching(false);
      const later = (fn: () => void, ms: number) => { moveTimersRef.current.push(window.setTimeout(fn, ms)); };
      const commit = (scroll: boolean) => {
        targetRef.current = el;
        targetIdRef.current = step.target!;
        setShown(index);
        if (scroll) el.scrollIntoView({ block: "center", behavior: "instant" });
        // Move the spotlight (and its click shields) in the same render as the new step.
        const m = measure(el);
        setRect(prev => (sameRect(prev, m) ? prev : m));
        // Fill-in steps put the cursor in their field (the focus guard may have moved it to the card).
        if (step.interactive) {
          const field = el.matches("input,textarea") ? el : el.querySelector<HTMLElement>("input,textarea");
          field?.focus({ preventScroll: true });
        }
      };
      const r = el.getBoundingClientRect();
      const needsScroll = r.top < 70 || r.bottom > window.innerHeight - 70;
      const prev = rectRef.current;
      if (!prev) { setGlide(false); commit(needsScroll); return; } // coming from a centered card: just appear
      const dist = Math.hypot(r.left + r.width / 2 - (prev.left + prev.width / 2), r.top + r.height / 2 - (prev.top + prev.height / 2));
      if (!needsScroll && dist <= 260) {
        setGlide(true); commit(false);
        later(() => setGlide(false), 420);
        return;
      }
      setGlide(false); setVeil(true);
      later(() => { commit(needsScroll); later(() => setVeil(false), 40); }, 170);
    };

    // Usually the control is already there: attach in the same frame, no waiting.
    const now = findTarget(step.target);
    if (now) { attach(now); return; }

    // Not there yet. Unless the user just did something that's still rendering, it isn't coming
    // (e.g. the composer is closed, or a desktop-only control on a phone): skip at once.
    const skipOver = () => {
      setSearching(false);
      const next = index + directionRef.current;
      if (next < 0) setIndex(0);
      else if (next >= steps.length) finish();
      else setIndex(next);
    };
    if (!(justActed && directionRef.current === 1) && !step.awaitTarget) { skipOver(); return; }

    // Right after the user's own action it may still be appearing (a dialog opening, a card being
    // created): attach the moment it shows up in the DOM, or skip after a short grace period.
    setSearching(true);
    let done = false;
    const observer = new MutationObserver(() => {
      if (done) return;
      const el = findTarget(step.target!);
      if (el) { done = true; observer.disconnect(); clearTimeout(giveUp); attach(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "data-tour"] });
    const giveUp = setTimeout(() => {
      if (done) return;
      done = true;
      observer.disconnect();
      const el = findTarget(step.target!);
      if (el) { attach(el); return; }
      skipOver();
    }, 300);
    return () => { done = true; observer.disconnect(); clearTimeout(giveUp); };
  }, [tutorialOpen, index, layout]);

  // Keep the spotlight glued to its control through scrolling, panning, resizing and animations.
  useEffect(() => {
    if (!tutorialOpen) return;
    let frame = 0;
    const tick = () => {
      let el = targetRef.current;
      if (el && !el.isConnected && targetIdRef.current) { el = findTarget(targetIdRef.current); targetRef.current = el; }
      if (el) {
        const next = measure(el);
        setRect(prev => (sameRect(prev, next) ? prev : next));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tutorialOpen]);

  // Interactive steps finish themselves once the user does the thing.
  const stepDone = !!shownStep.done?.(home);
  if (tutorialOpen && shown === index && advance === "action" && !stepDone && !searching) sawNotDoneRef.current = true;
  const waitingForAction = advance === "action" && sawNotDoneRef.current;
  const actionDone = tutorialOpen && shown === index && waitingForAction && stepDone && !searching;
  // Focus mode takes over the screen; the tour steps aside and resumes when it's finished.
  const paused = isFocusing(home);
  useEffect(() => {
    if (actionDone) { afterActionRef.current = true; go(shown + 1); } // runs after the UI has committed
  }, [actionDone]);

  // Place the tooltip next to the spotlight, flipping/clamping to stay on screen.
  useLayoutEffect(() => {
    if (!tutorialOpen || !rect || !tipRef.current) return;
    const tip = tipRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, gap = 14, m = 12;
    const pad = 6;
    const below = rect.top + rect.height + pad + gap;
    const above = rect.top - pad - gap - tip.height;
    let top: number;
    let left: number;
    if (below + tip.height <= vh - m) { top = below; left = rect.left + rect.width / 2 - tip.width / 2; }
    else if (above >= m) { top = above; left = rect.left + rect.width / 2 - tip.width / 2; }
    else if (rect.left + rect.width + pad + gap + tip.width <= vw - m) { left = rect.left + rect.width + pad + gap; top = rect.top + rect.height / 2 - tip.height / 2; }
    else if (rect.left - pad - gap - tip.width >= m) { left = rect.left - pad - gap - tip.width; top = rect.top + rect.height / 2 - tip.height / 2; }
    else { top = vh - tip.height - m; left = vw / 2 - tip.width / 2; }
    left = Math.max(m, Math.min(left, vw - tip.width - m));
    top = Math.max(m, Math.min(top, vh - tip.height - m));
    setTipPos(prev => (prev && Math.abs(prev.top - top) < 1 && Math.abs(prev.left - left) < 1 ? prev : { top, left }));
  }, [tutorialOpen, rect, shown]);

  // Keyboard: Esc ends; arrows move between steps unless the user is typing in a field.
  // Keys aimed anywhere except the tour card or a usable highlighted control are swallowed,
  // so app shortcuts and Enter/Space on a focused button behind the dimmer do nothing.
  const allowedTarget = (t: EventTarget | null) => {
    const node = t instanceof Node ? t : null;
    if (!node) return false;
    if (tipRef.current?.contains(node)) return true;
    return interactive && !!targetRef.current?.contains(node);
  };
  useEffect(() => {
    if (!tutorialOpen) return;
    function onKey(e: KeyboardEvent) {
      if (paused) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); return; }
      if (e.key === "Tab") return; // focus is kept inside the tour by the focusin guard below
      if (!allowedTarget(e.target)) {
        e.preventDefault(); e.stopPropagation();
        if (e.key === "ArrowRight" && !waitingForAction) go(shown + 1);
        else if (e.key === "ArrowLeft" && shown > 0) go(shown - 1);
        return;
      }
      if (typing) return;
      if (e.key === "ArrowRight" && !waitingForAction) go(shown + 1);
      else if (e.key === "ArrowLeft" && shown > 0) go(shown - 1);
    }
    // If focus wanders behind the tour (Tab, or a click that slipped through), bring it back.
    function onFocusIn(e: FocusEvent) {
      if (paused || allowedTarget(e.target)) return;
      (primaryRef.current ?? tipRef.current?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
    }
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => { window.removeEventListener("keydown", onKey, true); document.removeEventListener("focusin", onFocusIn, true); };
  });

  // Freeze the page while the tour is up: wheel, trackpad and touch scrolling (and the board's own
  // wheel-panning) would slide controls out from under the spotlight. Only the tour card, and the
  // highlighted control on fill-in steps, can still scroll. The tour's own scrollIntoView still works.
  useEffect(() => {
    if (!tutorialOpen || paused) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const block = (e: Event) => { if (!allowedTarget(e.target)) e.preventDefault(); };
    const keys = (e: KeyboardEvent) => {
      if ([" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key) && !allowedTarget(e.target)) e.preventDefault();
    };
    window.addEventListener("wheel", block, { passive: false, capture: true });
    window.addEventListener("touchmove", block, { passive: false, capture: true });
    window.addEventListener("keydown", keys, true);
    return () => {
      root.style.overflow = prevOverflow;
      window.removeEventListener("wheel", block, { capture: true });
      window.removeEventListener("touchmove", block, { capture: true });
      window.removeEventListener("keydown", keys, true);
    };
  });

  // Centered cards take keyboard focus; spotlight steps leave focus where the user is working.
  useEffect(() => { if (tutorialOpen && !shownStep.target) primaryRef.current?.focus({ preventScroll: true }); }, [tutorialOpen, shown, shownStep.target]);

  if (!tutorialOpen || paused) return null;

  const dark = theme === "dark";
  const dim = dark ? "rgba(6,8,12,.66)" : "rgba(12,12,14,.5)";
  const cardBg = dark ? "#1a1d22" : "#fbf8f1";
  const title = typeof shownStep.title === "function" ? shownStep.title(layout, home) : shownStep.title;
  const centered = !shownStep.target;
  const pad = 6;
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  const btnBase: CSSProperties = { height: 40, borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "0 16px" };
  const primaryBtn: CSSProperties = { ...btnBase, border: "none", backgroundColor: dark ? "#f5f5f2" : "#171613", color: dark ? "#171613" : "#f5f5f2" };
  const secondaryBtn: CSSProperties = { ...btnBase, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), color: pageText(theme) };

  const footer = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
      {isLast || shown === 0 ? <span /> : (
        <button type="button" onClick={finish} style={{ border: "none", background: "none", color: muted(theme), fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 2px", fontFamily: "inherit" }}>
          End tour
        </button>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {shown > 0 && !isLast && <button type="button" onClick={() => go(shown - 1)} style={secondaryBtn}>Back</button>}
        {waitingForAction
          ? <button type="button" onClick={() => go(shown + 1)} style={secondaryBtn}>{shownStep.id === "focus" ? "Next" : "Skip"}</button>
          : <button ref={primaryRef} type="button" onClick={() => (isLast ? finish() : go(shown + 1))} style={primaryBtn}>{shown === 0 ? "Start the tour" : isLast ? "Finish" : "Next"}</button>}
      </div>
    </div>
  );

  // Centered cards: one full-width primary action, with quieter secondary actions underneath.
  const textLink: CSSProperties = { border: "none", background: "none", color: muted(theme), fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 8px", fontFamily: "inherit" };
  const centeredFooter = (
    <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
      {shown > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
          <button type="button" onClick={() => go(shown - 1)} style={{ ...secondaryBtn, height: 46 }}>Back</button>
          <button ref={primaryRef} type="button" onClick={() => (isLast ? finish() : go(shown + 1))} style={{ ...primaryBtn, height: 46 }}>{isLast ? "Finish" : "Next"}</button>
        </div>
      ) : (
        <button ref={primaryRef} type="button" onClick={() => (isLast ? finish() : go(shown + 1))} style={{ ...primaryBtn, height: 46, width: "100%" }}>
          {isLast ? "Finish" : "Start the tour"}
        </button>
      )}
      {shown === 0 && <button type="button" onClick={finish} style={textLink}>Not now</button>}
      {shown > 0 && !isLast && <button type="button" onClick={finish} style={textLink}>End tour</button>}
    </div>
  );

  const progress = (
    <div
      role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={shown + 1}
      style={{ width: centered ? 120 : 72, height: 4, borderRadius: 999, overflow: "hidden", backgroundColor: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)" }}
    >
      <div style={{ width: `${((shown + 1) / steps.length) * 100}%`, height: "100%", borderRadius: 999, backgroundColor: "#3db83d", transition: "width .3s cubic-bezier(.22,1,.36,1)" }} />
    </div>
  );

  // ── Centered card (welcome, wrap-up, or a control that's hidden right now) ──
  if (centered) {
    const phone = layout === "phone";
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="bt-tour-title" style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: phone ? "flex-end" : "center", justifyContent: "center", padding: phone ? 0 : 20, backgroundColor: dim }}>
        <div ref={tipRef} key={shown} className={phone ? "tour-sheet-in" : "tour-card-in"} style={{ width: phone ? "100%" : "min(420px, 100%)", boxSizing: "border-box", padding: phone ? "30px 24px calc(24px + env(safe-area-inset-bottom))" : "36px 32px 26px", borderRadius: phone ? "22px 22px 0 0" : 22, backgroundColor: cardBg, border: `1px solid ${border(theme)}`, boxShadow: "0 30px 80px rgba(0,0,0,.3)", color: pageText(theme), textAlign: "center" }}>
          {shownStep.icon && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 64, marginBottom: 18 }}>
              <StepIcon icon={shownStep.icon} theme={theme} size={shownStep.icon === "logo" ? 72 : shownStep.icon === "bob" ? 64 : 56} />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{progress}</div>
          <h2 id="bt-tour-title" style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.2 }}>{title}</h2>
          <p aria-live="polite" style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: muted(theme) }}>{shownStep.body(layout, home)}</p>
          {centeredFooter}
        </div>
      </div>
    );
  }

  // ── Spotlight on a real control ──
  const vwFull = typeof window !== "undefined" ? window.innerWidth : 1200;
  const tipWidth = Math.min(340, vwFull - 24);
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="bt-tour-title" style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" }}>
      {/* Click shields. Interactive steps leave exactly the control's own box open (not the glow
          around it, which could reach a neighbouring button); look-only steps cover everything. */}
      {hole && rect && (interactive ? (
        <>
          <div style={{ position: "fixed", left: 0, top: 0, right: 0, height: Math.max(0, rect.top), pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: 0, top: rect.top + rect.height, right: 0, bottom: 0, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: 0, top: rect.top, width: Math.max(0, rect.left), height: rect.height, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: rect.left + rect.width, top: rect.top, right: 0, height: rect.height, pointerEvents: "auto" }} />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "auto" }} />
      ))}
      {hole && (
        <>
      {/* Dimmed backdrop with a rounded cut-out and a pulsing ring */}
          <div
            className="tour-ring"
            style={{
              position: "fixed", top: hole.top, left: hole.left, width: hole.width, height: hole.height,
              borderRadius: (rect?.radius ?? 8) + pad, boxShadow: `0 0 0 9999px ${dim}`, pointerEvents: "none",
              transition: glide ? "top .38s cubic-bezier(.22,1,.36,1), left .38s cubic-bezier(.22,1,.36,1), width .38s cubic-bezier(.22,1,.36,1), height .38s cubic-bezier(.22,1,.36,1), border-radius .38s cubic-bezier(.22,1,.36,1)" : "none",
            }}
          />
        </>
      )}
      {!hole && <div style={{ position: "fixed", inset: 0, backgroundColor: dim, pointerEvents: "auto" }} />}
      {/* Plain dim layer that covers the spotlight while it jumps a long way */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, backgroundColor: dim, opacity: veil ? 1 : 0, transition: "opacity .16s ease", pointerEvents: veil ? "auto" : "none" }} />

      <div
        ref={tipRef}
        style={{
          position: "fixed", top: tipPos?.top ?? -9999, left: tipPos?.left ?? -9999, width: tipWidth, boxSizing: "border-box",
          padding: "18px 18px 14px", borderRadius: 16, backgroundColor: cardBg, border: `1px solid ${border(theme)}`,
          boxShadow: "0 18px 50px rgba(0,0,0,.28)", color: pageText(theme), pointerEvents: "auto",
          // Glides with the spotlight on short hops; otherwise fades out, moves, and fades back in.
          opacity: tipPos && !veil ? 1 : 0, transition: glide ? "opacity .16s ease, top .38s cubic-bezier(.22,1,.36,1), left .38s cubic-bezier(.22,1,.36,1)" : "opacity .16s ease",
        }}
      >
        <div style={{ marginBottom: 12 }}>{progress}</div>
        <div key={shown} className="tour-swap">
        {shownStep.icon && <div style={{ marginBottom: 8 }}><StepIcon icon={shownStep.icon} theme={theme} size={26} /></div>}
        <h2 id="bt-tour-title" style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>{title}</h2>
        <p aria-live="polite" style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: muted(theme) }}>{shownStep.body(layout, home)}</p>
        {waitingForAction && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: dark ? "#8ab4ff" : "#2563eb", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="tour-dot" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "currentColor", display: "inline-block" }} />
            {layout === "desktop" ? "Click" : "Tap"} the highlighted {shownStep.id === "card" ? "card" : "button"} to continue
          </div>
        )}
        {footer}
        </div>
      </div>
    </div>
  );
}
