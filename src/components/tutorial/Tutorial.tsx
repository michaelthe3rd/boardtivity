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
  done?: (h: Home) => boolean;
  enter?: (h: Home) => void; // tidy up before showing this step (e.g. close dialogs)
};

const isComposing = (h: Home) => h.composerOpen || h.mobileAddMode !== null;
const taskWord = (h: Home) => (h.activeBoard?.type === "thought" ? "idea" : "task");
const verb = (l: Layout) => (l === "desktop" ? "Click" : "Tap");

function closeOpenPanels(h: Home) {
  if (h.composerOpen) h.closeComposer();
  if (h.mobileAddMode !== null) h.setMobileAddMode(null);
  if (h.detailNoteId !== null) { h.setDetailNoteId(null); h.setDetailEditing(false); }
}

const STEPS: Step[] = [
  {
    id: "welcome", icon: "logo", title: "Welcome to Boardtivity",
    body: () => <>Let&apos;s set up your first task together and take a quick look around. It takes about a minute.</>,
  },
  {
    id: "add", target: "add-task", advance: "action", title: (_, h) => `Add your first ${taskWord(h)}`,
    done: h => isComposing(h),
    body: (l, h) => <>{verb(l)} <strong>Add {taskWord(h) === "idea" ? "Idea" : "Task"}</strong> to start.</>,
  },
  {
    id: "name", target: "composer-title", title: "Name it",
    body: (_, h) => <>Type what you need to do{taskWord(h) === "task" ? <>, like <em>&ldquo;Finish essay draft&rdquo;</em></> : ""}.</>,
  },
  {
    id: "details", target: "composer-details", title: "Due date and priority",
    body: l => l === "phone"
      ? <>Set a due date here (required), and pick a priority with the buttons just above. The color shows how urgent it is.</>
      : <>Pick a due date and a priority. Both are required for tasks, and the card&apos;s color shows how urgent it is.</>,
  },
  {
    id: "breakdown", target: "composer-bob", icon: "bob", title: "Let BOB break it down",
    body: () => <>Optional: <strong>BOB Breakdown</strong> splits a big task into smaller steps you can check off.</>,
  },
  {
    id: "create", target: "composer-create", advance: "action", title: "Create it",
    done: h => !isComposing(h),
    body: (l, h) => <>{verb(l)} <strong>{l === "phone" ? `Add ${taskWord(h) === "idea" ? "Idea" : "Task"}` : `Create ${taskWord(h)}`}</strong> when you&apos;re ready.</>,
  },
  {
    id: "card", target: "newest-card", title: (_, h) => `Here's your ${taskWord(h)}`,
    enter: h => { if (isComposing(h)) closeOpenPanels(h); },
    advance: l => (l === "phone" ? "next" : "action"),
    done: h => h.detailNoteId !== null,
    body: l => l === "phone"
      ? <>Tap <strong>⋯</strong> on a card to edit it or add subtasks.</>
      : <>Drag it anywhere on the board. {l === "touch" ? "Press and hold" : "Right-click"} to lock it in place. <strong>{verb(l)} it</strong> to open the details.</>,
  },
  {
    id: "focus", target: "focus-button", title: "Focus mode",
    body: l => <>{verb(l)} <strong>{l === "phone" ? "Focus" : "Start focus"}</strong> to work on it with a timer. Every session builds your streak.</>,
  },
  {
    id: "bob", target: "bob", icon: "bob", title: "Meet BOB",
    enter: closeOpenPanels,
    body: () => <>Your AI assistant (Plus). Ask BOB to plan your day, sort your board or add tasks for you.</>,
  },
  {
    id: "boards", target: "boards", title: "Your boards",
    body: l => l === "phone"
      ? <>Switch between your task and idea boards here, and tap <strong>+</strong> to add one.</>
      : <>Switch between task boards and idea boards, or create new ones.</>,
  },
  {
    id: "settings", target: "settings", title: "Settings",
    body: () => <>Themes, colors and email reminders. You can replay this tour anytime under <strong>Help</strong>.</>,
  },
  {
    id: "fullscreen", target: "fullscreen", only: ["desktop", "touch"], title: "Go fullscreen",
    body: () => <>Fill the screen with your board when you want zero distractions.</>,
  },
  {
    id: "done", icon: "done", title: "You're all set",
    enter: closeOpenPanels,
    body: () => <>That&apos;s everything you need to get going. Replay this tour from <strong>Settings → Help</strong> anytime.</>,
  },
];

