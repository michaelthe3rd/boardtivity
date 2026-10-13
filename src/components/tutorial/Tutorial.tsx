"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ThemeMode } from "@/lib/board";
import { NOTE_PALETTE } from "@/lib/colors";
import { border, muted, pageText, panel } from "@/lib/ui";
import { useHome } from "@/components/home/HomeContext";

type Layout = "phone" | "desktop" | "touch"; // touch = tablet-sized board on a touch screen

type Step = {
  key: string;
  color: string; // NOTE_PALETTE name
  icon: (c: string) => ReactNode;
  title: string;
  body: ReactNode;
  only?: Layout[];
};

const line = (c: string, w = 2.6) => ({ fill: "none", stroke: c, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

function steps(layout: Layout): Step[] {
  const tap = layout === "desktop" ? "Click" : "Tap";
  const lockHow = layout === "desktop" ? "Right-click a card" : "Press and hold a card";
  const all: Step[] = [
    {
      key: "welcome", color: "Indigo", title: "Welcome to Boardtivity",
      icon: c => (<><rect x="12" y="13" width="24" height="22" rx="5" {...line(c)} /><path d="M17 18h3M17 18v3M31 18h-3M31 18v3M17 30h3M17 30v-3M31 30h-3M31 30v-3" {...line(c, 2)} /></>),
      body: <>Your tasks, ideas and focus sessions, all on one board. This quick tour takes about a minute, and you can replay it anytime from <strong>Settings</strong>.</>,
    },
    {
      key: "add", color: "Red", title: "Add your tasks",
      icon: c => (<><rect x="11" y="13" width="26" height="20" rx="4" {...line(c)} /><path d="M24 18v10M19 23h10" {...line(c)} /></>),
      body: <>{tap} <strong>Add Task</strong> to create one. Give it a due date and a priority; the card&apos;s color shows how urgent it is.</>,
    },
    {
      key: "boards", color: "Yellow", title: "Boards for tasks and ideas",
      icon: c => (<><rect x="13" y="16" width="20" height="17" rx="4" {...line(c)} /><path d="M17 12h15a3 3 0 0 1 3 3v12" {...line(c)} /></>),
      body: layout === "phone"
        ? <>Switch boards with the tabs at the top, and use <strong>+</strong> to add a new task or idea board. Ideas are free-form notes for anything that isn&apos;t a task.</>
        : <>Open <strong>Boards</strong> (top right) to switch between task boards and idea boards. Drag one idea onto another to link them.</>,
    },
    {
      key: "subtasks", color: "Teal", title: "Break big tasks down",
      icon: c => (<><circle cx="16" cy="24" r="4" {...line(c)} /><circle cx="32" cy="15" r="3.5" {...line(c)} /><circle cx="32" cy="33" r="3.5" {...line(c)} /><path d="M19.5 22l9-5M19.5 26l9 5" {...line(c, 2.2)} /></>),
      body: layout === "phone"
        ? <>Tap <strong>⋯</strong> on a task to edit it and add subtasks, or let <strong>BOB Breakdown</strong> split it into steps for you.</>
        : <>Open a task to add subtasks, or press <strong>BOB Breakdown</strong> to split it into steps. Show them on the board as a web or a step-by-step chain.</>,
    },
    {
      key: "lock", color: "Purple", title: "Arrange and lock",
      only: ["desktop", "touch"],
      icon: c => (<><rect x="14" y="22" width="20" height="14" rx="3.5" {...line(c)} /><path d="M18 22v-4a6 6 0 0 1 12 0v4" {...line(c)} /></>),
      body: <>Drag cards anywhere on the board. {lockHow} to lock it in place so it can&apos;t be moved by accident. Do it again to unlock.</>,
    },
    {
      key: "focus", color: "Emerald", title: "Focus mode",
      icon: c => (<><circle cx="24" cy="26" r="10" {...line(c)} /><path d="M24 21v5l3 2M21 12h6" {...line(c)} /></>),
      body: <>{tap} <strong>{layout === "phone" ? "Focus" : "Start focus"}</strong> on a task, pick how long, and work through it distraction-free. Every session counts toward your streak.</>,
    },
    {
      key: "bob", color: "Blue", title: "Meet BOB",
      icon: c => (<><rect x="12" y="16" width="24" height="18" rx="6" {...line(c)} /><circle cx="19.5" cy="25" r="2" fill={c} /><circle cx="28.5" cy="25" r="2" fill={c} /><path d="M24 16v-4" {...line(c)} /></>),
      body: <>BOB is your AI assistant on Boardtivity Plus. Ask it to plan your day, sort your board or add tasks for you. {tap} <strong>BOB</strong> at the top of your board.</>,
    },
    {
      key: "settings", color: "Orange", title: "Make it yours",
      icon: c => (<><circle cx="24" cy="24" r="4" {...line(c)} /><path d="M24 12v4M24 32v4M12 24h4M32 24h4M15.5 15.5l2.8 2.8M29.7 29.7l2.8 2.8M15.5 32.5l2.8-2.8M29.7 18.3l2.8-2.8" {...line(c)} /></>),
      body: layout === "phone"
        ? <>Open <strong>Settings</strong> to switch light or dark mode, change colors and set email reminders. You can replay this tour there too.</>
        : <>Open <strong>Settings</strong> (the gear) for themes, colors and email reminders. Use the button at the bottom left for a fullscreen board. You can replay this tour from Settings.</>,
    },
    {
      key: "done", color: "Pink", title: "You're all set",
      icon: c => <path d="M15 24.5l6 6L33 18" {...line(c, 3.4)} />,
      body: <>Start with one thing you need to get done today.</>,
    },
  ];
  return all.filter(s => !s.only || s.only.includes(layout));
}

function Badge({ step, theme }: { step: Step; theme: ThemeMode }) {
  const p = NOTE_PALETTE.find(x => x.name === step.color) ?? NOTE_PALETTE[0];
  const dark = theme === "dark";
  return (
    <svg width="64" height="64" viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block" }}>
      <circle cx="24" cy="24" r="22" fill={dark ? "#2a2e35" : "#ffffff"} />
      <circle cx="24" cy="24" r="19.5" fill={dark ? p.dark : p.light} stroke={p.halo.replace(/[\d.]+\)$/, dark ? "0.55)" : "0.45)")} strokeWidth="1.2" />
      {step.icon(p.swatch)}
    </svg>
  );
}

export default function Tutorial() {
  const { tutorialOpen, closeTutorial, theme, isMobile, isNativeApp, setComposerOpen, setMobileAddMode, activeBoard } = useHome();
  const [index, setIndex] = useState(0);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  const layout: Layout = isMobile && !isNativeApp
    ? "phone"
    : typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "desktop";
  const list = steps(layout);
  const step = list[Math.min(index, list.length - 1)];
  const isFirst = index === 0;
  const isLast = index >= list.length - 1;

  // Always start from the first step when (re)opened.
  useEffect(() => { if (tutorialOpen) setIndex(0); }, [tutorialOpen]);
  useEffect(() => { if (tutorialOpen) primaryRef.current?.focus(); }, [tutorialOpen, index]);

  useEffect(() => {
    if (!tutorialOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeTutorial();
      else if (e.key === "ArrowRight") setIndex(i => Math.min(i + 1, list.length - 1));
      else if (e.key === "ArrowLeft") setIndex(i => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tutorialOpen, list.length, closeTutorial]);

  if (!tutorialOpen) return null;

  const dark = theme === "dark";
  const isPhone = layout === "phone";
  const primaryBg = dark ? "#f5f5f2" : "#171613";
  const primaryFg = dark ? "#171613" : "#f5f5f2";

  function startFirstTask() {
    closeTutorial();
    if (isPhone) setMobileAddMode(activeBoard?.type === "thought" ? "thought" : "task");
    else setComposerOpen(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bt-tutorial-title"
      onClick={e => { if (e.target === e.currentTarget) closeTutorial(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: isPhone ? "flex-end" : "center", justifyContent: "center",
        padding: isPhone ? 0 : 20, backgroundColor: dark ? "rgba(6,8,12,.72)" : "rgba(10,10,12,.38)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div style={{
        position: "relative", width: isPhone ? "100%" : "min(440px, 100%)", boxSizing: "border-box",
        padding: isPhone ? "28px 24px calc(28px + env(safe-area-inset-bottom))" : "36px 34px 26px",
        borderRadius: isPhone ? "22px 22px 0 0" : 22, backgroundColor: dark ? "#1a1d22" : "#fbf8f1",
        border: `1px solid ${border(theme)}`, boxShadow: "0 30px 80px rgba(0,0,0,.28)", color: pageText(theme), fontFamily: "inherit",
      }}>
        {!isLast && (
          <button
            type="button"
            onClick={closeTutorial}
            style={{ position: "absolute", top: 16, right: 16, border: "none", background: "none", color: muted(theme), fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 8px", fontFamily: "inherit" }}
          >
            Skip tour
          </button>
        )}

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Badge step={step} theme={theme} />
        </div>

        <div aria-live="polite" style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 10 }}>
            Step {index + 1} of {list.length}
          </div>
          <h2 id="bt-tutorial-title" style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.2 }}>{step.title}</h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: muted(theme) }}>{step.body}</p>
        </div>

        <div role="tablist" aria-label="Tutorial steps" style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 22 }}>
          {list.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Step ${i + 1}: ${s.title}`}
              onClick={() => setIndex(i)}
              style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 4, border: "none", padding: 0, cursor: "pointer", backgroundColor: i === index ? pageText(theme) : (dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"), transition: "width .2s, background-color .2s" }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {isLast ? (
            <button type="button" onClick={closeTutorial} style={{ flex: 1, height: 48, borderRadius: 13, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), color: pageText(theme), fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Done
            </button>
          ) : !isFirst && (
            <button type="button" onClick={() => setIndex(i => i - 1)} style={{ flex: "0 0 auto", height: 48, padding: "0 20px", borderRadius: 13, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), color: pageText(theme), fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Back
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => (isLast ? startFirstTask() : setIndex(i => i + 1))}
            style={{ flex: 1, height: 48, borderRadius: 13, border: "none", backgroundColor: primaryBg, color: primaryFg, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em" }}
          >
            {isFirst ? "Show me around" : isLast ? (activeBoard?.type === "thought" ? "Add my first idea" : "Add my first task") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