function findTarget(id: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`));
  return els.find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
}

type Rect = { top: number; left: number; width: number; height: number; radius: number };

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
  const targetRef = useRef<HTMLElement | null>(null);
  const targetIdRef = useRef<string | null>(null);
  const directionRef = useRef<1 | -1>(1);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const homeRef = useRef(home);
  homeRef.current = home;

  const layout: Layout = isMobile && !isNativeApp
    ? "phone"
    : typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "desktop";
  const steps = STEPS.filter(s => !s.only || s.only.includes(layout));
  const step = steps[Math.min(index, steps.length - 1)];
  const shownStep = steps[Math.min(shown, steps.length - 1)];
  const advance = typeof shownStep.advance === "function" ? shownStep.advance(layout) : shownStep.advance ?? "next";
  const isLast = shown >= steps.length - 1;

  function go(next: number) {
    directionRef.current = next >= shown ? 1 : -1;
    if (next >= steps.length) { finish(); return; }
    setIndex(Math.max(0, next));
  }
  function finish() {
    closeTutorial();
  }

  // (Re)start from the top whenever the tour opens.
  useEffect(() => { if (tutorialOpen) { setIndex(0); setShown(0); directionRef.current = 1; } }, [tutorialOpen]);

  // Enter a step: tidy up, then find its control. The previous spotlight stays on screen
  // while we look, so the ring glides to the new control instead of blinking out and back.
  useEffect(() => {
    if (!tutorialOpen) return;
    step.enter?.(homeRef.current);
    if (!step.target) {
      targetRef.current = null; targetIdRef.current = null;
      setRect(null); setTipPos(null); setSearching(false); setShown(index);
      return;
    }

    const attach = (el: HTMLElement) => {
      targetRef.current = el;
      targetIdRef.current = step.target!;
      setSearching(false);
      setShown(index);
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 70) el.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    // Usually the control is already there: attach in the same frame, no waiting.
    const now = findTarget(step.target);
    if (now) { attach(now); return; }

    // Otherwise it's appearing (a dialog opening, a card being created): attach the moment it
    // shows up in the DOM, and give up after ~1.5s.
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
      // Not on screen in this layout/state: skip in the direction the user was going.
      setSearching(false);
      const next = index + directionRef.current;
      if (next < 0) setIndex(0);
      else if (next >= steps.length) finish();
      else setIndex(next);
    }, 1500);
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
        const r = el.getBoundingClientRect();
        const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8;
        const next: Rect = { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), radius: Math.min(radius, 28) };
        setRect(prev => (sameRect(prev, next) ? prev : next));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tutorialOpen]);

  // Interactive steps finish themselves once the user does the thing.
  const actionDone = tutorialOpen && shown === index && advance === "action" && !!shownStep.done?.(home) && !searching;
  useEffect(() => {
    if (actionDone) go(shown + 1); // runs after the UI has committed, so the next control is already there
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
  useEffect(() => {
    if (!tutorialOpen) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (typing) return;
      else if (e.key === "ArrowRight" && advance === "next") go(shown + 1);
      else if (e.key === "ArrowLeft" && shown > 0) go(shown - 1);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // Centered cards take keyboard focus; spotlight steps leave focus where the user is working.
  useEffect(() => { if (tutorialOpen && !shownStep.target) primaryRef.current?.focus(); }, [tutorialOpen, shown, shownStep.target]);

  if (!tutorialOpen) return null;

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
        {advance === "action"
          ? <button type="button" onClick={() => go(shown + 1)} style={secondaryBtn}>Skip</button>
          : <button ref={primaryRef} type="button" onClick={() => (isLast ? finish() : go(shown + 1))} style={primaryBtn}>{shown === 0 ? "Start the tour" : isLast ? "Finish" : "Next"}</button>}
      </div>
    </div>
  );

  // Centered cards: one full-width primary action, with quieter secondary actions underneath.
  const textLink: CSSProperties = { border: "none", background: "none", color: muted(theme), fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 8px", fontFamily: "inherit" };
  const centeredFooter = (
    <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
      {shown > 0 && !isLast ? (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
          <button type="button" onClick={() => go(shown - 1)} style={{ ...secondaryBtn, height: 46 }}>Back</button>
          <button ref={primaryRef} type="button" onClick={() => go(shown + 1)} style={{ ...primaryBtn, height: 46 }}>Next</button>
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
    <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: muted(theme) }}>
      Step {shown + 1} of {steps.length}
    </div>
  );

  // ── Centered card (welcome, wrap-up, or a control that's hidden right now) ──
  if (centered) {
    const phone = layout === "phone";
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="bt-tour-title" style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: phone ? "flex-end" : "center", justifyContent: "center", padding: phone ? 0 : 20, backgroundColor: dim }}>
        <div key={shown} className={phone ? "tour-sheet-in" : "tour-card-in"} style={{ width: phone ? "100%" : "min(420px, 100%)", boxSizing: "border-box", padding: phone ? "30px 24px calc(24px + env(safe-area-inset-bottom))" : "36px 32px 26px", borderRadius: phone ? "22px 22px 0 0" : 22, backgroundColor: cardBg, border: `1px solid ${border(theme)}`, boxShadow: "0 30px 80px rgba(0,0,0,.3)", color: pageText(theme), textAlign: "center" }}>
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
      {/* Click shields around the hole: only the highlighted control can be used */}
      {hole && (
        <>
          <div style={{ position: "fixed", left: 0, top: 0, right: 0, height: Math.max(0, hole.top), pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: 0, top: hole.top + hole.height, right: 0, bottom: 0, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", left: hole.left + hole.width, top: hole.top, right: 0, height: hole.height, pointerEvents: "auto" }} />
          {/* Dimmed backdrop with a rounded cut-out and a pulsing ring */}
          <div
            className="tour-ring"
            style={{
              position: "fixed", top: hole.top, left: hole.left, width: hole.width, height: hole.height,
              borderRadius: (rect?.radius ?? 8) + pad, boxShadow: `0 0 0 9999px ${dim}`, pointerEvents: "none",
              transition: "top .38s cubic-bezier(.22,1,.36,1), left .38s cubic-bezier(.22,1,.36,1), width .38s cubic-bezier(.22,1,.36,1), height .38s cubic-bezier(.22,1,.36,1), border-radius .38s cubic-bezier(.22,1,.36,1)",
            }}
          />
        </>
      )}
      {!hole && <div style={{ position: "fixed", inset: 0, backgroundColor: dim, pointerEvents: "auto" }} />}

      <div
        ref={tipRef}
        style={{
          position: "fixed", top: tipPos?.top ?? -9999, left: tipPos?.left ?? -9999, width: tipWidth, boxSizing: "border-box",
          padding: "18px 18px 14px", borderRadius: 16, backgroundColor: cardBg, border: `1px solid ${border(theme)}`,
          boxShadow: "0 18px 50px rgba(0,0,0,.28)", color: pageText(theme), pointerEvents: "auto",
          opacity: tipPos ? 1 : 0, transition: "opacity .18s ease, top .38s cubic-bezier(.22,1,.36,1), left .38s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div key={shown} className="tour-swap">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          {shownStep.icon && <StepIcon icon={shownStep.icon} theme={theme} size={26} />}
          {progress}
        </div>
        <h2 id="bt-tour-title" style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>{title}</h2>
        <p aria-live="polite" style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: muted(theme) }}>{shownStep.body(layout, home)}</p>
        {advance === "action" && (
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
