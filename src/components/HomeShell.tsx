
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { ThemeMode, BoardType, Importance, FlowMode, Board, Step, Note, Draft } from "@/lib/board";
import BobAgent, { type BobNewNote, type BobSettings } from "@/components/BobAgent";
import { useMutation, useQuery } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

const NOTE_PALETTE = [
  { name: "Pink",    light: "#f5c1e4", dark: "#6b2358", halo: "rgba(220,60,155,.24)",  swatch: "#df3eaa" },
  { name: "Purple",  light: "#f3e8ff", dark: "#2d0a4e", halo: "rgba(147,51,234,.22)",  swatch: "#9333ea" },
  { name: "Indigo",  light: "#e0e7ff", dark: "#1e1a4e", halo: "rgba(99,102,241,.22)",  swatch: "#6366f1" },
  { name: "Blue",    light: "#dbeafe", dark: "#0f1f4a", halo: "rgba(59,130,246,.20)",  swatch: "#3b82f6" },
  { name: "Teal",    light: "#cffafe", dark: "#052a3a", halo: "rgba(8,145,178,.20)",   swatch: "#0891b2" },
  { name: "Emerald", light: "#d1fae5", dark: "#052a1e", halo: "rgba(5,150,105,.20)",   swatch: "#059669" },
  { name: "Lime",    light: "#ecfccb", dark: "#1a2a04", halo: "rgba(132,204,22,.20)",  swatch: "#84cc16" },
  { name: "Orange",  light: "#fdf0e8", dark: "#2e1a0e", halo: "rgba(240,130,60,.20)",  swatch: "#f0854a" },
  { name: "Yellow",  light: "#fdf8e0", dark: "#2a2208", halo: "rgba(210,185,40,.20)",  swatch: "#d4a017" },
  { name: "Red",     light: "#fde8e8", dark: "#3a0e0e", halo: "rgba(220,50,50,.22)",   swatch: "#dc3535" },
];

// Task color palette: first 3 are priority defaults (red/orange/yellow), then idea colors minus orange/yellow/red
const TASK_PALETTE = [
  { light: "#fde8e8", dark: "#3d1515", halo: "rgba(215,60,60,.22)",   swatch: "#c03030" },  // red   (High default)
  { light: "#fdeede", dark: "#3a2210", halo: "rgba(220,130,40,.22)",  swatch: "#d07030" },  // orange (Med default)
  { light: "#fdfae0", dark: "#352c12", halo: "rgba(210,190,40,.22)",  swatch: "#c8960a" },  // yellow (Low default)
  ...NOTE_PALETTE.slice(0, 7), // pink → lime only (no orange/yellow/red overlap)
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Blend a hex color into a background hex — returns a fully opaque rgb string.
function blendHex(hex: string, bgHex: string, alpha: number): string {
  const pr = parseInt(hex.slice(1,3),16), pg = parseInt(hex.slice(3,5),16), pb = parseInt(hex.slice(5,7),16);
  const br = parseInt(bgHex.slice(1,3),16), bg2 = parseInt(bgHex.slice(3,5),16), bb = parseInt(bgHex.slice(5,7),16);
  const r = Math.round(pr*alpha + br*(1-alpha));
  const g = Math.round(pg*alpha + bg2*(1-alpha));
  const b = Math.round(pb*alpha + bb*(1-alpha));
  return `rgb(${r},${g},${b})`;
}

const PRIORITY_COLORS: Record<"High"|"Medium"|"Low", string> = { High: "#c03030", Medium: "#d07030", Low: "#c8960a" };

function paletteBg(colorIdx: number | undefined, theme: ThemeMode): string {
  const p = NOTE_PALETTE[(colorIdx ?? 0) % NOTE_PALETTE.length];
  return theme === "dark" ? p.dark : p.light;
}

function paletteHalo(colorIdx: number | undefined): string {
  return NOTE_PALETTE[(colorIdx ?? 0) % NOTE_PALETTE.length].halo;
}

function taskBg(importance: Importance | undefined, theme: ThemeMode): string {
  if (theme === "dark") {
    if (importance === "High") return "#3d1515";
    if (importance === "Medium") return "#3a2210";
    if (importance === "Low") return "#2e2a0a";
    return "#323232";
  }
  if (importance === "High") return "#fde8e8";
  if (importance === "Medium") return "#fdeede";
  if (importance === "Low") return "#fdfae0";
  return "#e8e8e8";
}

function taskHalo(importance: Importance | undefined): string {
  if (importance === "High") return "rgba(215,60,60,.22)";
  if (importance === "Medium") return "rgba(220,130,40,.22)";
  if (importance === "Low") return "rgba(210,190,40,.22)";
  return "rgba(140,140,140,.18)";
}

const BOARD_W = 6800;
const BOARD_H = 4200;
const NOTE_W = 228;
const NOTE_H = 138;

function noteCardWidth(title: string): number {
  const len = title.length;
  if (len <= 28) return 228;
  if (len <= 52) return 268;
  if (len <= 85) return 308;
  return 344;
}

function titleFontSize(title: string): number {
  const len = title.length;
  if (len <= 40) return 17;
  if (len <= 70) return 15;
  return 13;
}
const STEP_W = 210;
const STEP_H = 62;

const INITIAL_BOARDS: Board[] = [
  { id: "my-board", name: "My Board", type: "task" },
  { id: "my-thoughts", name: "My Ideas", type: "thought" },
];

// Convert yyyy-mm-dd ↔ mm-dd-yyyy for display
function isoToMDY(iso: string) {
  if (!iso || iso.length !== 10) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${months[m - 1]} ${d}, ${y}`;
}
function mdyToISO(mdy: string) {
  const clean = mdy.replace(/\//g, "-");
  const parts = clean.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function formatDate(date?: string) {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Collision-resistant integer ID: millisecond timestamp × 1000 + random 0–999.
// Safe up to year ~2255 within Number.MAX_SAFE_INTEGER.
function genId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function tomorrowStr() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function isDueToday(date?: string) {
  return !!date && date === todayStr();
}

function formatDateShort(date?: string) {
  if (!date) return "";
  if (date === todayStr()) return "Today";
  if (date === tomorrowStr()) return "Tomorrow";
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtTime(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return ` · ${h % 12 || 12}:${String(m).padStart(2, "0")}${ampm}`;
}

function nextBoardName(existing: Board[], type: BoardType) {
  const base = type === "task" ? "My Board" : "My Ideas";
  const count = existing.filter((b) => b.type === type).length;
  return count === 0 ? base : `${base} #${count + 1}`;
}

function estimateTime(title: string) {
  const t = title.toLowerCase();
  if (t.includes("essay") || t.includes("paper") || t.includes("thesis")) return 120;
  if (t.includes("report") || t.includes("assignment") || t.includes("write")) return 90;
  if (t.includes("exam") || t.includes("final") || t.includes("midterm")) return 120;
  if (t.includes("study") || t.includes("chapter") || t.includes("review")) return 75;
  if (t.includes("quiz") || t.includes("test")) return 60;
  if (t.includes("presentation") || t.includes("slides") || t.includes("deck")) return 90;
  if (t.includes("project") || t.includes("build") || t.includes("develop")) return 120;
  if (t.includes("code") || t.includes("program") || t.includes("implement")) return 90;
  if (t.includes("debug") || t.includes("fix") || t.includes("refactor")) return 60;
  if (t.includes("resume") || t.includes("cover letter") || t.includes("apply")) return 75;
  if (t.includes("read") || t.includes("article") || t.includes("book")) return 60;
  if (t.includes("research") || t.includes("investigate") || t.includes("explore")) return 90;
  if (t.includes("design") || t.includes("mockup") || t.includes("wireframe")) return 90;
  if (t.includes("plan") || t.includes("outline") || t.includes("brainstorm")) return 45;
  if (t.includes("email") || t.includes("reply") || t.includes("message")) return 20;
  if (t.includes("meeting") || t.includes("call") || t.includes("interview")) return 60;
  if (t.includes("cook") || t.includes("meal") || t.includes("bake")) return 60;
  if (t.includes("clean") || t.includes("organize") || t.includes("tidy")) return 60;
  if (t.includes("workout") || t.includes("exercise") || t.includes("gym")) return 60;
  if (t.includes("shop") || t.includes("buy") || t.includes("order")) return 30;
  return 60;
}

function buildBreakdown(title: string, body: string, total: number, variant = 0): Step[] {
  const t = (title + " " + body).toLowerCase().trim();
  let labels: string[];
  let weights: number[];
  const v = variant % 3;

  if (t.includes("essay") || t.includes("paper") || t.includes("thesis")) {
    const opts = [
      { l: total >= 90 ? ["Gather sources", "Outline", "Write intro", "Write body", "Write conclusion", "Revise & edit"] : total >= 60 ? ["Outline", "Research", "Draft", "Revise"] : ["Outline", "Draft", "Revise"], w: total >= 90 ? [0.1, 0.1, 0.15, 0.3, 0.15, 0.2] : total >= 60 ? [0.15, 0.2, 0.4, 0.25] : [0.2, 0.5, 0.3] },
      { l: total >= 60 ? ["Research & read", "Thesis & outline", "First draft", "Edit & polish"] : ["Outline", "Write", "Polish"], w: total >= 60 ? [0.25, 0.15, 0.4, 0.2] : [0.2, 0.5, 0.3] },
      { l: total >= 60 ? ["Brainstorm angle", "Outline structure", "Draft body", "Intro & conclusion", "Proofread"] : ["Outline", "Draft", "Proofread"], w: total >= 60 ? [0.1, 0.15, 0.4, 0.2, 0.15] : [0.2, 0.5, 0.3] },
    ];
    ({ l: labels, w: weights } = opts[v]); weights = (opts[v] as any).w;
  } else if (t.includes("exam") || t.includes("final") || t.includes("midterm")) {
    const opts = [
      { l: total >= 90 ? ["Review notes", "Study key concepts", "Practice problems", "Test yourself", "Review weak areas"] : ["Review notes", "Study concepts", "Practice & test"], w: total >= 90 ? [0.15, 0.25, 0.3, 0.2, 0.1] : [0.3, 0.45, 0.25] },
      { l: total >= 90 ? ["Skim all notes", "Deep dive topics", "Flashcard drill", "Mock test", "Fix gaps"] : ["Skim notes", "Deep study", "Self-test"], w: total >= 90 ? [0.1, 0.3, 0.25, 0.25, 0.1] : [0.25, 0.45, 0.3] },
      { l: total >= 90 ? ["Prioritize topics", "Review formulas", "Work examples", "Timed practice", "Weak spots"] : ["Prioritize", "Study", "Practice"], w: total >= 90 ? [0.1, 0.2, 0.3, 0.3, 0.1] : [0.2, 0.5, 0.3] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("study") || t.includes("chapter") || t.includes("review")) {
    const opts = [
      { l: total >= 60 ? ["Skim & preview", "Read actively", "Take notes", "Review & summarize"] : ["Read", "Take notes", "Review"], w: total >= 60 ? [0.1, 0.35, 0.3, 0.25] : [0.4, 0.35, 0.25] },
      { l: total >= 60 ? ["Preview headings", "Careful read", "Annotate key ideas", "Summarize"] : ["Read", "Annotate", "Summarize"], w: total >= 60 ? [0.1, 0.4, 0.25, 0.25] : [0.4, 0.35, 0.25] },
      { l: total >= 60 ? ["Set goals", "Active reading", "Note key points", "Quiz yourself"] : ["Read", "Note", "Quiz"], w: total >= 60 ? [0.05, 0.4, 0.3, 0.25] : [0.4, 0.35, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("presentation") || t.includes("slides") || t.includes("deck")) {
    const opts = [
      { l: total >= 75 ? ["Research topic", "Outline structure", "Build slides", "Add visuals", "Practice delivery"] : ["Outline", "Build slides", "Practice"], w: total >= 75 ? [0.2, 0.15, 0.3, 0.15, 0.2] : [0.2, 0.5, 0.3] },
      { l: total >= 75 ? ["Define message", "Draft outline", "Design slides", "Refine content", "Run through"] : ["Outline", "Design", "Practice"], w: total >= 75 ? [0.15, 0.15, 0.35, 0.15, 0.2] : [0.2, 0.5, 0.3] },
      { l: total >= 75 ? ["Gather content", "Story structure", "Build deck", "Visual polish", "Practice aloud"] : ["Plan", "Build", "Polish"], w: total >= 75 ? [0.2, 0.1, 0.3, 0.2, 0.2] : [0.2, 0.5, 0.3] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("code") || t.includes("program") || t.includes("implement") || t.includes("build") || t.includes("develop")) {
    const opts = [
      { l: total >= 90 ? ["Plan & design", "Set up", "Implement core", "Handle edge cases", "Test", "Review & clean up"] : total >= 60 ? ["Plan", "Implement", "Test", "Review"] : ["Plan", "Implement", "Test"], w: total >= 90 ? [0.12, 0.08, 0.35, 0.2, 0.15, 0.1] : total >= 60 ? [0.15, 0.45, 0.25, 0.15] : [0.2, 0.55, 0.25] },
      { l: total >= 90 ? ["Define requirements", "Architecture", "Core logic", "UI/integration", "Tests", "Cleanup"] : total >= 60 ? ["Design", "Build", "Test", "Polish"] : ["Design", "Build", "Test"], w: total >= 90 ? [0.1, 0.12, 0.35, 0.2, 0.13, 0.1] : total >= 60 ? [0.15, 0.45, 0.25, 0.15] : [0.2, 0.55, 0.25] },
      { l: total >= 90 ? ["Spec & pseudocode", "Scaffold", "Feature work", "Error handling", "Testing", "Review"] : total >= 60 ? ["Pseudocode", "Code", "Debug", "Refine"] : ["Spec", "Code", "Test"], w: total >= 90 ? [0.1, 0.1, 0.35, 0.18, 0.17, 0.1] : total >= 60 ? [0.1, 0.5, 0.25, 0.15] : [0.2, 0.55, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("debug") || t.includes("fix") || t.includes("refactor")) {
    const opts = [
      { l: ["Reproduce issue", "Identify root cause", "Fix", "Test fix"], w: [0.15, 0.3, 0.35, 0.2] },
      { l: ["Isolate bug", "Trace cause", "Patch", "Verify & test"], w: [0.2, 0.25, 0.35, 0.2] },
      { l: ["Read error logs", "Find source", "Apply fix", "Regression test"], w: [0.15, 0.3, 0.35, 0.2] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("research") || t.includes("investigate") || t.includes("explore")) {
    const opts = [
      { l: total >= 75 ? ["Define scope", "Find sources", "Read & annotate", "Synthesize findings", "Summarize"] : ["Find sources", "Read & note", "Synthesize"], w: total >= 75 ? [0.1, 0.2, 0.35, 0.25, 0.1] : [0.25, 0.45, 0.3] },
      { l: total >= 75 ? ["Frame question", "Search sources", "Deep read", "Extract insights", "Write up"] : ["Search", "Read & note", "Write up"], w: total >= 75 ? [0.1, 0.2, 0.35, 0.25, 0.1] : [0.2, 0.5, 0.3] },
      { l: total >= 75 ? ["Set objectives", "Collect data", "Analyze", "Draw conclusions", "Document"] : ["Collect", "Analyze", "Document"], w: total >= 75 ? [0.1, 0.25, 0.35, 0.2, 0.1] : [0.3, 0.4, 0.3] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("design") || t.includes("mockup") || t.includes("wireframe")) {
    const opts = [
      { l: ["Gather inspiration", "Wireframe", "Design", "Refine & review"], w: [0.15, 0.2, 0.45, 0.2] },
      { l: ["Moodboard", "Low-fi sketch", "High-fi design", "Iterate"], w: [0.15, 0.2, 0.45, 0.2] },
      { l: ["Define goals", "Rough layout", "Visual design", "Polish & export"], w: [0.1, 0.2, 0.5, 0.2] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("resume") || t.includes("cover letter") || t.includes("apply")) {
    const opts = [
      { l: total >= 60 ? ["Research role", "Update resume", "Write cover letter", "Review & submit"] : ["Update resume", "Write cover letter", "Submit"], w: total >= 60 ? [0.2, 0.3, 0.3, 0.2] : [0.35, 0.4, 0.25] },
      { l: total >= 60 ? ["Study job posting", "Tailor resume", "Draft cover letter", "Final review"] : ["Tailor resume", "Cover letter", "Submit"], w: total >= 60 ? [0.2, 0.3, 0.3, 0.2] : [0.35, 0.4, 0.25] },
      { l: total >= 60 ? ["List requirements", "Edit experience", "Personalize letter", "Proofread & send"] : ["Edit resume", "Write letter", "Submit"], w: total >= 60 ? [0.15, 0.3, 0.35, 0.2] : [0.35, 0.4, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("read") || t.includes("article") || t.includes("book")) {
    const opts = [
      { l: total >= 60 ? ["Skim headings", "Read section 1", "Read section 2", "Summarize key points"] : ["Read", "Take notes", "Summarize"], w: total >= 60 ? [0.1, 0.35, 0.35, 0.2] : [0.5, 0.3, 0.2] },
      { l: total >= 60 ? ["Preview structure", "Active reading", "Highlight & note", "Review takeaways"] : ["Read", "Highlight", "Review"], w: total >= 60 ? [0.1, 0.45, 0.25, 0.2] : [0.5, 0.3, 0.2] },
      { l: total >= 60 ? ["Set intention", "First read-through", "Re-read key parts", "Synthesize"] : ["Read", "Re-read", "Synthesize"], w: total >= 60 ? [0.05, 0.4, 0.3, 0.25] : [0.5, 0.3, 0.2] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("plan") || t.includes("outline") || t.includes("brainstorm")) {
    const opts = [
      { l: ["Brainstorm ideas", "Organize thoughts", "Draft plan", "Review & refine"], w: [0.25, 0.25, 0.3, 0.2] },
      { l: ["Dump all ideas", "Group themes", "Prioritize", "Write action plan"], w: [0.25, 0.2, 0.25, 0.3] },
      { l: ["Free-write", "Find patterns", "Structure plan", "Finalize"], w: [0.25, 0.2, 0.3, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("email") || t.includes("reply") || t.includes("message")) {
    labels = ["Draft", "Review & send"]; weights = [0.65, 0.35];
  } else if (t.includes("clean") || t.includes("organize") || t.includes("tidy")) {
    const opts = [
      { l: total >= 60 ? ["Clear surface", "Sort & declutter", "Clean", "Organize & put away"] : ["Declutter", "Clean", "Organize"], w: total >= 60 ? [0.2, 0.25, 0.3, 0.25] : [0.3, 0.4, 0.3] },
      { l: total >= 60 ? ["Remove trash", "Category sort", "Wipe & clean", "Store neatly"] : ["Sort", "Clean", "Store"], w: total >= 60 ? [0.15, 0.25, 0.35, 0.25] : [0.3, 0.4, 0.3] },
      { l: total >= 60 ? ["Purge extras", "Group by type", "Deep clean", "Final organize"] : ["Purge", "Clean", "Arrange"], w: total >= 60 ? [0.2, 0.2, 0.35, 0.25] : [0.3, 0.4, 0.3] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (total <= 20) {
    labels = ["Start", "Finish"]; weights = [0.6, 0.4];
  } else if (total <= 45) {
    const opts = [
      { l: ["Prepare", "Do", "Wrap up"], w: [0.2, 0.6, 0.2] },
      { l: ["Set up", "Execute", "Finish"], w: [0.2, 0.6, 0.2] },
      { l: ["Gather", "Work", "Review"], w: [0.2, 0.6, 0.2] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else {
    const opts = [
      { l: total >= 90 ? ["Prepare", "Start", "Do", "Review & finish"] : ["Prepare", "Do", "Review"], w: total >= 90 ? [0.15, 0.25, 0.4, 0.2] : [0.2, 0.55, 0.25] },
      { l: total >= 90 ? ["Set up", "Build momentum", "Deep work", "Wrap up"] : ["Set up", "Execute", "Wrap up"], w: total >= 90 ? [0.1, 0.2, 0.5, 0.2] : [0.15, 0.6, 0.25] },
      { l: total >= 90 ? ["Clarify", "Get started", "Main work", "Polish & close"] : ["Clarify", "Do", "Close"], w: total >= 90 ? [0.1, 0.2, 0.5, 0.2] : [0.15, 0.6, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  }

  const steps = labels.map((label, i) => ({
    id: genId(),
    title: label,
    minutes: Math.max(5, Math.round((total * weights[i]) / 5) * 5),
    done: false,
    x: 0,
    y: 0,
  }));

  const assigned = steps.reduce((sum, s) => sum + s.minutes, 0);
  const diff = total - assigned;
  if (diff !== 0) steps[steps.length - 1].minutes = Math.max(5, steps[steps.length - 1].minutes + diff);

  return steps;
}

function layoutWeb(noteX: number, noteY: number, steps: Step[]) {
  const cx = noteX + NOTE_W / 2 - STEP_W / 2;
  const cy = noteY + NOTE_H / 2 - STEP_H / 2;
  const spread = 260;
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
  return theme === "dark" ? "rgba(255,255,255,.032)" : "rgba(78,78,78,.065)";
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
    if (importance === "High") return "#3d1515";
    if (importance === "Medium") return "#3a2210";
    if (importance === "Low") return "#2e2a0a";
    return "#323232";
  }
  if (type === "thought") return "#e6e7ea";
  if (importance === "High") return "#fde8e8";
  if (importance === "Medium") return "#fdeede";
  if (importance === "Low") return "#fdfae0";
  return "#e8e8e8";
}
function noteText(theme: ThemeMode) {
  return theme === "dark" ? "#f5f5f2" : "#1f1d1a";
}
function noteSub(theme: ThemeMode) {
  return theme === "dark" ? "#d9d9d7" : "#696257";
}
function noteHalo(type: BoardType, importance: Importance | undefined) {
  if (type === "thought") return "rgba(255,255,255,.10)";
  if (importance === "High") return "rgba(215,60,60,.22)";
  if (importance === "Medium") return "rgba(220,130,40,.22)";
  if (importance === "Low") return "rgba(210,190,40,.22)";
  return "rgba(145,126,88,.12)";
}
function noteAccent(type: BoardType, importance: Importance | undefined) {
  if (type === "thought") return "rgba(130,130,200,.6)";
  if (importance === "High") return "#d94040";
  if (importance === "Medium") return "#d07030";
  if (importance === "Low") return "#c8b820";
  return "rgba(160,140,100,.45)";
}
function priorityColor(importance: Importance | undefined, theme: ThemeMode) {
  if (importance === "High") return theme === "dark" ? "#ff8080" : "#c03030";
  if (importance === "Medium") return theme === "dark" ? "#ffaa60" : "#b05a20";
  if (importance === "Low") return theme === "dark" ? "#e8d840" : "#8a7a10";
  return theme === "dark" ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.38)";
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
    borderRadius: 10,
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
function circleButton(theme: ThemeMode, size = 40): CSSProperties {
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

function BoardtivityLogo({ size = 32, dark = false }: { size?: number; dark?: boolean }) {
  const color = dark ? "#f5f5f2" : "#171613";
  return (
    <svg width={size} height={Math.round(size * 180 / 220)} viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <rect x="15" y="15" width="190" height="150" rx="28" ry="28" stroke={color} strokeWidth="9"/>
      <path d="M38 38 H58 M38 38 V58" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M182 38 H162 M182 38 V58" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M38 142 H58 M38 142 V122" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M182 142 H162 M182 142 V122" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <text x="110" y="118" fontFamily="Satoshi, Arial Black, sans-serif" fontWeight="900" fontSize="85" textAnchor="middle" fill={color}>B</text>
    </svg>
  );
}

function ThemeToggle({ theme, onToggle, size = 40 }: { theme: ThemeMode; onToggle: () => void; size?: number }) {
  const [flicker, setFlicker] = useState(false);
  function handleClick() {
    setFlicker(true);
    onToggle();
  }
  const isOn = theme === "light";
  const glowColor = isOn ? "rgba(255,210,60,.55)" : "rgba(255,255,255,.12)";
  return (
    <button
      onClick={handleClick}
      onAnimationEnd={() => setFlicker(false)}
      aria-label="Toggle theme"
      style={{
        ...circleButton(theme, size),
        boxShadow: isOn ? `0 0 0 1px ${border(theme)}, 0 0 10px rgba(255,200,40,.35)` : undefined,
      }}
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        className={flicker ? "bulb-flicker" : undefined}
      >
        {/* bulb globe */}
        <path d="M12 2C8.686 2 6 4.686 6 8c0 2.21 1.13 4.16 2.85 5.28V15a1 1 0 0 0 1 1h4.3a1 1 0 0 0 1-1v-1.72C16.87 12.16 18 10.21 18 8c0-3.314-2.686-6-6-6Z"
          fill={isOn ? "rgba(255,210,60,.95)" : "currentColor"}
          stroke={isOn ? "rgba(200,155,20,.7)" : "currentColor"}
          strokeWidth={isOn ? "0" : "0.5"}
          opacity={isOn ? 1 : 0.55}
        />
        {/* base bands */}
        <line x1="9.5" y1="17" x2="14.5" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={isOn ? 0.8 : 0.5}/>
        <line x1="10" y1="19" x2="14" y2="19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={isOn ? 0.8 : 0.5}/>
        <line x1="10.5" y1="21" x2="13.5" y2="21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={isOn ? 0.6 : 0.35}/>
        {/* glow rays — only when on */}
        {isOn && [[-5,-5],[5,-5],[0,-7],[-7,0],[7,0]].map(([dx,dy],i) => (
          <line key={i}
            x1={12+dx*0.55} y1={8+dy*0.55}
            x2={12+dx} y2={8+dy}
            stroke="rgba(255,220,60,.7)" strokeWidth="1.3" strokeLinecap="round"
          />
        ))}
      </svg>
    </button>
  );
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem("boardtivity");
    if (s) { const d = JSON.parse(s); if (d[key] !== undefined) return d[key] as T; }
  } catch {}
  return fallback;
}

export function HomeShell() {
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
  const focusPickerPrompts = [
    "How long are you committing to this?",
    "What's a realistic block of time for this?",
    "How long until you check back in?",
    "Set a timer — even 15 minutes counts.",
    "Pick a duration and lock in.",
    "How much time can you give this right now?",
    "Short burst or deep work — you decide.",
    "What does focused look like for this task?",
    "Name your time. Then own it.",
    "No distractions. How long?",
  ];
  const [focusPickerPromptIdx] = useState(() => Math.floor(Math.random() * 10));
  const [focusPicker, setFocusPicker] = useState<{ noteId: number; chain: boolean } | null>(null);
  const [focusCustomMin, setFocusCustomMin] = useState("");
  const [focusPickerSelected, setFocusPickerSelected] = useState<number | null>(null);
  const [focusPickerShowCustom, setFocusPickerShowCustom] = useState(false);
  // Session review (shown after focus ends)
  const [focusReview, setFocusReview] = useState<{ elapsedMin: number; noteId: number; stepId: number | null } | null>(null);
  const focusSessionStartRef = useRef<number>(0); // epoch ms when session started
  // Profile panel
  const [profileOpen, setProfileOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeType, setUpgradeType] = useState<BoardType>("task");
  const [limitReachedOpen, setLimitReachedOpen] = useState(false);
  const [showSubscribedModal, setShowSubscribedModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [namePromptFirst, setNamePromptFirst] = useState("");
  const [namePromptLast, setNamePromptLast] = useState("");
  const [namePromptSaving, setNamePromptSaving] = useState(false);
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
  const heroRef = useRef<HTMLDivElement | null>(null);
  const whyRef = useRef<HTMLDivElement | null>(null);
  const featuresRef = useRef<HTMLDivElement | null>(null);
  const pricingRef = useRef<HTMLDivElement | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackPosting, setFeedbackPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyPosting, setReplyPosting] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [whyVisible, setWhyVisible] = useState(false);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [pricingVisible, setPricingVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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
  const feedbackPosts = useQuery(api.feedback.list);
  const postFeedback = useMutation(api.feedback.post);
  const voteFeedback = useMutation(api.feedback.vote);
  const deleteFeedback = useMutation(api.feedback.remove);
  const replyFeedback = useMutation(api.feedback.reply);
  const deleteReplyFeedback = useMutation(api.feedback.removeReply);
  const { user, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { openSignIn, openSignUp, signOut } = useClerk();

  const [titleMounted, setTitleMounted] = useState(false);
  const [titleIn, setTitleIn] = useState(false);
  useEffect(() => {
    if (isSignedIn) {
      setTitleMounted(true);
      requestAnimationFrame(() => setTitleIn(true));
    } else {
      setTitleIn(false);
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
  // Mobile-specific refs (separate from desktop since only one settings panel is in the DOM at a time)
  const colorWheelMobileSingleRef = useRef<HTMLInputElement | null>(null);
  const colorWheelMobileHighRef   = useRef<HTMLInputElement | null>(null);
  const colorWheelMobileMedRef    = useRef<HTMLInputElement | null>(null);
  const colorWheelMobileLowRef    = useRef<HTMLInputElement | null>(null);
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
    return blendHex(c, boardTheme === "dark" ? "#17191d" : "#ffffff", boardTheme === "dark" ? 0.28 : 0.32);
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
  const getAccent = (importance: Importance | undefined) => {
    if (!importance || importance === "none") return muted(boardTheme);
    const custom = taskPaletteEntry(importance as "High"|"Medium"|"Low");
    return custom ? custom.swatch : PRIORITY_COLORS[importance as "High"|"Medium"|"Low"];
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

  function reorganizeBoard() {
    const boardNotes = notes.filter(n => n.boardId === activeBoardId);
    if (boardNotes.length === 0) return;
    const margin = 28;
    const colW = NOTE_W + margin;
    const colH = NOTE_H + margin;
    const cols = Math.max(1, Math.floor((BOARD_W - 80) / colW));
    setNotes(prev => prev.map(n => {
      if (n.boardId !== activeBoardId) return n;
      const idx = boardNotes.findIndex(bn => bn.id === n.id);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return { ...n, x: 80 + col * colW, y: 80 + row * colH };
    }));
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

  // True if boardState only has the two factory-default boards and no notes.
  // Guards against a previous bug that pushed INITIAL_BOARDS to Convex from a fresh device.
  function isCloudDefaultOnly(boardState: string): boolean {
    try {
      const d = JSON.parse(boardState) as { boards?: Board[]; notes?: Note[] };
      // Only check that there are no notes — don't rely on board count or order,
      // as users may have renamed or reordered the default boards.
      return (d.notes ?? []).length === 0;
    } catch { return false; }
  }

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
    return JSON.stringify({ boards, notes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom });
  }

  async function pushToCloud(retries = 3) {
    // Read from ref so stale closures (e.g. pagehide flush) still save the latest state
    const stateToSave = latestBoardStateRef.current || currentBoardState();
    lastSavedStateRef.current = stateToSave;
    setCloudSyncState("saving");
    for (let attempt = 0; attempt < retries; attempt++) {
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
        return;
      } catch (e) {
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, attempt)));
        } else {
          console.error("[Boardtivity] Convex save failed after retries:", e);
          setCloudSyncState("error");
        }
      }
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

    const cloudHasRealData = !isCloudDefaultOnly(savedBoard.boardState);
    const localHasRealData = notes.length > 0 || boards.some(b => b.id !== "my-board" && b.id !== "my-thoughts");

    if (!cloudHasRealData && localHasRealData) {
      // Convex has no real data but local does — push local to migrate it.
      pushToCloud();
      return;
    }

    if (!cloudHasRealData) {
      setCloudSyncState("synced");
      return;
    }

    // Cloud has real data — always apply it. Cloud is the sole source of truth.
    lastAppliedCloudAtRef.current = savedBoard.updatedAt;
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
      };
      if (Array.isArray(data.boards) && data.boards.length > 0) setBoards(data.boards);
      if (Array.isArray(data.notes)) {
        // Merge focus-tracking fields: never let a cloud sync reduce time already
        // logged locally. Last-write-wins on the blob would otherwise clobber
        // totalTimeSpent when a save from another session (e.g. desktop) arrives.
        setNotes(prev => data.notes!.map(cloudNote => {
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
        localStorage.setItem("boardtivity", JSON.stringify({ ...existing, theme, boardTheme, boards, notes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx }));
      } catch {}

      if (!convexReadyRef.current) return;

      if (justAppliedCloudRef.current) {
        // State changed because we applied cloud data — don't push it back.
        justAppliedCloudRef.current = false;
        return;
      }

      // User made a change — debounce-save to Convex
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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const observe = (el: HTMLDivElement | null, set: (v: boolean) => void) => {
      if (!el) return;
      const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) set(true); }, { threshold: 0.08 });
      obs.observe(el);
      return () => obs.disconnect();
    };
    const c0 = observe(heroRef.current, setHeroVisible);
    const c1 = observe(whyRef.current, setWhyVisible);
    const c2 = observe(featuresRef.current, setFeaturesVisible);
    const c3 = observe(pricingRef.current, setPricingVisible);
    return () => { c0?.(); c1?.(); c2?.(); c3?.(); };
  }, []);

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
        setUpgradeType(type);
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
      setNotes((prev) => prev.filter((n) => n.boardId !== boardId));
      setActiveBoardId(boardId);
    } else {
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

  function openBreakdownFromDetails(note: Note) {
    const total = note.minutes ?? estimateTime(note.title);
    const steps = buildBreakdown(note.title, note.body ?? "", total);
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

  function completeTask(noteId: number) {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, completed: true } : n)));
    cancelReminderMut({ noteId }).catch(() => {});
    setDetailNoteId(null);
  }

  function deleteTask(noteId: number) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId).map((n) => ({ ...n, linkedNoteIds: n.linkedNoteIds.filter((id) => id !== noteId) })));
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
    setNotes(prev => prev.filter(n => !idSet.has(n.id)));
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
    setFocusCustomMin("");
  }

  function commitFocus(noteId: number, chain: boolean, minutes: number) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    let stepId: number | undefined;
    if (chain && note.steps.length > 0) {
      const first = note.steps.find(s => !s.done);
      if (first) stepId = first.id;
    }
    const step = stepId ? note.steps.find(s => s.id === stepId) : null;
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

  async function logMobileFocusTime(noteId: number, stepId: number | null, markFinished: boolean) {
    const elapsedMin = Math.floor((Date.now() - focusSessionStartRef.current) / 60000);
    const _d = new Date();
    const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,"0")}-${String(_d.getDate()).padStart(2,"0")}`;
    const updatedNotes = notes.map(n => {
      if (n.id !== noteId) return n;
      let updatedSteps = n.steps;
      if (markFinished && stepId) {
        updatedSteps = n.steps.map(s => s.id === stepId ? { ...s, done: true } : s);
      }
      const allStepsDone = updatedSteps.length > 0 && updatedSteps.every(s => s.done);
      return {
        ...n,
        steps: updatedSteps,
        totalTimeSpent: (n.totalTimeSpent ?? 0) + elapsedMin,
        lastTackledAt: Date.now(),
        completed: markFinished && (!stepId || allStepsDone) ? true : n.completed,
      };
    });
    setNotes(updatedNotes);
    if (isSignedIn) {
      const freshState = JSON.stringify({ boards, notes: updatedNotes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom });
      latestBoardStateRef.current = freshState;
      pushToCloud();
      if (elapsedMin > 0) {
        await logFocusSession({ date: today, minutes: elapsedMin, taskCompleted: markFinished });
      }
    }
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

  return (
    <main style={{ minHeight: "100vh", fontFamily: "'Satoshi', Arial, sans-serif" }}>


      <section style={{ padding: isMobile ? "10px 18px 0" : "24px 48px 0" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <BoardtivityLogo size={isMobile ? 36 : 52} dark={theme === "dark"} />
            {!isSignedIn && <span style={{ fontSize: isMobile ? 15 : 17, letterSpacing: ".02em", color: pageText(theme), fontWeight: 700 }}>Boardtivity</span>}
          </div>
          {titleMounted && (
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: isMobile ? 13 : 20, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 800, color: pageText(theme), pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap" }}>
              Boardtivity
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isMobile && (
              <button
                onClick={() => feedbackRef.current?.scrollIntoView({ behavior: "smooth" })}
                style={{ ...buttonStyle(theme, false), fontSize: 13 }}
              >
                Feedback
              </button>
            )}
            {!isMobile && <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} size={40} />}
            {isSignedIn ? (
              <div ref={userMenuRef} style={{ position: "relative" }}>
                <button
                  onClick={() => { setUserMenuOpen(v => !v); setConfirmSignOut(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: pageText(theme), backgroundColor: panel(theme), border: `1px solid ${border(theme)}`, borderRadius: 999, padding: isMobile ? "0 10px" : "0 12px", height: isMobile ? 32 : 40, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {isMobile ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  ) : (
                    <>
                      {user?.firstName
                        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
                        : user?.emailAddresses?.[0]?.emailAddress}
                      {isPlus && (
                        <span style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.55)", background: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "3px 9px", lineHeight: 1 }}>
                          Plus
                        </span>
                      )}
                    </>
                  )}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: .4, transition: "transform .15s", transform: userMenuOpen ? "rotate(180deg)" : "none" }}>
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {userMenuOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 220, maxWidth: "calc(100vw - 32px)", backgroundColor: theme === "dark" ? "#1a1d22" : "#ffffff", border: `1px solid ${border(theme)}`, borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,.18)", padding: "6px", zIndex: 100, fontFamily: "inherit" }}>
                    {/* Account header */}
                    <div style={{ padding: "10px 12px 10px", borderBottom: `1px solid ${border(theme)}`, marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: pageText(theme), lineHeight: 1.2 }}>
                          {user?.firstName
                            ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
                            : "No name set"}
                        </div>
                        {isPlus && (
                          <span style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)", background: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "3px 9px", lineHeight: 1, flexShrink: 0 }}>
                            Plus
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: muted(theme) }}>
                        {user?.emailAddresses?.[0]?.emailAddress}
                      </div>
                    </div>
                    {/* Edit name */}
                    <button
                      onClick={() => { setUserMenuOpen(false); setNamePromptFirst(user?.firstName ?? ""); setNamePromptLast(user?.lastName ?? ""); setNamePromptOpen(true); }}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "none", fontSize: 13, color: pageText(theme), cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Edit name
                    </button>
                    <div style={{ height: 1, backgroundColor: border(theme), margin: "4px 0" }} />
                    {/* Sign out */}
                    {confirmSignOut === "header" ? (
                      <div style={{ padding: "4px 2px", display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: 12, color: muted(theme), padding: "4px 12px" }}>Are you sure?</div>
                        <button onClick={() => { setConfirmSignOut(null); setUserMenuOpen(false); signOut({ redirectUrl: "/" }); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "none", fontSize: 13, fontWeight: 700, color: "#c03030", cursor: "pointer", fontFamily: "inherit" }}>Yes, sign out</button>
                        <button onClick={() => setConfirmSignOut(null)} style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "none", fontSize: 13, color: muted(theme), cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmSignOut("header")} style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "none", fontSize: 13, fontWeight: 600, color: pageText(theme), cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => openSignIn()} style={buttonStyle(theme, false)}>Sign in</button>
            )}
          </div>
        </header>
      </section>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{
        maxWidth: 560, margin: "0 auto", padding: isMobile ? (isSignedIn ? "16px 0 0" : isSignedIn === false ? `48px 20px 48px` : "0") : `80px 24px ${isSignedIn && !showSyncPill ? "16px" : "72px"}`,
        textAlign: "center",
        opacity: heroVisible ? 1 : 0,
        transform: heroVisible ? "none" : "translateY(20px)",
        transition: "opacity .75s ease, transform .75s ease, padding-bottom .5s ease .7s",
      }}>
        {!isSignedIn && (
          <>
            <h1 style={{ margin: "0 0 24px", fontSize: "clamp(34px,4.8vw,64px)", lineHeight: 1.0, fontWeight: 900, letterSpacing: "-.055em", color: pageText(theme) }}>
              The <span className="hue-rotate">Board</span> and the Produc<span className="hue-rotate">tivity</span><br/>in one.
            </h1>
            <p style={{ margin: "0 auto 40px", maxWidth: 460, fontSize: 17, color: muted(theme), lineHeight: 1.82, opacity: .7 }}>
              Boardtivity is a freeform visual board for your tasks, ideas, and focus. Drag tasks anywhere, let AI break them down into steps, link ideas, chain subtasks, and lock into focus mode — all in one place.
            </p>
          </>
        )}

        {/* Inline email capture */}
        {isSignedIn ? (
          <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center", overflow: "hidden", maxHeight: showSyncPill ? 80 : 0, paddingBottom: showSyncPill ? 4 : 0, marginBottom: showSyncPill ? 0 : 0, transition: showSyncPill ? "none" : "max-height .5s ease .7s, padding-bottom .5s ease .7s" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, color: muted(theme),
              backgroundColor: theme === "dark" ? "rgba(111,196,107,.08)" : "rgba(60,190,90,.07)",
              border: `1px solid ${theme === "dark" ? "rgba(111,196,107,.2)" : "rgba(60,190,90,.2)"}`,
              borderRadius: 999, padding: "10px 20px",
              opacity: showSyncPill ? .75 : 0,
              transition: "opacity .3s ease",
              pointerEvents: "none",
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3.5" stroke="#6fc46b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Signed in — your board saves automatically and syncs across devices
            </div>
          </div>
        ) : clerkLoaded ? (
          <div style={{ maxWidth: 400, margin: "0 auto" }}>
            <div style={{ marginBottom: 12, fontSize: 13, color: muted(theme), opacity: .6, letterSpacing: "-.01em" }}>
              Sign up to sync your board across devices and access Boardtivity anywhere.
            </div>
            <button
              onClick={() => openSignUp()}
              style={{ width: "100%", height: 48, borderRadius: 10, border: "none", backgroundColor: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em" }}
            >
              Sign up free
            </button>
            <div style={{ marginTop: 10, fontSize: 12, color: muted(theme), opacity: .4 }}>Free · No credit card needed</div>
          </div>
        ) : null}
        </section>

      {!isSignedIn && (
        <section style={{ maxWidth: 1440, margin: "0 auto", padding: "0 48px 16px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: muted(theme), opacity: .55 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="7" y1="2" x2="7" y2="12"/><polyline points="3,8 7,12 11,8"/></svg>
            {isMobile ? "See your work" : "Try the board"}
          </div>
        </section>
      )}

      <section id="boardtivity-board" style={{ maxWidth: 1440, margin: "0 auto", padding: isMobile ? "0 0 24px" : "0 48px 24px" }}>
        {isMobile && (() => {
          const mobileBoardNotes = notes.filter(n => n.boardId === activeBoardId);
          const tasks = mobileBoardNotes.filter(n => n.type === "task");
          const thoughts = mobileBoardNotes.filter(n => n.type === "thought");
          const mobileActiveBoard = boards.find(b => b.id === activeBoardId);
          const isThoughtBoard = mobileActiveBoard?.type === "thought";

          const pendingTasks = tasks.filter(t => !(t.completed || (t.steps.length > 0 && t.steps.every(s => s.done))));
          const doneTasks = tasks.filter(t => t.completed || (t.steps.length > 0 && t.steps.every(s => s.done)));

          // Color helpers using page theme (not boardTheme)
          function mobileGetBg(importance: Importance | undefined) {
            if (!importance || importance === "none") return theme === "dark" ? "#1e2126" : "#f4f4f1";
            return blendHex(PRIORITY_COLORS[importance as "High"|"Medium"|"Low"], theme === "dark" ? "#12141a" : "#ffffff", theme === "dark" ? 0.26 : 0.30);
          }
          function mobileGetBorder(importance: Importance | undefined, done: boolean) {
            if (done) return `1.5px solid ${theme === "dark" ? "rgba(60,180,90,.30)" : "rgba(60,180,90,.45)"}`;
            if (!importance || importance === "none") return `1px solid ${border(theme)}`;
            return `1.5px solid ${hexToRgba(PRIORITY_COLORS[importance as "High"|"Medium"|"Low"], theme === "dark" ? 0.28 : 0.42)}`;
          }
          function mobileGetAccent(importance: Importance | undefined, done: boolean) {
            if (done) return "#3db83d";
            if (!importance || importance === "none") return theme === "dark" ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)";
            return PRIORITY_COLORS[importance as "High"|"Medium"|"Low"];
          }

          function dueLabelAndColor(dueDate: string | undefined, dueTime?: string): [string, string] {
            if (!dueDate) return ["", muted(theme)];
            const today = todayStr();
            const tomorrow = tomorrowStr();
            const timeStr = fmtTime(dueTime);
            if (dueDate < today) return ["Overdue",  theme === "dark" ? "#ff6666" : "#c03030"];
            if (dueDate === today) return [`Due Today${timeStr}`, theme === "dark" ? "#ffb347" : "#b86800"];
            if (dueDate === tomorrow) return [`Tomorrow${timeStr}`, muted(theme)];
            const [y, m, d] = dueDate.split("-").map(Number);
            const due = new Date(y, m - 1, d);
            return [`${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}${timeStr}`, muted(theme)];
          }

          function mobileCreateNote() {
            if (!mobileAddTitle.trim()) return;
            if (mobileAddMode === "task" && !mobileAddDueDate) return;
            const id = genId();
            const now = new Date().toISOString();
            // Spawn at viewport center (or board center if no viewport), non-overlapping
            const viewport = viewportRef.current;
            const vpCx = viewport ? (viewport.clientWidth  / 2 - pan.x) / scale - NOTE_W / 2 : BOARD_W / 2;
            const vpCy = viewport ? (viewport.clientHeight / 2 - pan.y) / scale - NOTE_H / 2 : BOARD_H / 2;
            const boardNotes = notes.filter(n => n.boardId === activeBoardId);
            const { x: spawnX, y: spawnY } = findFreeSpot(boardNotes, vpCx, vpCy);
            const newNote = {
              id, boardId: activeBoardId,
              type: mobileAddMode === "thought" ? "thought" : "task",
              title: mobileAddTitle.trim(), body: mobileAddBody.trim(),
              importance: mobileAddMode === "task" ? mobileAddImportance : "none",
              dueDate: (mobileAddMode === "task" && mobileAddDueDate) ? mobileAddDueDate : undefined,
              dueTime: (mobileAddMode === "task" && mobileAddDueTime) ? mobileAddDueTime : undefined,
              createdAt: now, completed: false,
              x: spawnX, y: spawnY,
              steps: [], showFlow: false, flowMode: "web", linkedNoteIds: [],
              colorIdx: mobileAddMode === "thought"
                ? (mobileAddColorIdx !== undefined ? mobileAddColorIdx : (thoughtColorMode === "random" ? Math.floor(Math.random() * NOTE_PALETTE.length) : thoughtFixedColorIdx))
                : undefined,
            } as Note;
            const updatedNotes = [...notes, newNote];
            setNotes(updatedNotes);
            if (mobileAddMode === "thought" && mobileAddRemindIn !== null) {
              setReminderMut({ noteId: id, noteTitle: mobileAddTitle.trim(), delayMs: mobileAddRemindIn }).catch(() => {});
            }
            scheduleDueDateReminder(id, mobileAddTitle.trim(), mobileAddMode === "task" ? mobileAddDueDate : undefined, mobileAddMode === "task" ? mobileAddDueTime : undefined);
            setMobileAddTitle(""); setMobileAddBody(""); setMobileAddImportance("Low"); setMobileAddDueDate(""); setMobileAddDueTime(""); setMobileAddMode(null);
            setMobileAddColorIdx(undefined); setMobileAddRemindIn(null);
            // Build state with new note immediately and push — don't wait for debounce or effect timing
            if (isSignedIn) {
              const freshState = JSON.stringify({ boards, notes: updatedNotes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom });
              latestBoardStateRef.current = freshState;
              pushToCloud();
            }
          }

          // Plain render functions (not React components) so focus state updates work correctly
          const dotBtn: CSSProperties = { flexShrink: 0, width: 28, height: 28, borderRadius: 8, backgroundColor: "transparent", border: `1px solid ${border(theme)}`, color: muted(theme), fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: ".05em" };

          function openEdit(note: Note) {
            setMobileActionNoteId(note.id);
            setMobileEditTitle(note.title);
            setMobileEditDueDate(note.dueDate ?? "");
            setMobileEditDueTime(note.dueTime ?? "");
            setMobileEditImportance(note.importance ?? "none");
            setMobileEditMinutes(note.minutes != null ? String(note.minutes) : "");
            setMobileEditSteps(note.steps.map(s => ({ id: s.id, title: s.title, minutes: s.minutes ?? 25 })));
            setMobileEditColorIdx(note.colorIdx);
          }

          function renderTaskCard(note: Note) {
            const isDone = note.completed || (note.steps.length > 0 && note.steps.every(s => s.done));
            const imp = note.importance === "none" ? undefined : note.importance;
            const bg = isDone ? (theme === "dark" ? "#0d2218" : "#eef9f2") : mobileGetBg(imp);
            const today = todayStr();
            const isOverdue = !isDone && !!note.dueDate && note.dueDate < today;
            const dueToday = !isDone && note.dueDate === today;
            const bord = isOverdue
              ? "1.5px solid rgba(210,50,50,.65)"
              : dueToday
              ? "1.5px solid rgba(200,130,20,.6)"
              : mobileGetBorder(imp, isDone);
            const [dueLabel, dueColor] = dueLabelAndColor(note.dueDate, note.dueTime);
            const isExpanded = mobileExpandedIds.has(note.id);
            const impColor = priorityColor(imp, theme);
            const doneDots = note.steps.filter(s => s.done).length;
            const hasSteps = note.steps.length > 0;
            const taskMins = note.steps.length > 0
              ? note.steps.filter(s => !s.done).reduce((sum, s) => sum + (s.minutes ?? 25), 0)
              : (note.minutes ?? estimateTime(note.title));
            const timeLabel = taskMins >= 60 ? `${Math.floor(taskMins/60)}h${taskMins%60 ? ` ${taskMins%60}m` : ""}` : `${taskMins}m`;

            return (
              <div key={note.id} style={{ borderRadius: 14, backgroundColor: bg, border: bord, marginBottom: 9, ...(isOverdue ? { boxShadow: "0 0 0 3px rgba(210,50,50,.13)", animation: "overduePulse 1.6s ease-in-out infinite" } : dueToday ? { boxShadow: "0 0 0 3px rgba(200,130,20,.12)" } : {}) }}>
                {/* Top meta row */}
                <div style={{ padding: "10px 12px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ flex: 1, fontSize: 10, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: isDone ? (theme === "dark" ? "rgba(100,220,120,.8)" : "rgba(30,120,60,.7)") : (imp ? impColor : muted(theme)), opacity: isDone ? 1 : 0.75 }}>
                    {isDone ? "Completed" : (imp ? `${imp} priority` : "Task")}
                  </span>
                  {!isDone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {dueLabel && <span style={{ fontSize: 10, fontWeight: 600, color: dueColor, backgroundColor: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", border: `1px solid ${dueColor}44`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" }}>{dueLabel}</span>}
                    </div>
                  )}
                  <button type="button" onClick={() => openEdit(note)} style={{ ...dotBtn, marginLeft: 2 }}>···</button>
                </div>
                {/* Title + Focus */}
                <div style={{ padding: "4px 14px 13px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: isDone ? muted(theme) : pageText(theme), textDecoration: isDone ? "line-through" : "none", lineHeight: 1.3, wordBreak: "break-word", opacity: isDone ? .5 : 1 }}>{note.title}</div>
                    {hasSteps && (
                      <button
                        type="button"
                        onClick={() => setMobileExpandedIds(prev => { const n = new Set(prev); n.has(note.id) ? n.delete(note.id) : n.add(note.id); return n; })}
                        style={{ background: "none", border: "none", padding: "6px 0 0", cursor: "pointer", display: "flex", gap: 5, alignItems: "center" }}
                      >
                        {note.steps.map(s => (
                          <span key={s.id} style={{ width: 8, height: 8, borderRadius: "50%", border: s.done ? "1px solid #3d8b40" : `1px solid ${theme === "dark" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.18)"}`, backgroundColor: s.done ? "#6fc46b" : "transparent", display: "inline-block", flexShrink: 0 }} />
                        ))}
                        <span style={{ fontSize: 11, color: muted(theme), opacity: .6, marginLeft: 2 }}>{doneDots}/{note.steps.length}</span>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .18s", opacity: .45 }}>
                          <polyline points="2,3.5 5,6.5 8,3.5" stroke={pageText(theme)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => startFocus(note.id, note.steps.length > 0)}
                      style={{ flexShrink: 0, height: 34, borderRadius: 999, backgroundColor: theme === "dark" ? "#111315" : "#171613", color: "#f7f8fb", border: "none", padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginTop: 2 }}
                    >
                      Focus
                    </button>
                  )}
                </div>
                {/* Expanded subtasks */}
                {isExpanded && hasSteps && (
                  <div style={{ borderTop: `1px solid ${border(theme)}`, padding: "10px 14px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {note.steps.map(step => (
                      <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", border: step.done ? "1px solid #3d8b40" : `1px solid ${theme === "dark" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.22)"}`, backgroundColor: step.done ? "#6fc46b" : "transparent", display: "inline-block", flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: step.done ? muted(theme) : pageText(theme), opacity: step.done ? .5 : 1, textDecoration: step.done ? "line-through" : "none" }}>{step.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          function renderIdeaCard(note: Note) {
            const idx = note.colorIdx ?? 0;
            const palette = NOTE_PALETTE[idx % NOTE_PALETTE.length];
            const bg = theme === "dark" ? palette.dark : palette.light;
            const bord = palette.halo.replace(/[\d.]+\)$/, theme === "dark" ? "0.45)" : "0.55)");
            const createdStr = note.createdAt ? new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
            return (
              <div key={note.id} style={{ borderRadius: 14, backgroundColor: bg, border: `1.5px solid ${bord}`, marginBottom: 9, padding: "11px 14px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: palette.swatch, opacity: .75 }}>Idea</div>
                      {createdStr && <div style={{ fontSize: 10, color: muted(theme), opacity: .45 }}>· {createdStr}</div>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: pageText(theme), lineHeight: 1.35, wordBreak: "break-word" }}>{note.title}</div>
                    {note.body && <div style={{ fontSize: 13, color: muted(theme), marginTop: 5, lineHeight: 1.5, opacity: .7 }}>{note.body}</div>}
                  </div>
                  <button onClick={() => openEdit(note)} style={{ ...dotBtn, marginTop: 2 }}>···</button>
                </div>
              </div>
            );
          }

          // Edit action sheet for currently open note
          const actionNote = mobileActionNoteId !== null ? notes.find(n => n.id === mobileActionNoteId) : null;

          return (
            <div style={{ padding: "0 0 100px" }}>
              {/* BOB — above board switcher */}
              <div style={{ padding: "8px 16px 4px" }}>
                <BobAgent
                  theme={theme}
                  notes={notes}
                  activeBoardId={activeBoardId}
                  onSweep={handleBobSweep}
                  onAddNote={handleBobAddNote}
                  onEditNote={handleBobEditNote}
                  onDeleteNotes={handleBobDeleteNotes}
                  onHighlightNotes={handleBobHighlightNotes}
                  onLaunchFocus={handleBobLaunchFocus}
                  onSaveUndo={handleBobSaveUndo}
                  onUndo={handleBobUndo}
                  onSetIdeaColor={handleBobSetIdeaColor}
                  onConfigureTaskColors={handleBobConfigureTaskColors}
                  onConfigureBoard={handleBobConfigureBoard}
                  isAdmin={!!isAdmin}
                  userInfo={bobUserInfo}
                  autoSend={bobAutoSend}
                  settings={{ taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, thoughtColorMode, thoughtFixedColorIdx, boardTheme: theme, boardGrid, activeBoardType: activeBoard?.type as "task" | "thought" | undefined, activeBoardName: activeBoard?.name, boards: boards.map(b => ({ id: b.id, name: b.name, type: b.type as "task" | "thought" })) }}
                  focusStats={focusStatsData ?? undefined}
                  mobile
                />
              </div>

              {/* Board switcher */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, paddingTop: 8, paddingLeft: 16, paddingRight: 16, scrollbarWidth: "none" }}>
                {boards.map(b => {
                  const isActive = b.id === activeBoardId;
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        if (isActive) { setMobileBoardActionId(b.id); setMobileBoardRename(b.name); setMobileBoardRenaming(false); }
                        else setActiveBoardId(b.id);
                      }}
                      style={{ flexShrink: 0, height: 34, borderRadius: 999, border: isActive ? "none" : `1px solid ${border(theme)}`, backgroundColor: isActive ? (theme === "dark" ? "#f5f5f2" : "#171613") : (theme === "dark" ? "#1e2126" : "#ffffff"), color: isActive ? (theme === "dark" ? "#171613" : "#f7f8fb") : pageText(theme), padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {b.name}
                    </button>
                  );
                })}
                <button
                  onClick={() => setMobileBoardTypePicker(true)}
                  style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 999, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#1e2126" : "#ffffff", color: pageText(theme), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                {isSignedIn && (
                  <button
                    onClick={() => setProfileOpen(true)}
                    style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 999, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#1e2126" : "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                    aria-label="Focus stats"
                  >
                    {(focusStatsData?.currentStreak ?? 0) > 0
                      ? <svg width="10" height="13" viewBox="0 0 11 15" fill="none" overflow="visible" style={{ animation: "boltSpark 1.4s ease-in-out infinite" }}><path d="M7 1L1 8.5h4L3.5 14 10 6H6L7 1Z" fill="#facc15"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={muted(theme)} strokeWidth="1.4"/><path d="M7 4v3l2 1.5" stroke={muted(theme)} strokeWidth="1.3" strokeLinecap="round"/></svg>
                    }
                  </button>
                )}
                <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} size={34} />
                {isSignedIn && (
                  <button
                    onClick={() => setMobileSettingsOpen(true)}
                    style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 999, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#1e2126" : "#ffffff", color: muted(theme), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Board type picker sheet */}
              {mobileBoardTypePicker && (
                <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end" }} onClick={() => setMobileBoardTypePicker(false)}>
                  <div style={{ width: "100%", backgroundColor: theme === "dark" ? "#1a1d22" : "#ffffff", borderRadius: "20px 20px 0 0", padding: "20px 16px 36px", display: "flex", flexDirection: "column", gap: 10 }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: muted(theme), marginBottom: 4, textAlign: "center" }}>New Board</div>
                    <button onClick={() => { addBoard("task"); setMobileBoardTypePicker(false); }} style={{ height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#23262b" : "#f4f4f1", color: pageText(theme), fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Task Board</button>
                    <button onClick={() => { addBoard("thought"); setMobileBoardTypePicker(false); }} style={{ height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#23262b" : "#f4f4f1", color: pageText(theme), fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Idea Board</button>
                    <button onClick={() => setMobileBoardTypePicker(false)} style={{ height: 44, borderRadius: 12, border: "none", background: "none", color: muted(theme), fontSize: 14, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Board action sheet (rename / delete) */}
              {mobileBoardActionId && (() => {
                const actionBoard = boards.find(b => b.id === mobileBoardActionId);
                if (!actionBoard) return null;
                return (
                  <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end" }} onClick={() => { setMobileBoardActionId(null); setMobileBoardRenaming(false); }}>
                    <div style={{ width: "100%", backgroundColor: theme === "dark" ? "#1a1d22" : "#ffffff", borderRadius: "20px 20px 0 0", padding: "20px 16px 36px", display: "flex", flexDirection: "column", gap: 10 }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: muted(theme), marginBottom: 4, textAlign: "center" }}>{actionBoard.name}</div>
                      {mobileBoardRenaming ? (
                        <>
                          <input
                            autoFocus
                            value={mobileBoardRename}
                            onChange={e => setMobileBoardRename(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && mobileBoardRename.trim()) { setBoards(bs => bs.map(b => b.id === mobileBoardActionId ? { ...b, name: mobileBoardRename.trim() } : b)); setMobileBoardActionId(null); setMobileBoardRenaming(false); } if (e.key === "Escape") { setMobileBoardActionId(null); setMobileBoardRenaming(false); } }}
                            style={{ height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#23262b" : "#f4f4f1", color: pageText(theme), fontSize: 15, padding: "0 16px", outline: "none" }}
                            placeholder="Board name"
                          />
                          <button
                            onClick={() => { if (mobileBoardRename.trim()) { setBoards(bs => bs.map(b => b.id === mobileBoardActionId ? { ...b, name: mobileBoardRename.trim() } : b)); setMobileBoardActionId(null); setMobileBoardRenaming(false); } }}
                            disabled={!mobileBoardRename.trim()}
                            style={{ height: 48, borderRadius: 12, border: "none", backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: mobileBoardRename.trim() ? 1 : 0.4 }}
                          >Save</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setMobileBoardRenaming(true)} style={{ height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#23262b" : "#f4f4f1", color: pageText(theme), fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Rename</button>
                          {boards.length > 1 && (
                            <button onClick={() => { deleteBoard(mobileBoardActionId); setMobileBoardActionId(null); }} style={{ height: 48, borderRadius: 12, border: `1px solid rgba(200,50,50,.35)`, backgroundColor: theme === "dark" ? "rgba(200,50,50,.12)" : "rgba(200,50,50,.07)", color: theme === "dark" ? "#ff8080" : "#c03030", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Delete Board</button>
                          )}
                        </>
                      )}
                      <button onClick={() => { setMobileBoardActionId(null); setMobileBoardRenaming(false); }} style={{ height: 44, borderRadius: 12, border: "none", background: "none", color: muted(theme), fontSize: 14, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                );
              })()}

              {/* Not signed in hint — only show once Clerk has confirmed the session state */}
              {clerkLoaded && !isSignedIn && (
                <div style={{ marginBottom: 20, marginLeft: 16, marginRight: 16, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: paper(theme), padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, backgroundColor: theme === "dark" ? "#23262b" : "#f0f0ee", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={muted(theme)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".7">
                      <rect x="1.5" y="3" width="15" height="10" rx="1.5"/>
                      <line x1="5.5" y1="16" x2="12.5" y2="16"/>
                      <line x1="9" y1="13" x2="9" y2="16"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: pageText(theme), marginBottom: 2 }}>See the full board on iPad or Mac</div>
                    <div style={{ fontSize: 12, color: muted(theme), opacity: .7, lineHeight: 1.4 }}>Sign in on a larger screen for the interactive board.</div>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {isSignedIn && cloudSyncState === "loading" && (
                <div style={{ textAlign: "center", padding: "52px 0", color: muted(theme), fontSize: 13, opacity: .5 }}>Loading your boards…</div>
              )}

              {/* Filter + sort bar (task boards only) */}
              {!isThoughtBoard && !(isSignedIn && cloudSyncState === "loading") && (
                <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", alignItems: "center", overflowX: "auto", scrollbarWidth: "none" }}>
                  {(["all", "High", "Medium", "Low"] as const).map(f => {
                    const active = mobileFilterPriority === f;
                    const col = f === "all" ? muted(theme) : PRIORITY_COLORS[f as "High"|"Medium"|"Low"];
                    return (
                      <button type="button" key={f} onClick={() => setMobileFilterPriority(f)}
                        style={{ flexShrink: 0, height: 28, borderRadius: 999, border: active ? `1.5px solid ${col}` : `1px solid ${border(theme)}`, backgroundColor: active && f !== "all" ? hexToRgba(PRIORITY_COLORS[f as "High"|"Medium"|"Low"], 0.12) : "transparent", color: active ? col : muted(theme), fontSize: 11, fontWeight: 700, padding: "0 11px", cursor: "pointer" }}
                      >{f === "all" ? "All" : f}</button>
                    );
                  })}
                  <div style={{ flex: 1 }} />
                  <button type="button" onClick={() => setMobileSortDate(s => !s)}
                    style={{ flexShrink: 0, height: 28, borderRadius: 999, border: mobileSortDate ? `1.5px solid ${muted(theme)}` : `1px solid ${border(theme)}`, backgroundColor: "transparent", color: muted(theme), fontSize: 11, fontWeight: 700, padding: "0 11px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="3" x2="9" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="2.5" y1="5.5" x2="7.5" y2="5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="4" y1="8" x2="6" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    {mobileSortDate ? "By date" : "Default"}
                  </button>
                </div>
              )}

              <div style={{ padding: "0 16px", display: isSignedIn && cloudSyncState === "loading" ? "none" : undefined }}>
                {!isThoughtBoard && (() => {
                  let filtered = pendingTasks.filter(t =>
                    mobileFilterPriority === "all" || (t.importance === mobileFilterPriority)
                  );
                  if (mobileSortDate) {
                    filtered = [...filtered].sort((a, b) => {
                      if (!a.dueDate && !b.dueDate) return 0;
                      if (!a.dueDate) return 1;
                      if (!b.dueDate) return -1;
                      return a.dueDate < b.dueDate ? -1 : 1;
                    });
                  }
                  return (
                    <>
                      {filtered.length === 0 && doneTasks.length === 0 && (
                        <div style={{ textAlign: "center", padding: "52px 0 20px", color: muted(theme), fontSize: 14, opacity: .45 }}>
                          {pendingTasks.length === 0 ? "No tasks yet — tap + to add one" : "No tasks match this filter"}
                        </div>
                      )}
                      {filtered.map(note => renderTaskCard(note))}
                      {doneTasks.length > 0 && mobileFilterPriority === "all" && (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: muted(theme), opacity: .4, marginTop: filtered.length > 0 ? 20 : 0, marginBottom: 10 }}>Completed</div>
                          {doneTasks.map(note => renderTaskCard(note))}
                        </>
                      )}
                    </>
                  );
                })()}
                {isThoughtBoard && (
                  <>
                    {thoughts.length === 0 && (
                      <div style={{ textAlign: "center", padding: "52px 0 20px", color: muted(theme), fontSize: 14, opacity: .45 }}>No ideas yet — tap + to add one</div>
                    )}
                    {thoughts.map(note => renderIdeaCard(note))}
                  </>
                )}
              </div>

              {/* Quick-add bottom sheet */}
              {/* Mobile settings sheet */}
              {mobileSettingsOpen && (
                <div style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", flexDirection: "column" }} onClick={() => setMobileSettingsOpen(false)}>
                  <div style={{ position: "relative", flex: 1, backgroundColor: theme === "dark" ? "#13151a" : "#f4f4f1", overflowY: "auto", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: `1px solid ${border(theme)}`, position: "sticky", top: 0, backgroundColor: theme === "dark" ? "#13151a" : "#f4f4f1", zIndex: 1 }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: pageText(theme) }}>Settings</span>
                      <button onClick={() => setMobileSettingsOpen(false)} style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${border(theme)}`, background: "transparent", color: pageText(theme), fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>

                    <div style={{ padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 28 }}>

                      {/* Theme */}
                      <div>
                        <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Appearance</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 15, color: pageText(theme) }}>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
                          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: theme === "dark" ? "#4a9eff" : "rgba(0,0,0,.12)", position: "relative", transition: "background-color .18s" }}>
                            <span style={{ position: "absolute", top: 4, left: theme === "dark" ? 23 : 4, width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff", transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                          </button>
                        </div>
                      </div>

                      {/* Board background */}
                      <div>
                        <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Board Background</div>
                        <div style={{ display: "flex", gap: 6, padding: 3, backgroundColor: theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 10, border: `1px solid ${border(theme)}` }}>
                          {(["grid", "dots", "blank"] as const).map(id => {
                            const label = id === "grid" ? "Grid" : id === "dots" ? "Dots" : "Blank";
                            const active = boardGrid === id;
                            return (
                              <button key={id} onClick={() => setBoardGrid(id)} style={{ flex: 1, height: 44, borderRadius: 8, border: "none", backgroundColor: active ? (theme === "dark" ? "rgba(255,255,255,.12)" : "#ffffff") : "transparent", boxShadow: active ? "0 1px 4px rgba(0,0,0,.12)" : "none", color: active ? pageText(theme) : muted(theme), cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, transition: "background-color .12s" }}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Idea colors */}
                      <div>
                        <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Idea Colors</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", alignItems: "center", padding: 6, margin: -6 }}>
                          {/* Rainbow / randomize */}
                          <button onClick={() => setThoughtColorMode("random")} style={{
                            flexShrink: 0, width: 22, height: 22, borderRadius: 6, cursor: "pointer", padding: 0, border: "none",
                            background: "conic-gradient(hsl(0,100%,55%), hsl(30,100%,55%), hsl(60,100%,55%), hsl(90,100%,55%), hsl(120,100%,55%), hsl(150,100%,55%), hsl(180,100%,55%), hsl(210,100%,55%), hsl(240,100%,55%), hsl(270,100%,55%), hsl(300,100%,55%), hsl(330,100%,55%), hsl(360,100%,55%))",
                            boxShadow: thoughtColorMode === "random" ? `0 0 0 2.5px ${pageText(theme)}, 0 0 0 4.5px ${theme === "dark" ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.2)"}` : "none",
                            overflow: "hidden",
                          }} title="Randomize color" />
                          {NOTE_PALETTE.map((p, i) => (
                            <button key={i} onClick={() => { setThoughtColorMode("fixed"); setThoughtFixedColorIdx(i); }} style={{
                              flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                              border: (thoughtColorMode === "fixed" && thoughtFixedColorIdx === i) ? `2.5px solid ${pageText(theme)}` : "2.5px solid transparent",
                              outline: (thoughtColorMode === "fixed" && thoughtFixedColorIdx === i) ? `2px solid ${p.swatch}` : "none",
                              outlineOffset: 2, backgroundColor: p.swatch, cursor: "pointer", padding: 0,
                            }} title={p.name} />
                          ))}
                        </div>
                        <p style={{ margin: "8px 0 0", fontSize: 11, color: muted(theme), lineHeight: 1.5 }}>
                          {thoughtColorMode === "random" ? "New ideas get a random color each time." : `New ideas default to ${NOTE_PALETTE[thoughtFixedColorIdx]?.name}.`}
                        </p>
                      </div>

                      {/* Task colors */}
                      <div>
                        <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Task Colors</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", gap: 6, padding: 3, backgroundColor: theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 10, border: `1px solid ${border(theme)}` }}>
                            {(["priority", "single"] as const).map(m => (
                              <button key={m} onClick={() => setTaskColorMode(m)} style={{ flex: 1, height: 34, borderRadius: 8, border: "none", backgroundColor: taskColorMode === m ? (theme === "dark" ? "rgba(255,255,255,.12)" : "#ffffff") : "transparent", boxShadow: taskColorMode === m ? "0 1px 4px rgba(0,0,0,.12)" : "none", color: taskColorMode === m ? pageText(theme) : muted(theme), fontSize: 13, fontWeight: taskColorMode === m ? 700 : 500, cursor: "pointer", transition: "background-color .12s" }}>
                                {m === "priority" ? "By Priority" : "One Color"}
                              </button>
                            ))}
                          </div>
                          {taskColorMode === "priority" ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {(["High", "Medium", "Low"] as const).map(lvl => {
                                const currentIdx = lvl === "High" ? taskHighColorIdx : lvl === "Medium" ? taskMedColorIdx : taskLowColorIdx;
                                const setter = lvl === "High" ? setTaskHighColorIdx : lvl === "Medium" ? setTaskMedColorIdx : setTaskLowColorIdx;
                                const customVal = lvl === "High" ? taskHighCustom : lvl === "Medium" ? taskMedCustom : taskLowCustom;
                                const setCustom = lvl === "High" ? setTaskHighCustom : lvl === "Medium" ? setTaskMedCustom : setTaskLowCustom;
                                const wheelRef = lvl === "High" ? colorWheelMobileHighRef : lvl === "Medium" ? colorWheelMobileMedRef : colorWheelMobileLowRef;
                                return (
                                  <div key={lvl}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: pageText(theme), marginBottom: 6 }}>{lvl} priority</div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: 6, margin: -6 }}>
                                      {TASK_PALETTE.map((p, i) => (
                                        <button key={i} onClick={() => setter(i)} style={{
                                          width: 22, height: 22, borderRadius: "50%",
                                          border: (currentIdx === i && currentIdx < TASK_PALETTE.length) ? `2.5px solid ${pageText(theme)}` : "2.5px solid transparent",
                                          outline: (currentIdx === i && currentIdx < TASK_PALETTE.length) ? `2px solid ${p.swatch}` : "none",
                                          outlineOffset: 2, backgroundColor: p.swatch, cursor: "pointer", padding: 0,
                                        }} />
                                      ))}
                                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                        <button
                                          onClick={() => { setter(TASK_PALETTE.length); wheelRef.current?.click(); }}
                                          title="Pick custom color"
                                          style={{
                                            position: "relative", width: 22, height: 22, borderRadius: 6, cursor: "pointer", padding: 0, border: "none", flexShrink: 0,
                                            background: customVal ? customVal : "conic-gradient(hsl(0,100%,55%), hsl(30,100%,55%), hsl(60,100%,55%), hsl(90,100%,55%), hsl(120,100%,55%), hsl(150,100%,55%), hsl(180,100%,55%), hsl(210,100%,55%), hsl(240,100%,55%), hsl(270,100%,55%), hsl(300,100%,55%), hsl(330,100%,55%), hsl(360,100%,55%))",
                                            boxShadow: currentIdx >= TASK_PALETTE.length ? `0 0 0 2.5px ${pageText(theme)}, 0 0 0 4.5px ${customVal || "#fff"}` : "none",
                                            overflow: "hidden",
                                          }}
                                        />
                                        <input ref={wheelRef} type="color"
                                          value={customVal || "#ff6600"}
                                          onChange={e => { setCustom(e.target.value); setter(TASK_PALETTE.length); }}
                                          style={{ position: "absolute", opacity: 0, width: 0, height: 0, top: 0, left: 0, pointerEvents: "none" }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: 12, color: muted(theme), marginBottom: 8 }}>One color for all tasks.</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: 6, margin: -6 }}>
                                {TASK_PALETTE.map((p, i) => (
                                  <button key={i} onClick={() => setTaskSingleColorIdx(i)} style={{
                                    width: 22, height: 22, borderRadius: "50%",
                                    border: (taskSingleColorIdx === i && taskSingleColorIdx < TASK_PALETTE.length) ? `2.5px solid ${pageText(theme)}` : "2.5px solid transparent",
                                    outline: (taskSingleColorIdx === i && taskSingleColorIdx < TASK_PALETTE.length) ? `2px solid ${p.swatch}` : "none",
                                    outlineOffset: 2, backgroundColor: p.swatch, cursor: "pointer", padding: 0,
                                  }} />
                                ))}
                                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                  <button
                                    onClick={() => { setTaskSingleColorIdx(TASK_PALETTE.length); colorWheelMobileSingleRef.current?.click(); }}
                                    title="Pick custom color"
                                    style={{
                                      position: "relative", width: 22, height: 22, borderRadius: 6, cursor: "pointer", padding: 0, border: "none", flexShrink: 0,
                                      background: taskSingleCustom ? taskSingleCustom : "conic-gradient(hsl(0,100%,55%), hsl(30,100%,55%), hsl(60,100%,55%), hsl(90,100%,55%), hsl(120,100%,55%), hsl(150,100%,55%), hsl(180,100%,55%), hsl(210,100%,55%), hsl(240,100%,55%), hsl(270,100%,55%), hsl(300,100%,55%), hsl(330,100%,55%), hsl(360,100%,55%))",
                                      boxShadow: taskSingleColorIdx >= TASK_PALETTE.length ? `0 0 0 2.5px ${pageText(theme)}, 0 0 0 4.5px ${taskSingleCustom || "#fff"}` : "none",
                                      overflow: "hidden",
                                    }}
                                  />
                                  <input ref={colorWheelMobileSingleRef} type="color"
                                    value={taskSingleCustom || "#ff6600"}
                                    onChange={e => { setTaskSingleCustom(e.target.value); setTaskSingleColorIdx(TASK_PALETTE.length); }}
                                    style={{ position: "absolute", opacity: 0, width: 0, height: 0, top: 0, left: 0, pointerEvents: "none" }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* BOB */}
                      <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700 }}>BOB</div>
                          {!isPlus && <span style={{ fontSize: 10, fontWeight: 700, color: muted(theme), opacity: .6 }}>Plus</span>}
                        </div>
                        {isPlus ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ background: theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", border: `1px solid ${border(theme)}`, borderRadius: 12, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: pageText(theme) }}>About You</div>
                              <textarea
                                value={bobUserInfo}
                                onChange={e => setBobUserInfoFn({ userInfo: e.target.value })}
                                placeholder="Tell BOB about yourself — name, role, goals…"
                                rows={3}
                                style={{ width: "100%", boxSizing: "border-box", background: theme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${border(theme)}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: pageText(theme), outline: "none", lineHeight: 1.6, resize: "vertical" }}
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: pageText(theme) }}>Send on silence</div>
                                <div style={{ fontSize: 11.5, color: muted(theme), marginTop: 2 }}>Auto-send after a pause in speech</div>
                              </div>
                              <button onClick={() => { const v = !bobAutoSend; setBobAutoSend(v); try { localStorage.setItem("bob_auto_send", String(v)); } catch {} }} style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: bobAutoSend ? (theme === "dark" ? "#4a9eff" : "#2563eb") : (theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"), position: "relative", transition: "background-color .18s" }}>
                                <span style={{ position: "absolute", top: 4, left: bobAutoSend ? 23 : 4, width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff", transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ background: theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", border: `1px solid ${border(theme)}`, borderRadius: 12, padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: pageText(theme) }}>BOB is a Plus feature</div>
                            <p style={{ margin: 0, fontSize: 12, color: muted(theme), lineHeight: 1.55 }}>AI board brain — voice, autopilot, smart prioritization.</p>
                            <button onClick={() => { setMobileSettingsOpen(false); setUpgradeOpen(true); }} style={{ padding: "7px 18px", borderRadius: 99, border: "none", cursor: "pointer", background: theme === "dark" ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)", color: pageText(theme), fontSize: 12, fontWeight: 700 }}>Upgrade to Plus →</button>
                          </div>
                        )}
                      </div>

                      {/* Email notifications */}
                      {isSignedIn && (
                        <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 12 }}>Email Notifications</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {(["dailyDigest", "weeklyDigest"] as const).map((key) => {
                              const labels: Record<string, string> = { dailyDigest: "Daily task outline", weeklyDigest: "Weekly task outline" };
                              const enabled = emailPrefs ? emailPrefs[key] : true;
                              return (
                                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 14, paddingBottom: 14, borderBottom: `1px solid ${border(theme)}` }}>
                                  <span style={{ fontSize: 15, color: pageText(theme) }}>{labels[key]}</span>
                                  <button type="button" onClick={() => { const current = emailPrefs ?? { dailyDigest: true, weeklyDigest: true }; updateEmailPrefs({ ...current, [key]: !enabled }); }} style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: enabled ? (theme === "dark" ? "#4a9eff" : "#2563eb") : (theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"), position: "relative", transition: "background-color .18s" }}>
                                    <span style={{ position: "absolute", top: 4, left: enabled ? 23 : 4, width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff", transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <p style={{ fontSize: 12, color: muted(theme), margin: "12px 0 0", lineHeight: 1.5 }}>Sent to {user?.emailAddresses?.[0]?.emailAddress ?? "your email"}.</p>
                        </div>
                      )}

                      {/* Calendar */}
                      <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                        <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Calendar</div>
                        <button onClick={() => { exportToIcs(); setMobileSettingsOpen(false); }} disabled={!notes.some(n => n.dueDate && !n.completed)} style={{ width: "100%", height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", color: pageText(theme), fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: notes.some(n => n.dueDate && !n.completed) ? 1 : 0.4 }}>Export tasks to calendar (.ics)</button>
                        <p style={{ fontSize: 12, color: muted(theme), margin: "10px 0 0", lineHeight: 1.5 }}>Exports tasks with due dates. Opens in Apple Calendar or import into Google Calendar.</p>
                      </div>

                      {/* Billing */}
                      {isSignedIn && (
                        <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 12 }}>Billing</div>
                          <div style={{ background: theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", border: `1px solid ${border(theme)}`, borderRadius: 12, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: pageText(theme) }}>{isPlus ? "Boardtivity Plus" : "Free Plan"}</div>
                                {isPlus && subscription?.currentPeriodEnd && <div style={{ fontSize: 11.5, color: muted(theme), marginTop: 2 }}>Renews {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 999, background: isPlus ? (theme === "dark" ? "rgba(74,158,255,.15)" : "rgba(37,99,235,.1)") : (theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)"), color: isPlus ? (theme === "dark" ? "#4a9eff" : "#2563eb") : muted(theme), border: `1px solid ${isPlus ? (theme === "dark" ? "rgba(74,158,255,.2)" : "rgba(37,99,235,.15)") : border(theme)}` }}>{isPlus ? "Active" : "Free"}</span>
                            </div>
                            {isPlus ? (
                              <button onClick={startPortal} style={{ height: 44, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", color: pageText(theme), fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Manage subscription</button>
                            ) : (
                              <button onClick={() => { setMobileSettingsOpen(false); setUpgradeOpen(true); }} style={{ height: 44, borderRadius: 10, border: "none", backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Upgrade to Plus</button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Account */}
                      {isSignedIn && (
                        <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 12 }}>Account</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, overflow: "hidden" }}>
                            <span style={{ fontSize: 13, color: muted(theme), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user?.emailAddresses?.[0]?.emailAddress}</span>
                            {isPlus && <span style={{ flexShrink: 0, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)", background: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "3px 9px" }}>Plus</span>}
                          </div>
                          <button onClick={() => signOut()} style={{ width: "100%", height: 44, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: "transparent", color: theme === "dark" ? "#ff8080" : "#c03030", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Sign out</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {mobileAddMode && (
                <div style={{ position: "fixed", inset: 0, zIndex: 800, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,.4)" }} onClick={() => { setMobileAddMode(null); setMobileAddTitle(""); setMobileAddBody(""); setMobileAddColorIdx(undefined); setMobileAddRemindIn(null); }} />
                  <div style={{ position: "relative", backgroundColor: surface(theme), borderRadius: "20px 20px 0 0", padding: "20px 20px 36px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: muted(theme), opacity: .6, marginBottom: 2 }}>
                      {mobileAddMode === "task" ? "New Task" : "New Idea"}
                    </div>
                    <textarea
                      autoFocus
                      rows={1}
                      value={mobileAddTitle}
                      onChange={e => { setMobileAddTitle(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && mobileAddMode === "task") { e.preventDefault(); mobileCreateNote(); } if (e.key === "Escape") { setMobileAddMode(null); setMobileAddTitle(""); setMobileAddBody(""); setMobileAddColorIdx(undefined); setMobileAddRemindIn(null); } }}
                      placeholder={mobileAddMode === "task" ? "What needs to be done?" : "What's your idea?"}
                      style={{ fontSize: 16, fontWeight: 600, color: pageText(theme), backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "13px 14px", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.4 }}
                    />
                    {mobileAddMode === "task" && (
                      <>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(["Low", "Medium", "High"] as Importance[]).map(imp => {
                            const active = mobileAddImportance === imp;
                            const col = PRIORITY_COLORS[imp as "High"|"Medium"|"Low"];
                            return (
                              <button key={imp} onClick={() => setMobileAddImportance(imp)}
                                style={{ flex: 1, height: 34, borderRadius: 999, border: active ? `1.5px solid ${col}` : `1px solid ${border(theme)}`, backgroundColor: active ? hexToRgba(PRIORITY_COLORS[imp as "High"|"Medium"|"Low"], 0.12) : "transparent", color: active ? col : muted(theme), fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                {imp}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", height: 44, backgroundColor: paper(theme), border: `1.5px solid ${mobileAddDueDate ? border(theme) : (theme === "dark" ? "#8b3a3a" : "#d06060")}`, borderRadius: 12, padding: "0 14px", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: muted(theme), flex: 1 }}>Due date</span>
                          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: mobileAddDueDate ? pageText(theme) : (theme === "dark" ? "#ff8080" : "#c05050"), pointerEvents: "none" }}>
                              {mobileAddDueDate ? isoToMDY(mobileAddDueDate) : "Required"}
                            </span>
                            <input
                              type="date"
                              value={mobileAddDueDate}
                              onChange={e => setMobileAddDueDate(e.target.value)}
                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 1 }}
                            />
                          </div>
                        </div>
                        {mobileAddDueDate && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <input
                              type="time"
                              value={mobileAddDueTime}
                              onChange={e => setMobileAddDueTime(e.target.value)}
                              placeholder="Time (optional)"
                              style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${border(theme)}`, background: theme === "dark" ? "rgba(255,255,255,.06)" : "#fff", color: mobileAddDueTime ? pageText(theme) : muted(theme), fontSize: 14, padding: "0 10px", fontFamily: "inherit", outline: "none", colorScheme: theme === "dark" ? "dark" : "light" }}
                            />
                            {mobileAddDueTime && (
                              <button type="button" onClick={() => setMobileAddDueTime("")} style={{ background: "none", border: "none", color: muted(theme), fontSize: 16, opacity: .6, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {mobileAddMode === "thought" && (
                      <>
                        <textarea
                          rows={2}
                          value={mobileAddBody}
                          onChange={e => { setMobileAddBody(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                          placeholder="Add notes… (optional)"
                          style={{ fontSize: 14, color: pageText(theme), backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "12px 14px", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.5 }}
                        />
                      </>
                    )}
                    {mobileAddMode === "thought" && (
                      <>
                        {/* Color picker */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: muted(theme), letterSpacing: ".04em" }}>Color</span>
                          <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: 4, margin: -4 }}>
                            <button onClick={() => setMobileAddColorIdx(undefined)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: theme === "dark" ? "#555" : "#ccc", border: mobileAddColorIdx === undefined ? `2.5px solid ${pageText(theme)}` : "2.5px solid transparent", outline: mobileAddColorIdx === undefined ? `2px solid ${theme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)"}` : "none", outlineOffset: 2 }} title="Grey" />
                            {NOTE_PALETTE.map((p, i) => (
                              <button key={i} onClick={() => setMobileAddColorIdx(i)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: p.swatch, border: mobileAddColorIdx === i ? `2.5px solid ${pageText(theme)}` : "2.5px solid transparent", outline: mobileAddColorIdx === i ? `2px solid ${p.swatch}` : "none", outlineOffset: 2 }} />
                            ))}
                          </div>
                        </div>
                        {/* Remind me */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: muted(theme), letterSpacing: ".04em", whiteSpace: "nowrap" }}>Remind me</span>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {([{ label: "1h", ms: 3_600_000 }, { label: "12h", ms: 43_200_000 }, { label: "1 day", ms: 86_400_000 }, { label: "1 week", ms: 604_800_000 }]).map(opt => (
                              <button key={opt.label} onClick={() => setMobileAddRemindIn(mobileAddRemindIn === opt.ms ? null : opt.ms)}
                                style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: mobileAddRemindIn === opt.ms ? `1.5px solid ${pageText(theme)}` : `1px solid ${border(theme)}`, backgroundColor: mobileAddRemindIn === opt.ms ? (theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)") : "transparent", color: mobileAddRemindIn === opt.ms ? pageText(theme) : muted(theme) }}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <button
                      onClick={mobileCreateNote}
                      style={{ height: 44, borderRadius: 12, backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                    >
                      Add {mobileAddMode === "task" ? "Task" : "Idea"}
                    </button>
                  </div>
                </div>
              )}

              {/* Edit / delete action sheet */}
              {actionNote && (
                <div style={{ position: "fixed", inset: 0, zIndex: 810, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,.4)" }} onClick={() => { setMobileActionNoteId(null); setMobileDeleteConfirm(false); }} />
                  <div style={{ position: "relative", backgroundColor: surface(theme), borderRadius: "20px 20px 0 0", padding: "20px 20px 36px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: muted(theme), opacity: .5, marginBottom: 2 }}>Edit</div>
                    <textarea
                      rows={1}
                      value={mobileEditTitle}
                      onChange={e => { setMobileEditTitle(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                      placeholder="Title"
                      style={{ fontSize: 16, fontWeight: 600, color: pageText(theme), backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "13px 14px", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.4 }}
                    />
                    {actionNote.type === "thought" && (
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        <button
                          onClick={() => setMobileEditColorIdx(undefined)}
                          style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: theme === "dark" ? "#3a3a3a" : "#d0d0cc", border: mobileEditColorIdx === undefined ? `2.5px solid ${pageText(theme)}` : `1.5px solid transparent`, cursor: "pointer", flexShrink: 0 }}
                        />
                        {NOTE_PALETTE.map((col, i) => (
                          <button
                            key={i}
                            onClick={() => setMobileEditColorIdx(i)}
                            style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: col.swatch, border: mobileEditColorIdx === i ? `2.5px solid ${pageText(theme)}` : `1.5px solid transparent`, cursor: "pointer", flexShrink: 0 }}
                          />
                        ))}
                      </div>
                    )}
                    {actionNote.type === "task" && (
                      <>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(["none", "Low", "Medium", "High"] as Importance[]).map(imp => {
                            const active = mobileEditImportance === imp;
                            const col = imp === "none" ? muted(theme) : PRIORITY_COLORS[imp as "High"|"Medium"|"Low"];
                            return (
                              <button key={imp} onClick={() => setMobileEditImportance(imp)}
                                style={{ flex: 1, height: 34, borderRadius: 999, border: active ? `1.5px solid ${col}` : `1px solid ${border(theme)}`, backgroundColor: (active && imp !== "none") ? hexToRgba(PRIORITY_COLORS[imp as "High"|"Medium"|"Low"], 0.12) : "transparent", color: active ? col : muted(theme), fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >{imp === "none" ? "None" : imp}</button>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", height: 44, backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "0 14px", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: muted(theme), flex: 1 }}>Due date</span>
                          {mobileEditDueDate && (
                            <button type="button" onClick={() => setMobileEditDueDate("")} style={{ background: "none", border: "none", color: muted(theme), fontSize: 13, opacity: .5, cursor: "pointer", padding: "0 2px" }}>✕</button>
                          )}
                          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: mobileEditDueDate ? pageText(theme) : muted(theme), pointerEvents: "none" }}>
                              {mobileEditDueDate ? isoToMDY(mobileEditDueDate) : "mm-dd-yyyy"}
                            </span>
                            <input
                              type="date"
                              value={mobileEditDueDate}
                              onChange={e => setMobileEditDueDate(e.target.value)}
                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 1 }}
                            />
                          </div>
                        </div>
                        {mobileEditDueDate && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <input
                              type="time"
                              value={mobileEditDueTime}
                              onChange={e => setMobileEditDueTime(e.target.value)}
                              placeholder="Time (optional)"
                              style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${border(theme)}`, background: theme === "dark" ? "rgba(255,255,255,.06)" : "#fff", color: mobileEditDueTime ? pageText(theme) : muted(theme), fontSize: 14, padding: "0 10px", fontFamily: "inherit", outline: "none", colorScheme: theme === "dark" ? "dark" : "light" }}
                            />
                            {mobileEditDueTime && (
                              <button type="button" onClick={() => setMobileEditDueTime("")} style={{ background: "none", border: "none", color: muted(theme), fontSize: 16, opacity: .6, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => {
                          if (!mobileEditTitle.trim()) return;
                          const parsedMins = mobileEditMinutes ? parseInt(mobileEditMinutes) : undefined;
                          const updatedNotes = notes.map(n => n.id === actionNote.id ? {
                            ...n,
                            title: mobileEditTitle.trim(),
                            importance: mobileEditImportance,
                            dueDate: mobileEditDueDate || undefined,
                            dueTime: mobileEditDueTime || undefined,
                            minutes: parsedMins && parsedMins > 0 ? parsedMins : undefined,
                            ...(actionNote.type === "thought" ? { colorIdx: mobileEditColorIdx } : {}),
                            steps: n.steps.map(s => {
                              const edited = mobileEditSteps.find(e => e.id === s.id);
                              return edited ? { ...s, minutes: edited.minutes } : s;
                            }),
                          } : n);
                          setNotes(updatedNotes);
                          scheduleDueDateReminder(actionNote.id, mobileEditTitle.trim() || actionNote.title, mobileEditDueDate || undefined, mobileEditDueTime || undefined);
                          setMobileActionNoteId(null);
                          setMobileDeleteConfirm(false);
                          if (isSignedIn) {
                            const freshState = JSON.stringify({ boards, notes: updatedNotes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom });
                            latestBoardStateRef.current = freshState;
                            pushToCloud();
                          }
                        }}
                        style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                      >Save</button>
                      {mobileDeleteConfirm ? (
                        <button
                          onClick={() => { const updatedNotes = notes.filter(n => n.id !== actionNote.id); setNotes(updatedNotes); setMobileActionNoteId(null); setMobileDeleteConfirm(false); if (isSignedIn) { const freshState = JSON.stringify({ boards, notes: updatedNotes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, taskSingleCustom, taskHighCustom, taskMedCustom, taskLowCustom }); latestBoardStateRef.current = freshState; pushToCloud(); } }}
                          style={{ height: 44, borderRadius: 12, backgroundColor: theme === "dark" ? "rgba(220,60,60,.18)" : "rgba(180,40,40,.1)", color: theme === "dark" ? "#ff8080" : "#c03030", border: `1.5px solid ${theme === "dark" ? "rgba(220,60,60,.5)" : "rgba(180,40,40,.4)"}`, padding: "0 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
                        >Confirm</button>
                      ) : (
                        <button
                          onClick={() => setMobileDeleteConfirm(true)}
                          style={{ height: 44, borderRadius: 12, backgroundColor: "transparent", color: theme === "dark" ? "#ff8080" : "#c03030", border: `1.5px solid ${theme === "dark" ? "rgba(220,60,60,.35)" : "rgba(180,40,40,.25)"}`, padding: "0 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                        >Delete</button>
                      )}
                    </div>
                    {mobileDeleteConfirm && (
                      <div style={{ fontSize: 12, color: theme === "dark" ? "#ff8080" : "#c03030", textAlign: "center", opacity: .75, marginTop: -4 }}>Tap Confirm to permanently delete</div>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile focus overlay — rendered inside mobile section so it reliably shows on iOS */}
              {focusOpen && (() => {
                const fn = notes.find(n => n.id === focusNoteId);
                if (!fn) return null;
                const step = focusStepId ? fn.steps.find(s => s.id === focusStepId) : null;
                const totalMins = Math.floor(focusSecondsLeft / 60);
                const hrs = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                const secs = focusSecondsLeft % 60;
                const allSteps = fn.steps;
                const hasChain = focusChainMode && allSteps.length > 1;
                const currentStepSecs = (step?.minutes ?? fn.minutes ?? estimateTime(fn.title)) * 60;
                const currentStepFill = Math.min(100, Math.max(0, (focusSecondsLeft / currentStepSecs) * 100));
                const totalMinutes = hasChain ? allSteps.reduce((s, x) => s + (x.minutes ?? 25), 0) : (step?.minutes ?? fn.minutes ?? estimateTime(fn.title));
                const totalSecs2 = totalMinutes * 60;
                const currentIdx = step ? allSteps.findIndex(s => s.id === focusStepId) : -1;
                const doneStepsSecs = hasChain && currentIdx > 0 ? allSteps.slice(0, currentIdx).reduce((s, x) => s + (x.minutes ?? 25) * 60, 0) : 0;
                const overallFill = Math.min(100, Math.max(0, ((doneStepsSecs + (currentStepSecs - focusSecondsLeft)) / totalSecs2) * 100));

                const btn: CSSProperties = { height: 48, padding: "0 24px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", backgroundColor: "rgba(255,255,255,.09)", color: "rgba(247,248,251,.85)", fontSize: 15, fontWeight: 700, cursor: "pointer" };
                const btnRed: CSSProperties = { ...btn, border: "1px solid rgba(220,60,60,.3)", backgroundColor: "rgba(220,60,60,.12)", color: "rgba(255,160,160,.8)" };
                const btnGreen: CSSProperties = { ...btn, border: "1px solid rgba(100,210,120,.3)", backgroundColor: "rgba(80,180,100,.12)", color: "rgba(120,220,130,.9)", padding: "0 36px", height: 52, fontSize: 16 };

                const progressBars = (dimmed = false) => {
                  const barColor = dimmed ? "rgba(247,248,251,.22)" : "rgba(247,248,251,.9)";
                  const trackColor = dimmed ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.12)";
                  return (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: hasChain ? 14 : 0 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: dimmed ? "rgba(247,248,251,.35)" : "rgba(247,248,251,.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {step ? step.title : fn.title}
                          </span>
                          {hasChain && step && (
                            <span style={{ fontSize: 13, color: dimmed ? "rgba(247,248,251,.22)" : "rgba(247,248,251,.4)", flexShrink: 0 }}>
                              {currentIdx + 1} / {allSteps.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{ position: "fixed", inset: 0, zIndex: 950, backgroundColor: focusCompleted ? "rgb(6,20,9)" : focusPaused ? "rgb(7,8,18)" : "rgb(6,7,10)", color: "#f7f8fb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", overflowY: "hidden", overscrollBehavior: "none" }}>
                    {focusExitConfirm ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Exit focus mode?</div>
                        <div style={{ fontSize: 14, color: "rgba(247,248,251,.45)", marginBottom: 32, lineHeight: 1.6 }}>Your timer will reset and progress won't be saved.</div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <button type="button" onClick={() => { setFocusOpen(false); setFocusExitConfirm(false); setFocusPaused(false); setFocusCompleted(false); setFocusNoteId(null); setFocusStepId(null); setFocusSecondsLeft(0); setBreakSecondsLeft(0); }} style={btnRed}>Exit</button>
                          <button type="button" onClick={() => setFocusExitConfirm(false)} style={btn}>Keep going</button>
                        </div>
                      </div>
                    ) : focusCompleted ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                        <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "rgba(80,180,100,.15)", border: "1.5px solid rgba(100,210,120,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><polyline points="5,14 10,19 21,8" stroke="#6fc46b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div style={{ marginTop: 20, fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(247,248,251,.35)", fontWeight: 500 }}>Complete</div>
                        <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.25, maxWidth: 280 }}>{step ? step.title : fn.title}</div>
                        <div style={{ marginTop: 10, fontSize: 14, color: "rgba(120,210,130,.7)" }}>Great work!</div>
                        {focusNextStep && (
                          <div style={{ marginTop: 8, fontSize: 13, color: "rgba(247,248,251,.4)" }}>Up next — <span style={{ color: "rgba(247,248,251,.7)", fontWeight: 600 }}>{focusNextStep.title}</span></div>
                        )}
                        <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
                          {focusNextStep ? (
                            <>
                              <button type="button" onClick={advanceToNext} style={btnGreen}>Start next</button>
                              <button type="button" onClick={() => { const sid = focusStepId; if (fn.id) logMobileFocusTime(fn.id, sid, false); setFocusOpen(false); setFocusCompleted(false); setFocusNoteId(null); setFocusNextStep(null); setFocusStepId(null); setFocusChainMode(false); }} style={btn}>Done</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => { const sid = focusStepId; if (fn.id) logMobileFocusTime(fn.id, sid, true); setFocusOpen(false); setFocusCompleted(false); setFocusNoteId(null); setFocusNextStep(null); setFocusStepId(null); setFocusChainMode(false); }} style={btnGreen}>Done</button>
                          )}
                        </div>
                      </div>
                    ) : focusPaused ? (
                      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                        <div style={{ fontSize: 13, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(247,248,251,.5)", fontWeight: 600 }}>Break</div>
                        <div style={{ marginTop: 32, fontSize: 88, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                          {String(Math.floor(breakSecondsLeft / 60)).padStart(2,"0")}:{String(breakSecondsLeft % 60).padStart(2,"0")}
                        </div>
                        <div style={{ marginTop: 10, fontSize: 14, color: "rgba(247,248,251,.4)" }}>Resumes automatically</div>
                        <div style={{ marginTop: 36, display: "flex", gap: 12 }}>
                          <button type="button" onClick={() => { focusTotalSecsRef.current = focusPausedSecsRef.current; focusStartedAtRef.current = Date.now(); setFocusPaused(false); setBreakSecondsLeft(0); }} style={btn}>Resume now</button>
                          <button type="button" onClick={() => setFocusExitConfirm(true)} style={btnRed}>Exit</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                        {hasChain && step && (
                          <div style={{ fontSize: 13, letterSpacing: ".16em", color: "rgba(247,248,251,.45)", fontWeight: 600, marginBottom: 10 }}>
                            {currentIdx + 1} / {allSteps.length}
                          </div>
                        )}
                        <div style={{ fontSize: 17, fontWeight: 600, color: "rgba(247,248,251,.75)", lineHeight: 1.4, maxWidth: 300, marginBottom: 28 }}>{step ? step.title : fn.title}</div>
                        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                          {hrs > 0 ? `${hrs}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}` : `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`}
                        </div>
                        <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                          {focusTotalSecsRef.current >= 30 * 60 && (
                            <button type="button" onClick={() => { focusPausedSecsRef.current = focusSecondsLeft; setFocusPaused(true); setBreakSecondsLeft(300); }} style={btn}>5 min break</button>
                          )}
                          <button type="button" onClick={() => setFocusExitConfirm(true)} style={btnRed}>Exit</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* FAB */}
              <button
                onClick={() => { setMobileAddMode(isThoughtBoard ? "thought" : "task"); setMobileAddTitle(""); setMobileAddBody(""); setMobileAddImportance("Low"); setMobileAddDueDate(""); setMobileAddColorIdx(undefined); setMobileAddRemindIn(null); }}
                style={{ position: "fixed", bottom: 24, right: 20, height: 42, borderRadius: 999, backgroundColor: theme === "dark" ? "#23262b" : "#ffffff", color: theme === "dark" ? "#f5f5f2" : "#433d35", border: `1px solid ${border(theme)}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "0 18px 0 14px", boxShadow: "0 4px 20px rgba(0,0,0,.22)", zIndex: 100, fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {isThoughtBoard ? "Add Idea" : "Add Task"}
              </button>
            </div>
          );
        })()}
        <div id="board-shell" ref={boardContainerRef} style={{ ...boardStyle, ...fullscreenOverride, ...(isMobile ? { display: "none" } : {}) }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: paper(boardTheme),
              ...(boardGrid === "grid" ? { backgroundImage: `linear-gradient(${grid(boardTheme)} 1px, transparent 1px), linear-gradient(90deg, ${grid(boardTheme)} 1px, transparent 1px)`, backgroundSize: `${48 * scale}px ${48 * scale}px`, backgroundPosition: `${pan.x % (48 * scale)}px ${pan.y % (48 * scale)}px` } : boardGrid === "dots" ? { backgroundImage: `radial-gradient(circle, ${grid(boardTheme)} ${Math.max(0.6, 1.5 * scale)}px, transparent ${Math.max(0.6, 1.5 * scale)}px)`, backgroundSize: `${32 * scale}px ${32 * scale}px`, backgroundPosition: `${pan.x % (32 * scale)}px ${pan.y % (32 * scale)}px` } : {}),
              pointerEvents: "none",
            }}
          />

          {/* Board watermark */}
          <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", fontWeight: 700, color: boardTheme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.09)", pointerEvents: "none", zIndex: 0, userSelect: "none", whiteSpace: "nowrap" }}>
            Boardtivity
          </div>

          {/* Save your board prompt */}
          {!isSignedIn && activeNotes.length > 0 && (
            <div style={{
              position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 4,
              display: "flex", alignItems: "center", gap: 10,
              backgroundColor: boardTheme === "dark" ? "rgba(24,27,32,.92)" : "rgba(255,255,255,.95)",
              backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${border(boardTheme)}`,
              borderRadius: 14,
              padding: "10px 14px",
              boxShadow: boardTheme === "dark" ? "0 4px 24px rgba(0,0,0,.4)" : "0 4px 24px rgba(0,0,0,.1)",
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: pageText(boardTheme), lineHeight: 1.3 }}>Sync across devices</div>
                <div style={{ fontSize: 11, color: muted(boardTheme), opacity: .7, lineHeight: 1.3 }}>Sign up to access from anywhere</div>
              </div>
              <button
                onClick={() => openSignUp()}
                style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "none", backgroundColor: boardTheme === "dark" ? "#f7f8fb" : "#111315", color: boardTheme === "dark" ? "#111315" : "#f7f8fb", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Sign up
              </button>
            </div>
          )}

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
                backgroundColor: "transparent",
                willChange: "transform",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
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
                            stroke={boardTheme === "dark" ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)"}
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
                            stroke={boardTheme === "dark" ? "rgba(255,255,255,.18)" : "rgba(70,70,70,.18)"}
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
                        stroke={boardTheme === "dark" ? "rgba(255,255,255,.18)" : "rgba(70,70,70,.18)"}
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
                        borderRadius: 9,
                        border: (step.done || note.completed) ? `1.5px solid ${boardTheme === "dark" ? "rgba(60,180,90,.30)" : "rgba(60,180,90,.45)"}` : getNoteBorder(note.importance),
                        backgroundColor: (step.done || note.completed) ? (boardTheme === "dark" ? "#0e2e18" : "#e6f9ee") : getBg(note.importance),
                        boxShadow: (step.done || note.completed)
                          ? `0 0 0 2px rgba(60,180,90,.2), 0 10px 18px rgba(0,0,0,.08)`
                          : `0 0 0 2px ${getHalo(note.importance)}, 0 10px 18px rgba(0,0,0,.08)`,
                        padding: "10px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              border: step.done ? "1px solid #3d8b40" : "1px solid rgba(0,0,0,.18)",
                              backgroundColor: step.done ? "#6fc46b" : boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#f1f1ef",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 700, fontSize: 13, color: noteText(boardTheme) }}>{step.title}</span>
                        </div>
                      </div>
                    </button>
                  ))
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
                      noteType: note.type,
                      boardId: note.boardId,
                      startX: e.clientX,
                      startY: e.clientY,
                      noteX: note.x,
                      noteY: note.y,
                    };
                    draggedRef.current = false;
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    const drag = noteDragRef.current;
                    const linkTarget = thoughtDropTargetRef.current;
                    if (drag && drag.noteType === "thought" && linkTarget !== null && linkTarget !== drag.noteId) {
                      toggleThoughtLink(drag.noteId, linkTarget);
                    }
                    if (thoughtHoverTimerRef.current) { clearTimeout(thoughtHoverTimerRef.current); thoughtHoverTimerRef.current = null; }
                    thoughtDropTargetRef.current = null; setThoughtDropTarget(null);
                    thoughtUnlinkTargetRef.current = null; setThoughtUnlinkTarget(null);
                    noteDragRef.current = null;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (draggedRef.current) {
                      draggedRef.current = false;
                      return;
                    }
                    setDetailNoteId(note.id); setDetailEditing(false);
                  }}
                  style={{
                    position: "absolute",
                    left: note.x,
                    top: note.y,
                    width: noteCardWidth(note.title),
                    minHeight: NOTE_H,
                    padding: "6px 7px 6px",
                    borderRadius: 10,
                    border: thoughtDropTarget === note.id
                      ? `1.5px solid ${boardTheme === "dark" ? "rgba(160,170,240,.7)" : "rgba(100,110,200,.55)"}`
                      : thoughtUnlinkTarget === note.id
                        ? `1.5px solid rgba(220,60,60,.65)`
                        : note.completed
                          ? `1.5px solid ${boardTheme === "dark" ? "rgba(60,180,90,.30)" : "rgba(60,180,90,.45)"}`
                          : note.type === "task"
                            ? getNoteBorder(note.importance)
                            : note.colorIdx !== undefined
                              ? `1.5px solid ${NOTE_PALETTE[note.colorIdx % NOTE_PALETTE.length].halo.replace(/[\d.]+\)$/, boardTheme === "dark" ? "0.32)" : "0.48)")}`
                              : `1px solid ${boardTheme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.10)"}`,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: note.completed
                      ? (boardTheme === "dark" ? "#0e2e18" : "#e6f9ee")
                      : note.type === "task"
                        ? getBg(note.importance)
                        : note.colorIdx !== undefined
                          ? paletteBg(note.colorIdx, boardTheme)
                          : (boardTheme === "dark" ? "#2a2d32" : "#ebebeb"),
                    boxShadow: highlightedNoteIds.has(note.id)
                      ? `0 0 0 3px rgba(99,160,255,.7), 0 0 28px rgba(99,160,255,.45), 0 10px 18px rgba(0,0,0,.1)`
                      : thoughtDropTarget === note.id
                        ? `0 0 0 4px ${boardTheme === "dark" ? "rgba(140,150,230,.28)" : "rgba(100,110,200,.18)"}, 0 0 20px ${boardTheme === "dark" ? "rgba(140,150,230,.22)" : "rgba(100,110,200,.16)"}, 0 10px 18px rgba(59,43,16,.06)`
                        : thoughtUnlinkTarget === note.id
                          ? "0 0 0 4px rgba(220,60,60,.25), 0 0 20px rgba(220,60,60,.20), 0 10px 18px rgba(59,43,16,.06)"
                          : note.completed
                            ? `0 0 0 3px rgba(60,180,90,.25), 0 10px 18px rgba(0,0,0,.06)`
                            : note.type === "task"
                              ? `0 0 0 3px ${getHalo(note.importance)}, 0 10px 18px rgba(59,43,16,.06)`
                              : note.colorIdx !== undefined
                                ? `0 0 0 3px ${paletteHalo(note.colorIdx)}, 0 10px 18px rgba(59,43,16,.06)`
                                : `0 0 0 3px ${boardTheme === "dark" ? "rgba(140,140,140,.18)" : "rgba(0,0,0,.10)"}, 0 10px 18px rgba(59,43,16,.06)`,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "box-shadow .22s ease, border-color .22s ease",
                  }}
                  className={thoughtUnlinkTarget === note.id ? "thought-vibrate" : undefined}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={pill(boardTheme)}>{note.type === "task" ? "Task" : "Idea"}</div>

                    {note.type === "task" && (note.dueDate || note.completed || note.steps.every(s => s.done && s.id)) && (() => {
                      const done = note.completed || (note.steps.length > 0 && note.steps.every(s => s.done));
                      if (done) return (
                        <div style={{ ...pill(boardTheme), fontWeight: 800, color: boardTheme === "dark" ? "rgba(100,220,120,.9)" : "rgba(30,120,60,.85)", border: "1px solid rgba(60,180,90,.3)", backgroundColor: "rgba(60,180,90,.1)" }}>Completed</div>
                      );
                      if (!note.dueDate) return null;
                      const today = todayStr();
                      const overdue = note.dueDate < today;
                      const dueToday = note.dueDate === today;
                      return (
                        <div style={{
                          ...pill(boardTheme),
                          fontWeight: 800,
                          ...(overdue ? {
                            color: "#ff3333",
                            border: "1px solid rgba(255,50,50,.5)",
                            backgroundColor: "rgba(255,50,50,.15)",
                            boxShadow: "0 0 10px rgba(255,50,50,.4)",
                            animation: "overduePulse 1.6s ease-in-out infinite",
                          } : dueToday ? {
                            color: boardTheme === "dark" ? "#ffb347" : "#b86800",
                            border: "1px solid rgba(200,130,20,.4)",
                            backgroundColor: "rgba(200,130,20,.1)",
                            boxShadow: "0 0 6px rgba(200,130,20,.3)",
                          } : {}),
                        }}>{overdue ? "Overdue" : dueToday ? `Due Today${fmtTime(note.dueTime)}` : `Due ${formatDateShort(note.dueDate)}${fmtTime(note.dueTime)}`}</div>
                      );
                    })()}
                  </div>

                  <div style={{ marginTop: 18, marginBottom: 6, fontSize: titleFontSize(note.title), lineHeight: 1.22, fontWeight: 700, color: noteText(boardTheme), display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {note.title}
                  </div>

                  {note.body && note.type === "thought" && (
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: noteSub(boardTheme), display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {note.body}
                    </div>
                  )}

                  {note.type === "task" && (
                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      {note.steps.length > 0 ? (
                        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                          {note.steps.map((step) => (
                            <span
                              key={step.id}
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                border: step.done ? "1px solid #3d8b40" : "1px solid rgba(0,0,0,.18)",
                                backgroundColor: step.done ? "#6fc46b" : boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#f1f1ef",
                                display: "inline-block",
                              }}
                            />
                          ))}
                        </div>
                      ) : <div />}
                      <span style={pill(boardTheme)}>
                        {note.importance && note.importance !== "none" ? `${note.importance} priority` : "No priority"}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Empty state — rendered outside the transformed canvas so clicks land correctly */}
          {activeNotes.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 1, pointerEvents: "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, textAlign: "center", maxWidth: 380, padding: "0 24px", pointerEvents: "auto" }}>
                <img src="/logo-vertical.svg" alt="" style={{ width: 120, opacity: boardTheme === "dark" ? 0.45 : 0.35, filter: boardTheme === "dark" ? "invert(1)" : "none", pointerEvents: "none", userSelect: "none" }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: boardTheme === "dark" ? "#e8e8e6" : "#2a2822", lineHeight: 1.2 }}>
                    {thoughtMode ? "Your idea board is empty" : "Your task board is empty"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14, color: boardTheme === "dark" ? "rgba(255,255,255,.38)" : "rgba(0,0,0,.38)" }}>
                    {thoughtMode ? "Start capturing and connecting your ideas" : "Start adding tasks and breaking them down"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", textAlign: "left" }}>
                  {(thoughtMode ? [
                    { icon: "✦", text: "Click + to add an idea card to the board" },
                    { icon: "⇄", text: "Drag one idea over another to link them together" },
                    { icon: "⊙", text: "Hold over a linked idea to unlink it" },
                    { icon: "✎", text: "Click an idea card to view, edit, or add a note" },
                  ] : [
                    { icon: "✦", text: "Click + to create a task — name it, set priority & due date" },
                    { icon: "≡", text: "Open a task to add subtasks and break down the work" },
                    { icon: "◎", text: "Hit Start Focus Mode to work through subtasks with a timer" },
                  ]).map(({ icon, text }) => (
                    <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10, backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)", borderRadius: 10, padding: "10px 14px" }}>
                      <span style={{ fontSize: 13, color: boardTheme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.3)", flexShrink: 0, marginTop: 1 }}>{icon}</span>
                      <span style={{ fontSize: 13, color: boardTheme === "dark" ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)", lineHeight: 1.5 }}>{text}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setComposerOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 999, border: "none", backgroundColor: boardTheme === "dark" ? "#f7f8fb" : "#111315", color: boardTheme === "dark" ? "#111315" : "#f7f8fb", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em" }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                  {thoughtMode ? "Add your first idea" : "Add your first task"}
                </button>
              </div>
            </div>
          )}

          <div style={{ position: "absolute", top: 12, left: 16, right: 16, zIndex: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* BOB — visible to all, admin-gated features */}
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 0 }}>
              <BobAgent
                theme={boardTheme}
                notes={notes}
                activeBoardId={activeBoardId}
                onSweep={handleBobSweep}
                onAddNote={handleBobAddNote}
                onEditNote={handleBobEditNote}
                onDeleteNotes={handleBobDeleteNotes}
                onHighlightNotes={handleBobHighlightNotes}
                onLaunchFocus={handleBobLaunchFocus}
                onSaveUndo={handleBobSaveUndo}
                onUndo={handleBobUndo}
                onSetIdeaColor={handleBobSetIdeaColor}
                onConfigureTaskColors={handleBobConfigureTaskColors}
                onConfigureBoard={handleBobConfigureBoard}
                isAdmin={!!isAdmin}
                userInfo={bobUserInfo}
                autoSend={bobAutoSend}
                settings={{ taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, thoughtColorMode, thoughtFixedColorIdx, boardTheme, boardGrid, activeBoardType: activeBoard?.type as "task" | "thought" | undefined, activeBoardName: activeBoard?.name, boards: boards.map(b => ({ id: b.id, name: b.name, type: b.type as "task" | "thought" })) }}
                focusStats={focusStatsData ?? undefined}
              />
            </div>
            <div style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 14,
                fontWeight: 700,
                color: pageText(boardTheme),
                backgroundColor: boardTheme === "dark" ? "rgba(31,35,41,.85)" : "rgba(255,255,255,.90)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderRadius: 99,
                padding: "6px 14px 6px 8px",
                border: `1px solid ${border(boardTheme)}`,
                boxShadow: boardTheme === "dark" ? "0 2px 12px rgba(0,0,0,.28)" : "0 2px 12px rgba(0,0,0,.08)",
              }}>
              <BoardtivityLogo size={22} dark={boardTheme === "dark"} />
              {activeBoard.name}
            </div>

            <div style={{ position: "relative", display: "flex", gap: 5, alignItems: "center" }}>
              {/* Focus stats */}
              {isSignedIn && (
                <button onClick={() => setProfileOpen(true)} style={circleButton(boardTheme)} aria-label="Focus stats" title="Focus stats">
                  {(focusStatsData?.currentStreak ?? 0) > 0
                    ? <svg width="11" height="15" viewBox="0 0 11 15" fill="none" overflow="visible" style={{ display: "block", animation: "boltSpark 1.4s ease-in-out infinite" }}>
                        <path d="M7 1L1 8.5h4L3.5 14 10 6H6L7 1Z" fill="#facc15"/>
                      </svg>
                    : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  }
                </button>
              )}

              {/* Theme toggle — lightbulb */}
              <ThemeToggle theme={boardTheme} onToggle={() => setBoardTheme((t) => (t === "dark" ? "light" : "dark"))} />

              {/* Divider */}
              <div style={{ width: 1, height: 18, backgroundColor: border(boardTheme), margin: "0 2px" }} />

              {/* Center board */}
              <button onClick={centerBoard} style={circleButton(boardTheme)} aria-label="Center board" title="Center board">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>
              </button>

              {/* Cloud sync indicator — only when signed in */}
              {isSignedIn && (
                <div
                  title={cloudSyncState === "synced" ? "Synced" : cloudSyncState === "saving" ? "Saving…" : cloudSyncState === "error" ? "Sync error — click to retry" : "Connecting…"}
                  onClick={cloudSyncState === "error" ? () => { setCloudSyncState("loading"); pushToCloud(); } : undefined}
                  style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: cloudSyncState === "synced" ? "#3db83d" : cloudSyncState === "error" ? "#c03030" : "#c8960a", boxShadow: cloudSyncState === "saving" ? "0 0 0 3px rgba(200,150,10,.25)" : "none", transition: "background-color .3s", cursor: cloudSyncState === "error" ? "pointer" : "default" }}
                />
              )}

              {/* Settings button — gear */}
              <button ref={settingsButtonRef} onClick={() => { setSettingsOpen(v => !v); setBoardsOpen(false); }} style={{ ...circleButton(boardTheme), ...(settingsOpen ? { backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.07)", border: `1px solid ${boardTheme === "dark" ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.15)"}` } : {}) }} aria-label="Settings" title="Settings">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>

              {/* Divider */}
              <div style={{ width: 1, height: 18, backgroundColor: border(boardTheme), margin: "0 2px" }} />

              {/* Boards button */}
              <button ref={boardButtonRef} onClick={() => { setBoardsOpen(v => !v); setSettingsOpen(false); }} style={{ ...buttonStyle(boardTheme, boardsOpen, true), minWidth: 80 }}>
                Boards
              </button>

              {/* Boards menu — compact dropdown */}
              <div ref={boardMenuRef} style={{
                position: "absolute", top: 44, right: 0, width: 248,
                maxHeight: 340, overflow: "auto",
                borderRadius: 12, border: `1px solid ${border(boardTheme)}`,
                backgroundColor: panel(boardTheme),
                boxShadow: boardTheme === "dark" ? "0 8px 32px rgba(0,0,0,.4)" : "0 8px 32px rgba(0,0,0,.12)",
                padding: "6px 0",
                opacity: boardsOpen ? 1 : 0,
                transform: boardsOpen ? "translateY(0)" : "translateY(-6px)",
                pointerEvents: boardsOpen ? "auto" : "none",
                transition: "opacity .13s ease, transform .13s ease",
                zIndex: 10,
              }}>
                <div style={{ padding: "6px 14px 4px", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 600 }}>Boards</div>
                {[...taskBoards, ...thoughtBoards].map((board) => (
                  <div key={board.id} style={{
                    display: "flex", alignItems: "center", gap: 0,
                    padding: "2px 6px",
                    backgroundColor: board.id === activeBoardId ? (boardTheme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)") : "transparent",
                    margin: "0 4px", borderRadius: 7,
                  }}>
                    <button onClick={() => { setActiveBoardId(board.id); setBoardsOpen(false); }} style={{
                      flex: 1, border: "none", background: "none", padding: "6px 8px",
                      textAlign: "left", fontSize: 13, fontWeight: board.id === activeBoardId ? 700 : 500,
                      color: pageText(boardTheme), cursor: "pointer",
                    }}>
                      {board.name}
                      <span style={{ marginLeft: 6, fontSize: 10, color: muted(boardTheme), fontWeight: 400 }}>{board.type === "task" ? "Task" : "Idea"}</span>
                    </button>
                    <button onClick={() => { setRenameBoardId(board.id); setRenameValue(board.name); }} style={{ background: "none", border: "none", padding: "4px 6px", cursor: "pointer", color: muted(boardTheme), fontSize: 11 }} title="Rename">✎</button>
                    {confirmDeleteId === board.id ? (
                      <>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ background: "none", border: "none", padding: "3px 5px", cursor: "pointer", color: muted(boardTheme), fontSize: 11, fontWeight: 600 }}>Cancel</button>
                        <button onClick={() => { deleteBoard(board.id); setConfirmDeleteId(null); }} style={{ background: "none", border: "none", padding: "3px 6px", cursor: "pointer", color: boardTheme === "dark" ? "rgba(255,100,100,.85)" : "rgba(160,30,30,.8)", fontSize: 11, fontWeight: 700 }}>Delete</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(board.id)} style={{ background: "none", border: "none", padding: "4px 6px", cursor: "pointer", color: boardTheme === "dark" ? "rgba(255,100,100,.6)" : "rgba(180,40,40,.5)", fontSize: 13 }} title="Delete">×</button>
                    )}
                  </div>
                ))}
                <div style={{ height: 1, backgroundColor: border(boardTheme), margin: "6px 10px" }} />
                <div style={{ display: "flex", gap: 6, padding: "4px 10px 6px" }}>
                  <button onClick={() => addBoard("task")} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 12 }}>+ Task Board</button>
                  <button onClick={() => addBoard("thought")} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 12 }}>+ Idea Board</button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Settings full-screen overlay ── */}
          {settingsOpen && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 30,
              backgroundColor: boardTheme === "dark" ? "rgba(5,7,10,.5)" : "rgba(0,0,0,.22)",
              backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            }} onClick={() => setSettingsOpen(false)} />
          )}
          <div ref={settingsRef} style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 360,
            zIndex: 31,
            backgroundColor: panel(boardTheme),
            borderLeft: `1px solid ${border(boardTheme)}`,
            boxShadow: settingsOpen ? (boardTheme === "dark" ? "-12px 0 40px rgba(0,0,0,.5)" : "-12px 0 40px rgba(0,0,0,.12)") : "none",
            transform: settingsOpen ? "translateX(0)" : "translateX(100%)",
            transition: "transform .22s cubic-bezier(.4,0,.2,1)",
            display: "flex", flexDirection: "column", overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${border(boardTheme)}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <BoardtivityLogo size={26} dark={boardTheme === "dark"} />
                <span style={{ fontSize: 16, fontWeight: 700, color: pageText(boardTheme) }}>Settings</span>
              </div>
              <button onClick={() => setSettingsOpen(false)} style={{ ...circleButton(boardTheme, 32), fontSize: 14 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: "20px 24px", display: "grid", gap: 28, alignContent: "start" }}>

              {/* Board Background */}
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 10 }}>Board Background</div>
                <div style={{ display: "flex", gap: 6, padding: 3, backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 10, border: `1px solid ${border(boardTheme)}` }}>
                  {([
                    { id: "grid" as const, label: "Grid", preview: (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                        {[0,6,12,18].map(x => <line key={`v${x}`} x1={x} y1={0} x2={x} y2={14} stroke="currentColor" strokeWidth="0.8" opacity="0.6"/>)}
                        {[0,7,14].map(y => <line key={`h${y}`} x1={0} y1={y} x2={18} y2={y} stroke="currentColor" strokeWidth="0.8" opacity="0.6"/>)}
                      </svg>
                    )},
                    { id: "dots" as const, label: "Dots", preview: (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                        {[3,9,15].flatMap(x => [3,10].map(y => <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="currentColor" opacity="0.6"/>))}
                      </svg>
                    )},
                    { id: "blank" as const, label: "Blank", preview: (
                      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                        <rect x="1" y="1" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="0.8" opacity="0.3"/>
                      </svg>
                    )},
                  ]).map(({ id, label, preview }) => {
                    const active = boardGrid === id;
                    return (
                      <button key={id} onClick={() => setBoardGrid(id)} style={{
                        flex: 1, height: 52, borderRadius: 8,
                        border: "none",
                        backgroundColor: active ? (boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#ffffff") : "transparent",
                        boxShadow: active ? (boardTheme === "dark" ? "0 1px 4px rgba(0,0,0,.3)" : "0 1px 4px rgba(0,0,0,.1)") : "none",
                        color: active ? pageText(boardTheme) : muted(boardTheme),
                        cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                        transition: "background-color .12s, box-shadow .12s",
                      }}>
                        {preview}
                        <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Idea Colors */}
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>Idea Colors</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12, color: muted(boardTheme), lineHeight: 1.5 }}>
                    Default color for new ideas. Pick one below, or use the shuffle to randomize. You can always change color per-card using the circle in the corner.
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", alignItems: "center", padding: 6, margin: -6 }}>
                    {/* Shuffle / randomize */}
                    <button onClick={() => setThoughtColorMode("random")} style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: 6, cursor: "pointer", padding: 0, border: "none",
                      background: "conic-gradient(hsl(0,100%,55%), hsl(30,100%,55%), hsl(60,100%,55%), hsl(90,100%,55%), hsl(120,100%,55%), hsl(150,100%,55%), hsl(180,100%,55%), hsl(210,100%,55%), hsl(240,100%,55%), hsl(270,100%,55%), hsl(300,100%,55%), hsl(330,100%,55%), hsl(360,100%,55%))",
                      boxShadow: thoughtColorMode === "random" ? `0 0 0 2.5px ${pageText(boardTheme)}, 0 0 0 4.5px ${boardTheme === "dark" ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.2)"}` : "none",
                    }} title="Randomize color" />
                    {NOTE_PALETTE.map((p, i) => (
                      <button key={i} onClick={() => { setThoughtColorMode("fixed"); setThoughtFixedColorIdx(i); }} style={{
                        flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                        border: (thoughtColorMode === "fixed" && thoughtFixedColorIdx === i) ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent",
                        outline: (thoughtColorMode === "fixed" && thoughtFixedColorIdx === i) ? `2px solid ${p.swatch}` : "none",
                        outlineOffset: 2,
                        backgroundColor: p.swatch, cursor: "pointer", padding: 0,
                      }} title={p.name} />
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: muted(boardTheme), lineHeight: 1.5 }}>
                    {thoughtColorMode === "random" ? "New ideas will get a random color each time." : `New ideas will default to ${NOTE_PALETTE[thoughtFixedColorIdx]?.name}.`}
                  </p>
                </div>
              </div>

              {/* Task Colors */}
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>Task Colors</div>
                <div style={{ display: "grid", gap: 14 }}>
                    {/* Mode toggle */}
                    <div style={{ display: "flex", gap: 6, padding: 3, backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 10, border: `1px solid ${border(boardTheme)}` }}>
                      {(["priority", "single"] as const).map(m => (
                        <button key={m} onClick={() => setTaskColorMode(m)} style={{
                          flex: 1, height: 32, borderRadius: 8, border: "none",
                          backgroundColor: taskColorMode === m ? (boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#ffffff") : "transparent",
                          boxShadow: taskColorMode === m ? (boardTheme === "dark" ? "0 1px 4px rgba(0,0,0,.3)" : "0 1px 4px rgba(0,0,0,.1)") : "none",
                          color: taskColorMode === m ? pageText(boardTheme) : muted(boardTheme),
                          fontSize: 13, fontWeight: taskColorMode === m ? 700 : 500, cursor: "pointer",
                          transition: "background-color .12s, box-shadow .12s",
                        }}>
                          {m === "priority" ? "By Priority" : "One Color"}
                        </button>
                      ))}
                    </div>

                    {taskColorMode === "priority" ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {(["High", "Medium", "Low"] as const).map((lvl) => {
                          const currentIdx = lvl === "High" ? taskHighColorIdx : lvl === "Medium" ? taskMedColorIdx : taskLowColorIdx;
                          const setter = lvl === "High" ? setTaskHighColorIdx : lvl === "Medium" ? setTaskMedColorIdx : setTaskLowColorIdx;
                          const customVal = lvl === "High" ? taskHighCustom : lvl === "Medium" ? taskMedCustom : taskLowCustom;
                          const setCustom = lvl === "High" ? setTaskHighCustom : lvl === "Medium" ? setTaskMedCustom : setTaskLowCustom;
                          const wheelRef = lvl === "High" ? colorWheelHighRef : lvl === "Medium" ? colorWheelMedRef : colorWheelLowRef;
                          return (
                            <div key={lvl}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: pageText(boardTheme), marginBottom: 6 }}>{lvl} priority</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: 6, margin: -6 }}>
                                {TASK_PALETTE.map((p, i) => (
                                  <button key={i} onClick={() => setter(i)} style={{
                                    width: 22, height: 22, borderRadius: "50%",
                                    border: (currentIdx === i && currentIdx < TASK_PALETTE.length) ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent",
                                    outline: (currentIdx === i && currentIdx < TASK_PALETTE.length) ? `2px solid ${p.swatch}` : "none",
                                    outlineOffset: 2,
                                    backgroundColor: p.swatch, cursor: "pointer", padding: 0,
                                  }} />
                                ))}
                                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                  <button
                                    onClick={() => { setter(TASK_PALETTE.length); wheelRef.current?.click(); }}
                                    title="Pick custom color"
                                    style={{
                                      position: "relative", width: 22, height: 22, borderRadius: 6, cursor: "pointer", padding: 0, border: "none", flexShrink: 0,
                                      background: customVal
                                        ? customVal
                                        : "conic-gradient(hsl(0,100%,55%), hsl(30,100%,55%), hsl(60,100%,55%), hsl(90,100%,55%), hsl(120,100%,55%), hsl(150,100%,55%), hsl(180,100%,55%), hsl(210,100%,55%), hsl(240,100%,55%), hsl(270,100%,55%), hsl(300,100%,55%), hsl(330,100%,55%), hsl(360,100%,55%))",
                                      boxShadow: currentIdx >= TASK_PALETTE.length ? `0 0 0 2.5px ${pageText(boardTheme)}, 0 0 0 4.5px ${customVal || "#fff"}` : "none",
                                    }}
                                  />
                                  <input ref={wheelRef} type="color"
                                    value={customVal || "#ff6600"}
                                    onChange={e => { setCustom(e.target.value); setter(TASK_PALETTE.length); }}
                                    style={{ position: "absolute", opacity: 0, width: 0, height: 0, top: 0, left: 0, pointerEvents: "none" }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 12, color: muted(boardTheme), marginBottom: 8 }}>Apply one color to all tasks regardless of priority.</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: 6, margin: -6 }}>
                          {TASK_PALETTE.map((p, i) => (
                            <button key={i} onClick={() => setTaskSingleColorIdx(i)} style={{
                              width: 22, height: 22, borderRadius: "50%",
                              border: (taskSingleColorIdx === i && taskSingleColorIdx < TASK_PALETTE.length) ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent",
                              outline: (taskSingleColorIdx === i && taskSingleColorIdx < TASK_PALETTE.length) ? `2px solid ${p.swatch}` : "none",
                              outlineOffset: 2,
                              backgroundColor: p.swatch, cursor: "pointer", padding: 0,
                            }} />
                          ))}
                          {/* Custom color — solid when picked, rainbow when not */}
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <button
                              onClick={() => { setTaskSingleColorIdx(TASK_PALETTE.length); colorWheelSingleRef.current?.click(); }}
                              title="Pick custom color"
                              style={{
                                position: "relative", width: 22, height: 22, borderRadius: 6, cursor: "pointer", padding: 0, border: "none", flexShrink: 0,
                                background: taskSingleCustom
                                  ? taskSingleCustom
                                  : "conic-gradient(hsl(0,100%,55%), hsl(30,100%,55%), hsl(60,100%,55%), hsl(90,100%,55%), hsl(120,100%,55%), hsl(150,100%,55%), hsl(180,100%,55%), hsl(210,100%,55%), hsl(240,100%,55%), hsl(270,100%,55%), hsl(300,100%,55%), hsl(330,100%,55%), hsl(360,100%,55%))",
                                boxShadow: taskSingleColorIdx >= TASK_PALETTE.length ? `0 0 0 2.5px ${pageText(boardTheme)}, 0 0 0 4.5px ${taskSingleCustom || "#fff"}` : "none",
                              }}
                            />
                            <input ref={colorWheelSingleRef} type="color"
                              value={taskSingleCustom || "#ff6600"}
                              onChange={e => { setTaskSingleCustom(e.target.value); setTaskSingleColorIdx(TASK_PALETTE.length); }}
                              style={{ position: "absolute", opacity: 0, width: 0, height: 0, top: 0, left: 0, pointerEvents: "none" }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
              </div>

              {/* Email Notifications */}
              {isSignedIn && (
                <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 2 }}>Email Notifications</div>
                  {(["dailyDigest", "weeklyDigest"] as const).map((key) => {
                    const labels: Record<string, string> = {
                      dailyDigest: "Daily task outline",
                      weeklyDigest: "Weekly task outline",
                    };
                    const enabled = emailPrefs ? emailPrefs[key] : true;
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 13, color: pageText(boardTheme) }}>{labels[key]}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = emailPrefs ?? { dailyDigest: true, weeklyDigest: true };
                            updateEmailPrefs({ ...current, [key]: !enabled });
                          }}
                          style={{
                            flexShrink: 0,
                            width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
                            backgroundColor: enabled ? (boardTheme === "dark" ? "#4a9eff" : "#2563eb") : (boardTheme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"),
                            position: "relative", transition: "background-color .18s",
                          }}
                          aria-label={`${enabled ? "Disable" : "Enable"} ${labels[key]}`}
                        >
                          <span style={{
                            position: "absolute", top: 3, left: enabled ? 21 : 3,
                            width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff",
                            transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                          }} />
                        </button>
                      </div>
                    );
                  })}
                  <p style={{ fontSize: 11, color: muted(boardTheme), margin: 0, lineHeight: 1.5 }}>
                    Sent to {user?.emailAddresses?.[0]?.emailAddress ?? "your email"}.
                  </p>
                </div>
              )}

              {/* BOB */}
              <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>BOB</div>
                  {!isPlus && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: muted(boardTheme), opacity: .6 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Plus only
                    </span>
                  )}
                </div>

                {isPlus ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    {/* About You */}
                    <div style={{
                      background: boardTheme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)",
                      border: `1px solid ${border(boardTheme)}`, borderRadius: 12, padding: "14px 14px 12px",
                      display: "grid", gap: 8,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: pageText(boardTheme), letterSpacing: ".01em" }}>About You</div>
                      <textarea
                        value={bobUserInfo}
                        onChange={e => setBobUserInfoFn({ userInfo: e.target.value })}
                        placeholder="Tell BOB about yourself — your name, role, goals, or anything helpful…"
                        rows={4}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          background: boardTheme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
                          border: `1px solid ${border(boardTheme)}`, borderRadius: 8,
                          padding: "8px 10px", fontSize: 13, color: pageText(boardTheme),
                          outline: "none", lineHeight: 1.6, resize: "vertical",
                        }}
                      />
                      <p style={{ margin: 0, fontSize: 11, color: muted(boardTheme), lineHeight: 1.5 }}>
                        BOB uses this context to personalize responses across all your devices.
                      </p>
                    </div>

                    {/* Auto-send toggle */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: pageText(boardTheme) }}>Send on silence</div>
                        <div style={{ fontSize: 11.5, color: muted(boardTheme), marginTop: 2 }}>Auto-send after a pause in speech</div>
                      </div>
                      <button
                        onClick={() => { const v = !bobAutoSend; setBobAutoSend(v); try { localStorage.setItem("bob_auto_send", String(v)); } catch {} }}
                        style={{
                          flexShrink: 0, width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
                          backgroundColor: bobAutoSend ? (boardTheme === "dark" ? "#4a9eff" : "#2563eb") : (boardTheme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"),
                          position: "relative", transition: "background-color .18s",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 3, left: bobAutoSend ? 21 : 3,
                          width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff",
                          transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                          display: "block",
                        }} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: boardTheme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)",
                    border: `1px solid ${border(boardTheme)}`, borderRadius: 12, padding: "16px 14px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: pageText(boardTheme) }}>BOB is a Plus feature</div>
                    <p style={{ margin: 0, fontSize: 12, color: muted(boardTheme), lineHeight: 1.55, maxWidth: 220 }}>
                      Your AI board brain — personalized context, voice commands, autopilot, and more.
                    </p>
                    <button onClick={() => { setSettingsOpen(false); setUpgradeOpen(true); }} style={{
                      padding: "7px 18px", borderRadius: 99, border: "none", cursor: "pointer",
                      background: boardTheme === "dark" ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)",
                      color: pageText(boardTheme), fontSize: 12, fontWeight: 700,
                    }}>Upgrade to Plus →</button>
                  </div>
                )}
              </div>

              {/* Calendar */}
              <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 2 }}>Calendar</div>
                <button
                  onClick={exportToIcs}
                  disabled={!notes.some(n => n.dueDate && !n.completed)}
                  style={{
                    ...buttonStyle(boardTheme, false),
                    width: "100%", fontSize: 13, height: 40,
                    opacity: notes.some(n => n.dueDate && !n.completed) ? 1 : 0.45,
                  }}
                >
                  Export tasks to calendar (.ics)
                </button>
                <p style={{ fontSize: 11, color: muted(boardTheme), margin: 0, lineHeight: 1.5 }}>
                  Exports all tasks with due dates. Open with Apple Calendar, or import into Google Calendar via Settings → Import.
                </p>
              </div>

              {/* Billing */}
              {isSignedIn && (
                <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>Billing</div>

                  {/* Plan card */}
                  <div style={{
                    background: boardTheme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)",
                    border: `1px solid ${border(boardTheme)}`, borderRadius: 12, padding: "14px 14px 12px",
                    display: "grid", gap: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: pageText(boardTheme) }}>
                          {isPlus ? "Boardtivity Plus" : "Free Plan"}
                        </div>
                        {isPlus && subscription?.currentPeriodEnd && (
                          <div style={{ fontSize: 11.5, color: muted(boardTheme), marginTop: 2 }}>
                            Renews {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        )}
                        {isPlus && subscription?.status === "past_due" && (
                          <div style={{ fontSize: 11.5, color: "#e05555", marginTop: 2 }}>Payment past due</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                        padding: "3px 10px", borderRadius: 999,
                        background: isPlus ? (boardTheme === "dark" ? "rgba(74,158,255,.15)" : "rgba(37,99,235,.1)") : (boardTheme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)"),
                        color: isPlus ? (boardTheme === "dark" ? "#4a9eff" : "#2563eb") : muted(boardTheme),
                        border: `1px solid ${isPlus ? (boardTheme === "dark" ? "rgba(74,158,255,.2)" : "rgba(37,99,235,.15)") : border(boardTheme)}`,
                      }}>
                        {isPlus ? "Active" : "Free"}
                      </span>
                    </div>

                    {isPlus ? (
                      <button
                        onClick={startPortal}
                        style={{ ...buttonStyle(boardTheme, false), width: "100%", fontSize: 13, height: 38 }}
                      >
                        Manage subscription
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSettingsOpen(false); setUpgradeOpen(true); }}
                        style={{ ...buttonStyle(boardTheme, true), width: "100%", fontSize: 13, height: 38 }}
                      >
                        Upgrade to Plus
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Account */}
              <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 2 }}>Account</div>
                {isSignedIn ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                      <span style={{ fontSize: 13, color: muted(boardTheme), opacity: .7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user?.emailAddresses?.[0]?.emailAddress}
                      </span>
                      {isPlus && (
                        <span style={{ flexShrink: 0, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: boardTheme === "dark" ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)", background: boardTheme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", border: `1px solid ${border(boardTheme)}`, borderRadius: 999, padding: "3px 9px", lineHeight: 1 }}>
                          Plus
                        </span>
                      )}
                    </div>
                    <div
                      onClick={cloudSyncState === "error" ? () => { setCloudSyncState("loading"); pushToCloud(); } : undefined}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: muted(boardTheme), cursor: cloudSyncState === "error" ? "pointer" : "default" }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: cloudSyncState === "synced" ? "#3db83d" : cloudSyncState === "error" ? "#c03030" : "#c8960a" }} />
                      {cloudSyncState === "synced" ? "Synced" : cloudSyncState === "saving" ? "Saving…" : cloudSyncState === "error" ? "Sync error — tap to retry" : "Connecting…"}
                    </div>
                    {confirmSignOut === "settings" ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setConfirmSignOut(null); setSettingsOpen(false); signOut({ redirectUrl: "/" }); }} style={{ ...buttonStyle(boardTheme, false), flex: 1, fontSize: 13, height: 42 }}>Yes, sign out</button>
                        <button onClick={() => setConfirmSignOut(null)} style={{ ...buttonStyle(boardTheme, false), flex: 1, fontSize: 13, height: 42 }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmSignOut("settings")} style={{ ...buttonStyle(boardTheme, false), width: "100%", fontSize: 14, height: 42 }}>Sign out</button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => { setSettingsOpen(false); openSignIn(); }} style={{ ...buttonStyle(boardTheme, false), width: "100%", fontSize: 14, height: 42 }}>Sign in</button>
                    <button onClick={() => { setSettingsOpen(false); openSignUp(); }} style={{ ...buttonStyle(boardTheme, true), width: "100%", fontSize: 14, height: 42 }}>Sign up</button>
                  </>
                )}
              </div>
              <div style={{ textAlign: "center", paddingTop: 12, fontSize: 11, color: muted(boardTheme) }}>
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: muted(boardTheme), textDecoration: "none" }}>Terms</a>
                <span style={{ margin: "0 6px" }}>·</span>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: muted(boardTheme), textDecoration: "none" }}>Privacy</a>
              </div>
            </div>
          </div>

          {/* Fullscreen button — bottom left */}
          <button
            onClick={toggleFullscreen}
            style={{ ...circleButton(boardTheme, 38), position: "absolute", left: 18, bottom: 18, zIndex: 3, boxShadow: "0 8px 16px rgba(89,72,48,.08)" }}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
              </svg>
            )}
          </button>

          {/* Add note button — bottom right */}
          <button
            onClick={() => {
              // Plus: use their default color (fixed mode) or grey (undefined); Free: random
              setComposerColorIdx(thoughtColorMode === "fixed" ? thoughtFixedColorIdx : undefined);
              setComposerOpen(true);
            }}
            style={{
              position: "absolute", right: 18, bottom: 18, zIndex: 3,
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 16px 0 12px", height: 38, borderRadius: 999,
              backgroundColor: boardTheme === "dark" ? "#23262b" : "#ffffff",
              border: `1px solid ${border(boardTheme)}`,
              color: boardTheme === "dark" ? "#f5f5f2" : "#433d35",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              boxShadow: "0 8px 16px rgba(89,72,48,.08)",
            }}
            aria-label={thoughtMode ? "Add idea" : "Add task"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {thoughtMode ? "Add Idea" : "Add Task"}
          </button>
      {renameBoardId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRenameBoardId(null);
          }}
        >
          <div style={{
            width: "min(320px, 100%)",
            borderRadius: 16,
            border: `1px solid ${border(boardTheme)}`,
            backgroundColor: boardTheme === "dark" ? "#1c1f25" : "#ffffff",
            boxShadow: boardTheme === "dark" ? "0 16px 48px rgba(0,0,0,.5)" : "0 16px 48px rgba(0,0,0,.14)",
            padding: "6px 6px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") setRenameBoardId(null);
              }}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 10,
                border: "none",
                backgroundColor: "transparent",
                color: pageText(boardTheme),
                padding: "0 12px",
                outline: "none",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 6, padding: "0 4px" }}>
              <button onClick={() => setRenameBoardId(null)} style={{ ...buttonStyle(boardTheme), flex: 1, fontSize: 13, height: 34 }}>Cancel</button>
              <button onClick={saveRename} style={{ ...buttonStyle(boardTheme, true), flex: 1, fontSize: 13, height: 34 }}>Save</button>
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
            backgroundColor: boardTheme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeComposer();
          }}
        >
          <div
            style={{
              width: thoughtMode ? "min(760px, 100%)" : "min(960px, 100%)",
              backgroundColor: boardTheme === "dark" ? "#1f2329" : "#fbf8f1",
              color: pageText(boardTheme),
              borderRadius: 16,
              border: `1px solid ${border(boardTheme)}`,
              boxShadow: "0 30px 100px rgba(0,0,0,.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${border(boardTheme)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme) }}>
                  Adding to {activeBoard.name}
                </div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
                  {thoughtMode ? "Add an idea" : "Add a task"}
                </div>
              </div>
              <button onClick={closeComposer} style={circleButton(boardTheme, 42)}>✕</button>
            </div>

            {drafts.length > 0 && (
              <div style={{ borderBottom: `1px solid ${border(boardTheme)}`, padding: "8px 20px", display: "flex", gap: 8, overflowX: "auto", alignItems: "center" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", color: muted(boardTheme), flexShrink: 0, fontWeight: 700 }}>Drafts</div>
                {drafts.map((d) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, borderRadius: 99, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: "4px 4px 4px 10px" }}>
                    <button onClick={() => loadDraft(d)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: pageText(boardTheme), padding: 0 }}>
                      {d.title || "Untitled"} <span style={{ color: muted(boardTheme), fontWeight: 400 }}>· {new Date(d.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </button>
                    <button onClick={() => deleteDraft(d.id)} style={{ ...circleButton(boardTheme, 20), fontSize: 12, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: thoughtMode ? "1fr" : "1fr 360px", gap: 16, padding: 18, alignItems: "start" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    borderRadius: 14,
                    backgroundColor: thoughtMode
                      ? (composerColorIdx !== undefined ? paletteBg(composerColorIdx, boardTheme) : (boardTheme === "dark" ? "#2a2d32" : "#ebebeb"))
                      : getBg(importance === "none" ? undefined : importance),
                    border: composerError.title ? "1px solid rgba(200,40,40,.5)" : "1px solid rgba(0,0,0,.05)",
                    padding: 18,
                    minHeight: thoughtMode ? 220 : 250,
                    transition: "background-color .25s ease",
                  }}
                >
                  <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme) }}>
                    {thoughtMode ? "Idea" : "Task"}
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
                    placeholder={thoughtMode ? "What’s your idea?" : "What do you need to do?"}
                    style={{
                      width: "100%",
                      minHeight: thoughtMode ? 130 : 110,
                      marginTop: 10,
                      border: "none",
                      background: "transparent",
                      resize: "none",
                      outline: "none",
                      color: pageText(boardTheme),
                      fontSize: thoughtMode ? 28 : 26,
                      lineHeight: 1.12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                    }}
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={thoughtMode ? "Optional note" : "Optional details"}
                    style={{
                      width: "100%",
                      minHeight: thoughtMode ? 28 : 44,
                      border: "none",
                      background: "transparent",
                      resize: "none",
                      outline: "none",
                      color: muted(boardTheme),
                      fontSize: thoughtMode ? 13 : 15,
                      lineHeight: 1.6,
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                {thoughtMode && (
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", padding: "4px 0" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: muted(boardTheme), opacity: .6, marginRight: 2 }}>Color</span>
                    <button
                      onClick={() => setComposerColorIdx(undefined)}
                      style={{ width: 24, height: 24, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: boardTheme === "dark" ? "#555" : "#ccc", border: composerColorIdx === undefined ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent", outline: composerColorIdx === undefined ? `2px solid ${boardTheme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)"}` : "none", outlineOffset: 2 }}
                      title="Grey"
                    />
                    {NOTE_PALETTE.map((col, i) => (
                      <button
                        key={i}
                        onClick={() => setComposerColorIdx(i)}
                        style={{ width: 24, height: 24, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: col.swatch, border: composerColorIdx === i ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent", outline: composerColorIdx === i ? `2px solid ${col.swatch}` : "none", outlineOffset: 2 }}
                      />
                    ))}
                  </div>
                )}
                {!thoughtMode && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div
                        style={{
                          ...fieldStyle(boardTheme),
                          position: "relative",
                          cursor: "pointer",
                          border: composerError.dueDate ? "1px solid rgba(200,40,40,.55)" : fieldStyle(boardTheme).border,
                          boxShadow: composerError.dueDate ? "0 0 0 3px rgba(200,40,40,.12)" : "none",
                        }}
                      >
                        <span style={{ color: dueDate ? pageText(boardTheme) : muted(boardTheme), pointerEvents: "none", position: "relative", zIndex: 0 }}>
                          {dueDate ? formatDate(dueDate) : "Due date"}
                        </span>
                        <input
                          ref={dateInputRef}
                          type="date"
                          value={dueDate}
                          onClick={() => { try { (dateInputRef.current as any).showPicker(); } catch {} }}
                          onChange={(e) => {
                            setDueDate(e.target.value);
                            setComposerError((prev) => ({ ...prev, dueDate: false }));
                          }}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            opacity: 0,
                            cursor: "pointer",
                            zIndex: 1,
                          }}
                        />
                      </div>
                      {dueDate && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="time"
                            value={dueTime}
                            onChange={e => setDueTime(e.target.value)}
                            style={{ flex: 1, height: 34, borderRadius: 8, border: `1px solid ${border(boardTheme)}`, background: boardTheme === "dark" ? "rgba(255,255,255,.06)" : "#fff", color: dueTime ? pageText(boardTheme) : muted(boardTheme), fontSize: 13, padding: "0 8px", fontFamily: "inherit", outline: "none", colorScheme: boardTheme === "dark" ? "dark" : "light" }}
                            placeholder="Time (optional)"
                          />
                          {dueTime && (
                            <button type="button" onClick={() => setDueTime("")} style={{ background: "none", border: "none", color: muted(boardTheme), fontSize: 14, opacity: .6, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                      )}
                    </div>

                    <select
                      value={importance}
                      onChange={(e) => {
                        setImportance(e.target.value as Importance);
                        setComposerError((prev) => ({ ...prev, importance: false }));
                      }}
                      style={{
                        ...fieldStyle(boardTheme),
                        appearance: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        cursor: "pointer",
                        color: pageText(boardTheme),
                        opacity: 0.92,
                        backgroundColor: getBg(importance === "none" ? undefined : importance),
                        border: composerError.importance ? "1px solid rgba(200,40,40,.55)" : fieldStyle(boardTheme).border,
                        boxShadow: composerError.importance ? "0 0 0 3px rgba(200,40,40,.12)" : "none",
                        transition: "background-color .2s ease",
                      }}
                    >
                      <option value="none">Set priority</option>
                      <option value="Low">Low priority</option>
                      <option value="Medium">Medium priority</option>
                      <option value="High">High priority</option>
                    </select>

                  </div>
                )}
              </div>

              <div style={{ display: thoughtMode ? "none" : "grid", gap: 12, alignContent: "start" }}>
                {!thoughtMode && (
                  <>
                    <div style={{ borderRadius: 12, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: 16 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme) }}>
                        Current tasks
                      </div>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {recentTasks.length === 0 ? (
                          <div style={{ color: muted(boardTheme), fontSize: 14 }}>No current tasks yet.</div>
                        ) : (
                          recentTasks.map((task) => (
                            <div key={task.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                              <span style={{ fontSize: 14, color: pageText(boardTheme) }}>{task.title}</span>
                              {task.dueDate ? <span style={pill(boardTheme)}>{formatDate(task.dueDate)}</span> : <span style={pill(boardTheme)}>No due date</span>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ borderRadius: 12, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme) }}>
                          BOB Planning
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {aiSteps.length > 0 && (
                            <button
                              onClick={() => {
                                const nextVariant = breakdownVariant + 1;
                                setBreakdownVariant(nextVariant);
                                const next = buildBreakdown(title, body, minutes, nextVariant);
                                setAiSteps(next);
                                setMinutes(next.reduce((s, st) => s + st.minutes, 0));
                              }}
                              style={{ ...buttonStyle(boardTheme, false, true), fontSize: 12, height: 28, padding: "0 10px" }}
                            >
                              Regenerate
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const next = buildBreakdown(title, body, minutes, breakdownVariant);
                              setAiSteps(next);
                              setMinutes(next.reduce((s, st) => s + st.minutes, 0));
                            }}
                            disabled={!title.trim()}
                            style={{ ...buttonStyle(boardTheme, true, true), fontSize: 12, height: 28, padding: "0 10px", opacity: !title.trim() ? 0.4 : 1, cursor: !title.trim() ? "not-allowed" : "pointer" }}
                          >
                            {aiSteps.length > 0 ? "Re-breakdown" : "BOB Breakdown"}
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                        {aiSteps.length === 0 ? (
                          <div style={{ color: muted(boardTheme), fontSize: 14 }}>
                            {title.trim() ? "Click BOB Breakdown to generate subtasks." : "Type a task first."}
                          </div>
                        ) : (
                          aiSteps.map((step) => (
                            <div key={step.id} style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${border(boardTheme)}`, paddingBottom: 8 }}>
                              <input
                                value={step.title}
                                onChange={(e) => setAiSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, title: e.target.value } : s))}
                                style={{ flex: 1, border: "none", background: "transparent", fontWeight: 600, fontSize: 14, color: pageText(boardTheme), outline: "none" }}
                              />
                              <button
                                onClick={() => {
                                  setAiSteps((prev) => prev.filter((s) => s.id !== step.id));
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: muted(boardTheme), fontSize: 16, padding: "0 2px", lineHeight: 1 }}
                              >×</button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: "grid", gap: 10 }}>
                  {Object.values(composerError).some(Boolean) && (
                    <div style={{ color: boardTheme === "dark" ? "#ffb4b4" : "#a32727", fontSize: 13, fontWeight: 600 }}>
                      Please fill out all required fields.
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button onClick={closeComposer} style={buttonStyle(boardTheme)}>Cancel</button>
                    <button onClick={createNote} style={buttonStyle(boardTheme, true)}>{thoughtMode ? "Create idea" : "Create task"}</button>
                  </div>
                </div>
              </div>

              {thoughtMode && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button onClick={closeComposer} style={buttonStyle(boardTheme)}>Cancel</button>
                    <button onClick={createNote} style={buttonStyle(boardTheme, true)}>Create idea</button>
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
            backgroundColor: boardTheme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) { setDetailNoteId(null); setDetailEditing(false); }
          }}
        >
          <div
            style={{
              width: "min(980px, 100%)",
              backgroundColor: boardTheme === "dark" ? "#1f2329" : "#fbf8f1",
              color: pageText(boardTheme),
              borderRadius: 16,
              border: `1px solid ${border(boardTheme)}`,
              boxShadow: "0 30px 100px rgba(0,0,0,.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${border(boardTheme)}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme) }}>
                    {detailEditing ? `Editing ${detailNote.type}` : detailNote.type === "task" ? "Task details" : "Idea"}
                  </div>
                  {detailNote.createdAt && !detailEditing && (
                    <div style={{ fontSize: 11, color: muted(boardTheme), opacity: .5 }}>
                      · Created {new Date(detailNote.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{detailNote.title}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!detailEditing && (
                  <button
                    onClick={() => {
                      setDetailEditTitle(detailNote.title);
                      setDetailEditBody(detailNote.body ?? "");
                      setDetailEditDueDate(detailNote.dueDate ?? "");
                      setDetailEditImportance(detailNote.importance ?? "none");
                      setDetailEditMinutes(detailNote.minutes ?? 60);
                      setDetailEditSteps(detailNote.steps.map(s => ({ ...s })));
                      setDetailEditColorIdx(detailNote.colorIdx);
                      setDetailEditing(true);
                    }}
                    style={{ ...circleButton(boardTheme, 36), fontSize: 14 }}
                    title={detailNote.type === "task" ? "Edit task" : "Edit idea"}
                  >✎</button>
                )}
                <button onClick={() => { setDetailNoteId(null); setDetailEditing(false); }} style={circleButton(boardTheme, 36)}>✕</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: detailNote.type === "task" ? "1fr 272px" : "1fr", gap: 14, padding: 18, maxHeight: "calc(90vh - 96px)", overflow: "hidden" }}>
              {/* Left: focus card + subtasks */}
              {/* Left panel — green when completed OR all steps done */}
              {(() => {
                const effectiveDone = detailNote.completed || (detailNote.steps.length > 0 && detailNote.steps.every(s => s.done));
                // Auto-mark complete if all steps done
                if (!detailNote.completed && effectiveDone) {
                  setNotes(ns => ns.map(n => n.id === detailNote.id ? { ...n, completed: true } : n));
                }
                return null;
              })()}
              <div style={{ borderRadius: 13, backgroundColor: (detailNote.completed || (detailNote.steps.length > 0 && detailNote.steps.every(s => s.done))) ? (boardTheme === "dark" ? "#0e2e18" : "#e6f9ee") : detailNote.type === "task" ? getBg(detailEditing ? (detailEditImportance === "none" ? undefined : detailEditImportance) : (detailNote.importance === "none" ? undefined : detailNote.importance)) : (() => { const ci = detailEditing ? detailEditColorIdx : detailNote.colorIdx; return ci !== undefined ? paletteBg(ci, boardTheme) : (boardTheme === "dark" ? "#2a2d32" : "#ebebeb"); })(), border: (detailNote.completed || (detailNote.steps.length > 0 && detailNote.steps.every(s => s.done))) ? `1px solid ${boardTheme === "dark" ? "rgba(60,180,90,.2)" : "rgba(60,180,90,.15)"}` : "1px solid rgba(0,0,0,.05)", padding: 20, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto" }}>
                {/* Focus header */}
                <div style={{ paddingBottom: 16, borderBottom: `1px solid ${border(boardTheme)}`, marginBottom: 16 }}>
                  {detailNote.type === "task" && detailEditing ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <input
                        autoFocus
                        value={detailEditTitle}
                        onChange={e => setDetailEditTitle(e.target.value)}
                        placeholder="Task title…"
                        style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 18, fontWeight: 700, color: pageText(boardTheme), fontFamily: "inherit", padding: 0, boxSizing: "border-box" }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "start" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 1 }}>Due date</div>
                          <div style={{ position: "relative", width: "100%", border: `1px solid ${border(boardTheme)}`, borderRadius: 8, padding: "6px 10px", boxSizing: "border-box", display: "flex", alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: detailEditDueDate ? pageText(boardTheme) : muted(boardTheme), flex: 1, pointerEvents: "none" }}>
                              {detailEditDueDate ? isoToMDY(detailEditDueDate) : "mm-dd-yyyy"}
                            </span>
                            <input
                              type="date"
                              value={detailEditDueDate}
                              onChange={e => setDetailEditDueDate(e.target.value)}
                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 1 }}
                            />
                          </div>
                          {detailEditDueDate && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="time"
                                value={detailEditDueTime}
                                onChange={e => setDetailEditDueTime(e.target.value)}
                                placeholder="Time (optional)"
                                style={{ flex: 1, height: 32, borderRadius: 8, border: `1px solid ${border(boardTheme)}`, background: boardTheme === "dark" ? "rgba(255,255,255,.06)" : "#fff", color: detailEditDueTime ? pageText(boardTheme) : muted(boardTheme), fontSize: 13, padding: "0 8px", fontFamily: "inherit", outline: "none", colorScheme: boardTheme === "dark" ? "dark" : "light" }}
                              />
                              {detailEditDueTime && (
                                <button type="button" onClick={() => setDetailEditDueTime("")} style={{ background: "none", border: "none", color: muted(boardTheme), fontSize: 14, opacity: .6, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 5 }}>Priority</div>
                          <select
                            value={detailEditImportance}
                            onChange={e => setDetailEditImportance(e.target.value as Importance)}
                            style={{ width: "100%", background: panel(boardTheme), border: `1px solid ${border(boardTheme)}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, color: pageText(boardTheme), fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                          >
                            <option value="none">No priority</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {detailNote.dueDate && (
                        <div style={{
                          fontSize: 15,
                          fontWeight: 600,
                          marginBottom: 6,
                          color: (() => { const d = detailNote.dueDate; const done = detailNote.completed || detailNote.steps.every(s => s.done); if (!d || done) return pageText(boardTheme); if (d < todayStr()) return boardTheme === "dark" ? "#ff6666" : "#c03030"; if (d === todayStr()) return boardTheme === "dark" ? "#ffb347" : "#b86800"; return pageText(boardTheme); })(),
                        }}>
                          Due {formatDate(detailNote.dueDate)}{fmtTime(detailNote.dueTime)}
                        </div>
                      )}
                      {detailNote.type !== "task" && detailEditing ? (
                        <>
                          <input
                            autoFocus
                            value={detailEditTitle}
                            onChange={e => setDetailEditTitle(e.target.value)}
                            placeholder="Idea title…"
                            style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 18, fontWeight: 700, color: pageText(boardTheme), fontFamily: "inherit", padding: 0, marginBottom: 10, boxSizing: "border-box" }}
                          />
                          <textarea
                            value={detailEditBody}
                            onChange={e => setDetailEditBody(e.target.value)}
                            placeholder="Add a note…"
                            rows={4}
                            style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontSize: 14, color: pageText(boardTheme), fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box", padding: 0 }}
                          />
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                            <button
                              onClick={() => setDetailEditColorIdx(undefined)}
                              style={{ width: 20, height: 20, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: boardTheme === "dark" ? "#555" : "#ccc", border: detailEditColorIdx === undefined ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent", outline: detailEditColorIdx === undefined ? `2px solid ${boardTheme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)"}` : "none", outlineOffset: 2 }}
                              title="Grey"
                            />
                            {NOTE_PALETTE.map((col, i) => (
                              <button
                                key={i}
                                onClick={() => setDetailEditColorIdx(i)}
                                style={{ width: 20, height: 20, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: col.swatch, border: detailEditColorIdx === i ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent", outline: detailEditColorIdx === i ? `2px solid ${col.swatch}` : "none", outlineOffset: 2 }}
                              />
                            ))}
                          </div>
                        </>
                      ) : detailNote.body ? (
                        <div style={{ fontSize: 14, color: muted(boardTheme), lineHeight: 1.7 }}>
                          {detailNote.body}
                        </div>
                      ) : detailNote.type !== "task" ? (
                        <div style={{ fontSize: 14, color: muted(boardTheme), opacity: .4, lineHeight: 1.7, fontStyle: "italic" }}>No note added.</div>
                      ) : null}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                        {detailNote.importance && detailNote.importance !== "none" && (
                          <span style={pill(boardTheme)}>{detailNote.importance} priority</span>
                        )}
                        {detailNote.type === "task" && (() => {
                          const doneCount = detailNote.steps.filter(s => s.done).length;
                          const total = detailNote.steps.length;
                          const completed = detailNote.completed || (total > 0 && doneCount === total);
                          if (completed) return <span style={pill(boardTheme)}>Completed</span>;
                          if (total > 0 && doneCount > 0) return <span style={pill(boardTheme)}>{doneCount}/{total} done</span>;
                          if ((detailNote.totalTimeSpent ?? 0) > 0) return null;
                          return <span style={pill(boardTheme)}>Not started</span>;
                        })()}
                        {(detailNote.totalTimeSpent ?? 0) > 0 && (
                          <span style={pill(boardTheme)}>
                            {(detailNote.totalTimeSpent ?? 0) >= 60
                              ? `${Math.floor((detailNote.totalTimeSpent ?? 0) / 60)}h ${(detailNote.totalTimeSpent ?? 0) % 60 > 0 ? `${(detailNote.totalTimeSpent ?? 0) % 60}m` : ""} focused`
                              : `${detailNote.totalTimeSpent}m focused`}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {detailNote.type === "task" ? (
                  <>
                    <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 12 }}>
                      Subtasks
                    </div>
                    {detailEditing ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {detailNote.steps.length === 0 && detailEditSteps.length === 0 && (
                          <div style={{ borderRadius: 10, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: "12px 14px", display: "grid", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme) }}>BOB Planning</div>
                              <button
                                onClick={() => {
                                  const steps = buildBreakdown(detailEditTitle || detailNote.title, detailNote.body ?? "", detailNote.minutes ?? 60, detailBreakdownVariant);
                                  setDetailEditSteps(steps);
                                }}
                                disabled={!detailEditTitle.trim() && !detailNote.title.trim()}
                                style={{ ...buttonStyle(boardTheme, true, true), fontSize: 12, height: 28, padding: "0 10px", opacity: (!detailEditTitle.trim() && !detailNote.title.trim()) ? 0.4 : 1 }}
                              >BOB Breakdown</button>
                            </div>
                            <div style={{ fontSize: 13, color: muted(boardTheme) }}>Let BOB break this task into subtasks, or add them manually below.</div>
                          </div>
                        )}
                        {detailEditSteps.map((step) => (
                          <div key={step.id} style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${border(boardTheme)}`, paddingBottom: 8 }}>
                            <input
                              value={step.title}
                              placeholder="Subtask title…"
                              onChange={e => setDetailEditSteps(prev => prev.map(s => s.id === step.id ? { ...s, title: e.target.value } : s))}
                              style={{ flex: 1, border: `1px solid ${border(boardTheme)}`, borderRadius: 6, background: boardTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", fontWeight: 600, fontSize: 14, color: pageText(boardTheme), outline: "none", fontFamily: "inherit", padding: "4px 8px" }}
                            />
                            <button
                              onClick={() => setDetailEditSteps(prev => prev.filter(s => s.id !== step.id))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: muted(boardTheme), fontSize: 14, padding: "0 4px", lineHeight: 1, opacity: .6 }}
                            >✕</button>
                          </div>
                        ))}
                        {detailEditSteps.length > 0 && (
                          <button
                            onClick={() => {
                              const nextVariant = detailBreakdownVariant + 1;
                              setDetailBreakdownVariant(nextVariant);
                              const steps = buildBreakdown(detailEditTitle || detailNote.title, detailNote.body ?? "", detailNote.minutes ?? 60, nextVariant);
                              setDetailEditSteps(steps);
                            }}
                            style={{ height: 28, borderRadius: 8, border: `1px solid ${border(boardTheme)}`, background: "none", color: muted(boardTheme), fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                          >BOB Breakdown again</button>
                        )}
                        <button
                          onClick={() => setDetailEditSteps(prev => [...prev, { id: genId(), title: "", minutes: 15, done: false, x: 0, y: 0 }])}
                          style={{ height: 36, borderRadius: 8, border: `1.5px dashed ${boardTheme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.22)"}`, background: boardTheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: muted(boardTheme), fontSize: 13, cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "left", paddingLeft: 12, display: "flex", alignItems: "center", gap: 6 }}
                        ><span style={{ fontSize: 16, lineHeight: 1, opacity: 0.7 }}>+</span> Type a subtask…</button>
                      </div>
                    ) : detailNote.steps.length === 0 ? (
                      <div style={{ color: muted(boardTheme), fontSize: 14, lineHeight: 1.6 }}>
                        No subtasks for this task.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {detailNote.steps.map((step) => (
                          <button
                            key={step.id}
                            onClick={() => {}}
                            style={{
                              borderRadius: 9,
                              border: step.done
                                ? `1px solid ${boardTheme === "dark" ? "rgba(60,180,90,.3)" : "rgba(60,180,90,.25)"}`
                                : `1px solid ${border(boardTheme)}`,
                              backgroundColor: step.done
                                ? (boardTheme === "dark" ? "rgba(40,140,70,.18)" : "rgba(60,190,90,.10)")
                                : (boardTheme === "dark" ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.72)"),
                              padding: "13px 16px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "background-color .15s ease, border-color .15s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  flexShrink: 0,
                                  border: step.done ? "1.5px solid #3d8b40" : `1.5px solid ${border(boardTheme)}`,
                                  backgroundColor: step.done ? "#6fc46b" : "transparent",
                                  display: "inline-block",
                                }}
                              />
                              <span style={{ fontWeight: 600, fontSize: 14, color: pageText(boardTheme) }}>{step.title}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {detailEditing && (
                      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        <button onClick={() => setDetailEditing(false)} style={buttonStyle(boardTheme)}>Cancel</button>
                        <button
                          onClick={() => {
                            if (!detailEditTitle.trim()) return;
                            const newSteps = detailEditSteps.filter(s => s.title.trim());
                            const newMinutes = newSteps.length > 0
                              ? newSteps.reduce((s, st) => s + st.minutes, 0)
                              : detailEditMinutes;
                            setNotes(ns => ns.map(n => n.id === detailNote.id ? {
                              ...n,
                              title: detailEditTitle.trim(),
                              dueDate: detailEditDueDate || undefined,
                              dueTime: detailEditDueTime || undefined,
                              importance: detailEditImportance,
                              minutes: newMinutes,
                              steps: (() => {
                                const laid = n.flowMode === "chain" ? layoutChain(n.x, n.y, newSteps) : layoutWeb(n.x, n.y, newSteps);
                                return newSteps.map((s, i) => (s.x === 0 && s.y === 0) ? laid[i] : s);
                              })(),
                            } : n));
                            scheduleDueDateReminder(detailNote.id, detailEditTitle.trim() || detailNote.title, detailEditDueDate || undefined, detailEditDueTime || undefined);
                            setDetailEditing(false);
                          }}
                          style={buttonStyle(boardTheme, true)}
                        >Save</button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {detailEditing ? (
                      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        <button
                          onClick={() => setDetailEditing(false)}
                          style={buttonStyle(boardTheme)}
                        >Cancel</button>
                        <button
                          onClick={() => {
                            if (!detailEditTitle.trim()) return;
                            setNotes(ns => ns.map(n => n.id === detailNote.id ? { ...n, title: detailEditTitle.trim(), body: detailEditBody.trim(), colorIdx: detailEditColorIdx } : n));
                            setDetailEditing(false);
                          }}
                          style={buttonStyle(boardTheme, true)}
                        >Save</button>
                      </div>
                    ) : null}
                    <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 10 }}>Connections</div>
                    {detailNote.linkedNoteIds.length === 0 ? (
                      <div style={{ color: muted(boardTheme), fontSize: 14, lineHeight: 1.6 }}>
                        Drag this idea over another to connect them. Hold over a connected idea to unlink.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {detailNote.linkedNoteIds.map((linkedId) => {
                          const linked = activeNotes.find(n => n.id === linkedId);
                          return linked ? (
                            <span key={linkedId} style={{ ...pill(boardTheme), fontSize: 13 }}>{linked.title}</span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {/* Delete idea */}
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${border(boardTheme)}` }}>
                      {confirmDeleteId === detailNote.id ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 13 }}>Cancel</button>
                          <button onClick={() => { deleteTask(detailNote.id); setConfirmDeleteId(null); }} style={{ flex: 1, height: 38, borderRadius: 999, border: "1px solid rgba(200,50,50,.4)", backgroundColor: boardTheme === "dark" ? "rgba(200,50,50,.18)" : "rgba(200,50,50,.10)", color: boardTheme === "dark" ? "rgba(255,130,130,.9)" : "rgba(160,30,30,.85)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm delete</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(detailNote.id)} style={{ width: "100%", height: 38, background: "none", border: "none", color: boardTheme === "dark" ? "rgba(255,100,100,.65)" : "rgba(160,40,40,.55)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          Delete idea
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Right: focus + flow + actions */}
              {detailNote.type === "task" && (() => {
                return (
                  <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                    {/* Focus card */}
                    {(() => {
                      const incompleteSteps = detailNote.steps.filter(s => !s.done);
                      const nextStep = incompleteSteps[0] ?? null;
                      const allSubtasksDone = detailNote.steps.length > 0 && incompleteSteps.length === 0;
                      const taskDone = detailNote.completed;
                      return (
                        <div style={{ borderRadius: 13, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: 18 }}>
                          <div style={{ fontSize: 11, letterSpacing: ".13em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 14 }}>
                            Focus
                          </div>
                          {taskDone || allSubtasksDone ? (
                            <div style={{
                              height: 50, borderRadius: 999,
                              backgroundColor: boardTheme === "dark" ? "rgba(60,180,90,.14)" : "rgba(60,180,90,.1)",
                              border: `1px solid ${boardTheme === "dark" ? "rgba(60,180,90,.3)" : "rgba(60,180,90,.22)"}`,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                              color: boardTheme === "dark" ? "rgba(100,220,120,.95)" : "rgba(30,120,60,.9)",
                              fontWeight: 700, fontSize: 14,
                            }}>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                                <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeOpacity="0.5"/>
                                <polyline points="4.5,8.5 7,11 11.5,5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Task complete
                            </div>
                          ) : (
                            <>
                              {nextStep ? (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ fontSize: 11, letterSpacing: ".11em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 6 }}>
                                    Next up · {incompleteSteps.length} remaining
                                  </div>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: pageText(boardTheme) }}>{nextStep.title}</div>
                                </div>
                              ) : (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: pageText(boardTheme) }}>{detailNote.title}</div>
                                </div>
                              )}
                              <button
                                onClick={() => startFocus(detailNote.id, detailNote.steps.length > 0)}
                                style={{
                                  width: "100%", height: 50, borderRadius: 999, border: "none",
                                  backgroundColor: boardTheme === "dark" ? "#f5f5f2" : "#111315",
                                  color: boardTheme === "dark" ? "#111315" : "#f7f8fb",
                                  fontWeight: 700, fontSize: 15, cursor: "pointer",
                                  boxShadow: "0 3px 14px rgba(0,0,0,.16)",
                                }}
                              >
                                Start focus
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Task flow */}
                    {detailNote.steps.length > 0 && (
                      <div style={{ borderRadius: 12, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: 16 }}>
                        <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 12 }}>
                          Task flow
                        </div>
                        {/* Segmented Taskweb / Taskchain toggle */}
                        <div style={{ display: "flex", gap: 0, borderRadius: 8, border: `1px solid ${border(boardTheme)}`, overflow: "hidden" }}>
                          {(["web", "chain"] as const).map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setFlowMode(detailNote, mode)}
                              style={{
                                flex: 1,
                                height: 38,
                                border: "none",
                                backgroundColor: detailNote.flowMode === mode
                                  ? (boardTheme === "dark" ? "#f5f5f2" : "#111315")
                                  : "transparent",
                                color: detailNote.flowMode === mode
                                  ? (boardTheme === "dark" ? "#111315" : "#f7f8fb")
                                  : muted(boardTheme),
                                fontWeight: 700,
                                fontSize: 13,
                                cursor: "pointer",
                                transition: "background-color .15s ease, color .15s ease",
                              }}
                            >
                              {mode === "web" ? "Taskweb" : "Taskchain"}
                            </button>
                          ))}
                        </div>
                        {/* Show / hide toggle */}
                        <button
                          onClick={() => { toggleFlow(detailNote.id); setDetailNoteId(null); }}
                          style={{
                            marginTop: 8, width: "100%", height: 34,
                            borderRadius: 8, border: `1px solid ${border(boardTheme)}`,
                            backgroundColor: "transparent",
                            color: muted(boardTheme), fontSize: 12, fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {detailNote.showFlow ? "Hide from board" : "Show on board"}
                        </button>
                      </div>
                    )}

                    {/* Delete action */}
                    <div style={{ borderRadius: 12, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: "8px 12px" }}>
                      {confirmDeleteId === detailNote.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 12 }}>Cancel</button>
                          <button onClick={() => { deleteTask(detailNote.id); setConfirmDeleteId(null); }} style={{ flex: 1, height: 36, borderRadius: 999, border: "1px solid rgba(200,50,50,.4)", backgroundColor: boardTheme === "dark" ? "rgba(200,50,50,.18)" : "rgba(200,50,50,.10)", color: boardTheme === "dark" ? "rgba(255,130,130,.9)" : "rgba(160,30,30,.85)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirm delete</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(detailNote.id)} style={{ width: "100%", height: 36, background: "none", border: "none", color: boardTheme === "dark" ? "rgba(255,100,100,.65)" : "rgba(160,40,40,.55)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          Delete {detailNote.type === "task" ? "task" : "idea"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
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
            backgroundColor: boardTheme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
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
              backgroundColor: boardTheme === "dark" ? "#1f2329" : "#fbf8f1",
              color: pageText(boardTheme),
              borderRadius: 9,
              border: `1px solid ${border(boardTheme)}`,
              boxShadow: "0 30px 100px rgba(0,0,0,.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${border(boardTheme)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme) }}>Subtask</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{stepModal.title}</div>
              </div>
              <button onClick={() => setActiveStep(null)} style={circleButton(boardTheme, 40)}>✕</button>
            </div>
            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={pill(boardTheme)}>{stepModal.done ? "Completed" : "Not started"}</span>
              </div>
              {stepModal.done ? (
                <div style={{ fontSize: 13, color: muted(boardTheme), lineHeight: 1.5 }}>
                  This subtask is already completed. Complete steps in order using Focus Mode.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: muted(boardTheme), lineHeight: 1.5 }}>
                    Complete subtasks in order through Focus Mode to stay on track.
                  </div>
                  <button
                    onClick={() => {
                      setActiveStep(null);
                      startFocus(activeStep.noteId, true);
                    }}
                    style={buttonStyle(boardTheme, true)}
                  >
                    Start Focus Mode
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {focusOpen && focusNoteId && (() => {
        const focusNote = notes.find(n => n.id === focusNoteId);
        if (!focusNote) return null;
        const focusStep = focusStepId ? focusNote?.steps.find(s => s.id === focusStepId) : null;
        const completedLabel = focusStep ? focusStep.title : focusNote?.title;
        const isSubtask = !!focusStep;
        const isLastSubtask = isSubtask && !focusNextStep && focusChainMode;
        const allSteps = focusNote?.steps ?? [];

        // Progress bar math
        const totalMinutes = focusChainMode && allSteps.length > 0
          ? allSteps.reduce((sum, s) => sum + (s.minutes ?? 25), 0)
          : (focusStep?.minutes ?? focusNote?.minutes ?? 60);
        const totalSecs = totalMinutes * 60;
        const currentStepSecs = (focusStep?.minutes ?? focusNote?.minutes ?? 60) * 60;
        const currentIdx = focusStep ? allSteps.findIndex(s => s.id === focusStepId) : -1;
        const doneStepsSecs = focusChainMode && currentIdx > 0
          ? allSteps.slice(0, currentIdx).reduce((sum, s) => sum + (s.minutes ?? 25) * 60, 0)
          : 0;
        const elapsedSecs = doneStepsSecs + (currentStepSecs - focusSecondsLeft);
        const progressPct = Math.min(100, Math.max(0, (elapsedSecs / totalSecs) * 100));

        const focusBtn: CSSProperties = {
          height: 40, borderRadius: 999,
          border: "1px solid rgba(255,255,255,.14)",
          backgroundColor: "rgba(255,255,255,.08)",
          color: "rgba(247,248,251,.75)",
          padding: "0 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
        };
        const focusBtnPrimary = focusBtn;
        const focusBtnSecondary = focusBtn;
        const focusBtnGhost: CSSProperties = {
          ...focusBtn,
          border: "1px solid rgba(220,60,60,.25)",
          backgroundColor: "rgba(220,60,60,.10)",
          color: "rgba(255,160,160,.7)",
        };

        // Per-step fill percentages
        const stepFills = allSteps.map((s) => {
          if (s.done) return 100;
          if (s.id === focusStepId) {
            const stepTotal = (s.minutes ?? 25) * 60;
            return Math.min(100, Math.max(0, ((stepTotal - focusSecondsLeft) / stepTotal) * 100));
          }
          return 0;
        });

        // Segment geometry: each step's start% and width% of total bar
        const segWidthPcts = allSteps.map(s =>
          totalMinutes > 0 ? ((s.minutes ?? 25) / totalMinutes) * 100 : 0
        );
        const segStartPcts = allSteps.map((_, i) =>
          segWidthPcts.slice(0, i).reduce((a, b) => a + b, 0)
        );

        // Current subtask fill (0–100% of just this step)
        const currentStepFill = focusStep
          ? Math.min(100, Math.max(0, (focusSecondsLeft / currentStepSecs) * 100))
          : Math.min(100, Math.max(0, 100 - progressPct));

        // Shared progress bar sub-component (inline)
        const progressBar = (dimmed = false) => {
          const hasChain = focusChainMode && allSteps.length > 1;
          const trackAlpha = dimmed ? ".07" : ".10";
          const fillAlpha = dimmed ? ".22" : ".88";
          const barColor = `rgba(247,248,251,${fillAlpha})`;
          const trackColor = `rgba(255,255,255,${trackAlpha})`;
          return (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: hasChain ? 16 : 0 }}>
            </div>
          );
        };

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 900,
              backgroundColor: focusCompleted
                ? "rgba(6,20,9,.98)"
                : focusPaused
                  ? "rgba(7,8,18,.98)"
                  : "rgba(6,7,10,.98)",
              color: "#f7f8fb",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "40px 28px", textAlign: "center",
              transition: "background-color .7s ease",
            }}
          >
            {focusCompleted ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  backgroundColor: "rgba(80,180,100,.15)",
                  border: "1.5px solid rgba(100,210,120,.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <polyline points="5,12 9,16 17,7" stroke="#6fc46b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ marginTop: 20, fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(247,248,251,.35)", fontWeight: 500 }}>
                  {isLastSubtask ? "task complete" : isSubtask ? "subtask complete" : "task complete"}
                </div>
                <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, color: "#f7f8fb", letterSpacing: "-.02em", lineHeight: 1.2 }}>
                  {isLastSubtask ? (focusNote?.title ?? completedLabel) : completedLabel}
                </div>
                {focusNextStep ? (
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(247,248,251,.4)" }}>
                    Up next — <span style={{ color: "rgba(247,248,251,.7)", fontWeight: 500 }}>{focusNextStep.title}</span>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(120,210,130,.65)" }}>
                    All done — great work!
                  </div>
                )}
                <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
                  {focusNextStep ? (
                    <>
                      <button onClick={advanceToNext} style={focusBtnPrimary}>
                        Start {focusNextStep.title}
                      </button>
                      <button
                        onClick={() => focusNoteId ? closeFocusWithReview(focusNoteId) : undefined}
                        style={focusBtnGhost}
                      >
                        Finish
                      </button>
                    </>
                  ) : (
                    <button onClick={() => focusNoteId ? closeFocusWithReview(focusNoteId) : undefined} style={focusBtnPrimary}>
                      Done
                    </button>
                  )}
                </div>
              </div>
            ) : focusPaused ? (
              <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                <div style={{ fontSize: 13, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(247,248,251,.5)", fontWeight: 600 }}>
                  Break
                </div>
                <div style={{ marginTop: 36, fontSize: 88, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", color: "#f7f8fb", lineHeight: 1 }}>
                  {String(Math.floor(breakSecondsLeft / 60)).padStart(2, "0")}:{String(breakSecondsLeft % 60).padStart(2, "0")}
                </div>
                <div style={{ marginTop: 10, fontSize: 15, color: "rgba(247,248,251,.4)", letterSpacing: ".01em" }}>
                  Resumes automatically
                </div>
                <div style={{ marginTop: 48, width: "100%" }}>
                  {progressBar(true)}
                </div>
                <div style={{ marginTop: 44, display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => { focusTotalSecsRef.current = focusPausedSecsRef.current; focusStartedAtRef.current = Date.now(); setFocusPaused(false); setBreakSecondsLeft(0); }} style={focusBtnPrimary}>
                    Resume now
                  </button>
                  <button onClick={() => setFocusExitConfirm(true)} style={focusBtnGhost}>
                    Exit
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                {(focusChainMode && focusNote && focusStep) && (
                  <div style={{ fontSize: 13, letterSpacing: ".16em", color: "rgba(247,248,251,.5)", fontWeight: 600 }}>
                    {`${focusNote.steps.findIndex(s => s.id === focusStepId) + 1} / ${focusNote.steps.length}`}
                  </div>
                )}
                <div style={{
                  marginTop: (focusChainMode && focusNote && focusStep) ? 12 : 0,
                  fontSize: 19, fontWeight: 600,
                  color: "rgba(247,248,251,.75)",
                  letterSpacing: "-.01em", lineHeight: 1.35,
                  maxWidth: 360,
                }}>
                  {focusStep ? focusStep.title : focusNote?.title}
                </div>
                <div style={{ marginTop: 28, fontSize: 96, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1, color: "#f7f8fb" }}>
                  {(() => { const tm = Math.floor(focusSecondsLeft / 60); const h = Math.floor(tm / 60); const m = tm % 60; const s = focusSecondsLeft % 60; return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; })()}
                </div>
                <div style={{ marginTop: 48, width: "100%" }}>
                  {progressBar(false)}
                </div>
                <div style={{ marginTop: 44, display: "flex", gap: 10, alignItems: "center" }}>
                  {focusTotalSecsRef.current >= 30 * 60 && (
                    <button onClick={() => { focusPausedSecsRef.current = focusSecondsLeft; setFocusPaused(true); setBreakSecondsLeft(300); }} style={focusBtnPrimary}>
                      5 min break
                    </button>
                  )}
                  {!!isAdmin && (
                    <button onClick={() => { focusTotalSecsRef.current = 0; focusStartedAtRef.current = Date.now(); }} style={focusBtnSecondary}>
                      Skip
                    </button>
                  )}
                  <button onClick={() => setFocusExitConfirm(true)} style={focusBtnGhost}>
                    Exit
                  </button>
                </div>
              </div>
            )}

            {/* Exit confirmation overlay */}
            {focusExitConfirm && focusNoteId && (
              <div style={{ position: "absolute", inset: 0, zIndex: 10, backgroundColor: "rgba(6,7,10,.88)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, textAlign: "center", padding: "40px 28px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f7f8fb", marginBottom: 8 }}>Save your progress?</div>
                <div style={{ fontSize: 14, color: "rgba(247,248,251,.45)", marginBottom: 28, lineHeight: 1.65 }}>
                  {Math.floor((Date.now() - focusSessionStartRef.current) / 60000)} min focused — log it before you go.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => closeFocusWithReview(focusNoteId)}
                      style={{ flex: 1, height: 44, borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", backgroundColor: "rgba(255,255,255,.10)", color: "rgba(247,248,251,.85)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                    >
                      Save progress
                    </button>
                    <button
                      onClick={() => setFocusExitConfirm(false)}
                      style={{ flex: 1, height: 44, borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", backgroundColor: "rgba(255,255,255,.10)", color: "rgba(247,248,251,.85)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                    >
                      Keep going
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setFocusOpen(false); setFocusExitConfirm(false); setFocusPaused(false);
                      setBreakSecondsLeft(0); setFocusSecondsLeft(0);
                      setFocusNoteId(null); setFocusStepId(null); setFocusChainMode(false);
                    }}
                    style={{ width: "100%", height: 44, borderRadius: 999, border: "1px solid rgba(220,60,60,.3)", backgroundColor: "rgba(220,60,60,.15)", color: "rgba(255,150,150,.85)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    Exit without saving
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {draftPromptOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            backgroundColor: boardTheme === "dark" ? "rgba(6,8,12,.7)" : "rgba(10,10,12,.36)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(360px, 100%)",
              backgroundColor: boardTheme === "dark" ? "#1f2329" : "#fbf8f1",
              color: pageText(boardTheme),
              borderRadius: 9,
              border: `1px solid ${border(boardTheme)}`,
              boxShadow: "0 30px 80px rgba(0,0,0,.28)",
              padding: 24,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>Save as draft?</div>
            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.65, color: muted(boardTheme) }}>
              You have unsaved content. Save it as a draft to pick up where you left off.
            </div>
            <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
              <button onClick={saveDraft} style={buttonStyle(boardTheme, true)}>Save draft</button>
              <button
                onClick={() => { setDraftPromptOpen(false); resetComposer(); setComposerOpen(false); }}
                style={buttonStyle(boardTheme)}
              >
                Discard
              </button>
              <button
                onClick={() => setDraftPromptOpen(false)}
                style={{ ...buttonStyle(boardTheme), color: muted(boardTheme) }}
              >
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Duration Picker (inside board-shell, only shown in fullscreen — main-level copy handles mobile + non-fullscreen desktop) ── */}
      {isFullscreen && focusPicker && (() => {
        const pickerNote = notes.find(n => n.id === focusPicker.noteId);
        if (!pickerNote) return null;
        const presets = [15, 30, 60, 120];
        const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 950, backgroundColor: "rgba(6,7,10,.92)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
        const card: CSSProperties = { width: "min(400px,100%)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "32px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 0, textAlign: "center" };
        const presetBtn = (active: boolean): CSSProperties => ({
          height: 56, flex: 1, borderRadius: 14,
          border: active ? "1.5px solid rgba(255,255,255,.7)" : "1px solid rgba(255,255,255,.12)",
          backgroundColor: active ? "rgba(255,255,255,.15)" : "rgba(255,255,255,.05)",
          color: active ? "#f7f8fb" : "rgba(247,248,251,.55)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          transition: "background-color .15s, border-color .15s",
        });
        const customVal = parseInt(focusCustomMin, 10);
        const customValid = !isNaN(customVal) && customVal >= 1 && customVal <= 480;
        const effectiveSelected = focusPickerSelected ?? (focusPickerShowCustom && customValid ? customVal : null);
        const canStart = effectiveSelected !== null;
        const formatPreset = (m: number) => m >= 60 ? `${m / 60}hr` : `${m}`;
        const formatPresetSub = (m: number) => m >= 60 ? "" : " min";
        return (
          <div style={overlay} onClick={() => { setFocusPicker(null); setFocusPickerSelected(null); setFocusCustomMin(""); setFocusPickerShowCustom(false); }}>
            <div style={card} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(247,248,251,.4)", fontWeight: 600, marginBottom: 14 }}>Focus Session</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f7f8fb", letterSpacing: "-.02em", lineHeight: 1.2, marginBottom: 6 }}>{pickerNote.title}</div>
              {(pickerNote.totalTimeSpent ?? 0) > 0 && (
                <div style={{ fontSize: 12, color: "rgba(247,248,251,.4)", marginBottom: 8 }}>
                  {(pickerNote.totalTimeSpent ?? 0) >= 60
                    ? `${Math.floor((pickerNote.totalTimeSpent ?? 0) / 60)}h ${(pickerNote.totalTimeSpent ?? 0) % 60}m already logged`
                    : `${pickerNote.totalTimeSpent}m already logged`}
                </div>
              )}
              <div style={{ fontSize: 13, color: "rgba(247,248,251,.35)", marginBottom: 28 }}>{focusPickerPrompts[focusPickerPromptIdx]}</div>
              {/* Preset row */}
              <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 12 }}>
                {presets.map(m => (
                  <button key={m} style={presetBtn(focusPickerSelected === m)} onClick={() => { setFocusPickerSelected(m); setFocusCustomMin(""); }}>
                    {formatPreset(m)}<span style={{ fontSize: 11, opacity: .6 }}>{formatPresetSub(m)}</span>
                  </button>
                ))}
                {/* Custom + button */}
                <button
                  style={{ ...presetBtn(focusPickerShowCustom && focusPickerSelected === null), flex: "0 0 auto", padding: "0 14px" }}
                  onClick={() => { setFocusPickerSelected(null); setFocusPickerShowCustom(true); setTimeout(() => (document.getElementById("focus-custom-input") as HTMLInputElement | null)?.focus(), 50); }}
                >
                  +
                </button>
              </div>
              {/* Custom input (shown only after + is clicked) */}
              {focusPickerShowCustom && (
                <div style={{ width: "100%", marginBottom: 12, display: "flex", gap: 8 }}>
                  <input
                    id="focus-custom-input"
                    type="number" min={1} max={480} placeholder="Custom min"
                    value={focusCustomMin}
                    onChange={e => setFocusCustomMin(e.target.value)}
                    style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${customValid ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.15)"}`, background: "rgba(255,255,255,.06)", color: "#f7f8fb", fontSize: 14, padding: "0 12px", outline: "none", fontFamily: "inherit" }}
                  />
                </div>
              )}
              {/* Start button */}
              <button
                disabled={!canStart}
                onClick={() => {
                  if (!canStart) return;
                  const mins = effectiveSelected!;
                  setFocusPickerSelected(null);
                  setFocusCustomMin("");
                  setFocusPickerShowCustom(false);
                  commitFocus(focusPicker.noteId, focusPicker.chain, mins);
                }}
                style={{ width: "100%", height: 50, borderRadius: 14, border: "none", backgroundColor: canStart ? "#f5f5f2" : "rgba(255,255,255,.08)", color: canStart ? "#111315" : "rgba(247,248,251,.25)", fontSize: 15, fontWeight: 700, cursor: canStart ? "pointer" : "default", fontFamily: "inherit", marginBottom: 16, transition: "background-color .15s, color .15s" }}
              >
                Start
              </button>
              <button onClick={() => { setFocusPicker(null); setFocusPickerSelected(null); setFocusCustomMin(""); setFocusPickerShowCustom(false); }} style={{ fontSize: 13, color: "rgba(247,248,251,.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* ── Session Review Modal (inside board-shell — position:fixed escapes to viewport; mobile never sets focusReview so no double-render risk) ── */}
      {focusReview && (() => {
        const reviewNote = notes.find(n => n.id === focusReview.noteId);
        const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 950, backgroundColor: "rgba(6,20,9,.96)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
        const card: CSSProperties = { width: "min(400px,100%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 0, textAlign: "center" };
        const streak = focusStatsData?.currentStreak ?? 0;
        const todayMin = (focusStatsData?.days.find(d => d.date === new Date().toISOString().slice(0,10))?.totalMinutes ?? 0) + focusReview.elapsedMin;
        return (
          <div style={overlay}>
            <div style={card}>
              {/* Checkmark */}
              <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(80,180,100,.15)", border: "1.5px solid rgba(100,210,120,.35)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 22 22" fill="none"><polyline points="5,12 9,16 17,7" stroke="#6fc46b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(247,248,251,.35)", fontWeight: 500, marginBottom: 10 }}>Session complete</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#f7f8fb", letterSpacing: "-.02em", lineHeight: 1.2, marginBottom: 6 }}>
                {focusReview.elapsedMin} min focused
              </div>
              {reviewNote && <div style={{ fontSize: 14, color: "rgba(247,248,251,.4)", marginBottom: 4 }}>{reviewNote.title}</div>}
              {/* Stats row */}
              <div style={{ display: "flex", gap: 24, marginTop: 20, marginBottom: 32 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#f7f8fb", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {streak > 0 && (() => {
                      const dur = Math.max(0.6, 2.4 - streak * 0.08);
                      return (
                        <svg width="16" height="22" viewBox="0 0 11 15" fill="none" overflow="visible" style={{ filter: `drop-shadow(0 0 3px #facc15aa)`, animation: `boltSpark ${dur}s ease-in-out infinite` }}>
                          <style>{`@keyframes boltSpark{0%,100%{opacity:.65;filter:drop-shadow(0 0 2px #facc1566)}40%{opacity:1;filter:drop-shadow(0 0 7px #facc15cc)}}`}</style>
                          <path d="M7 1L1 8.5h4L3.5 14 10 6H6L7 1Z" fill="#facc15"/>
                        </svg>
                      );
                    })()}
                    {streak > 0 ? streak : "–"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(247,248,251,.35)", marginTop: 4 }}>day streak</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#f7f8fb" }}>{todayMin} min</div>
                  <div style={{ fontSize: 11, color: "rgba(247,248,251,.35)", marginTop: 4 }}>today</div>
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <button
                  onClick={() => handleFocusReviewDone(true)}
                  style={{ height: 48, borderRadius: 14, border: "none", backgroundColor: "#6fc46b", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Mark task done ✓
                </button>
                <button
                  onClick={() => handleFocusReviewDone(false)}
                  style={{ height: 48, borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", backgroundColor: "rgba(255,255,255,.07)", color: "rgba(247,248,251,.8)", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Still in progress — save time
                </button>
                <button
                  onClick={() => { setFocusReview(null); setFocusNoteId(null); }}
                  style={{ fontSize: 12, color: "rgba(247,248,251,.25)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}
                >
                  Exit without saving
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Profile Panel (inside board-shell so it renders in fullscreen) ── */}
      {profileOpen && (() => {
        const stats = focusStatsData;
        const streak = stats?.currentStreak ?? 0;
        const totalMins = stats?.totalMinutes ?? 0;
        const totalHoursDisplay = totalMins < 60 ? `${totalMins}m` : `${Math.round(totalMins / 60 * 10) / 10}h`;
        const totalTasks = stats?.totalTasksCompleted ?? 0;
        const days = stats?.days ?? [];
        const maxMin = Math.max(...days.map(d => d.totalMinutes), 1);
        const today = localToday;
        const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 800, backgroundColor: theme === "dark" ? "rgba(6,8,12,.7)" : "rgba(10,10,12,.36)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
        const card: CSSProperties = { width: "min(380px,100%)", background: theme === "dark" ? "rgba(16,18,22,.98)" : "rgba(252,252,250,.99)", border: `1px solid ${border(theme)}`, borderRadius: 20, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 };
        const dayLabel = (date: string) => { const d = new Date(date + "T12:00:00"); return ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]; };
        return (
          <div style={overlay} onClick={() => setProfileOpen(false)}>
            <div style={card} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: pageText(theme), letterSpacing: "-.01em" }}>Focus Stats</div>
                <button onClick={() => setProfileOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: muted(theme), fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "Streak", value: streak > 0 ? `${streak}d` : "–", sub: "days in a row", icon: streak > 0 ? (() => { const dur = Math.max(0.6, 2.4 - streak * 0.08); return <svg width="11" height="15" viewBox="0 0 11 15" fill="none" overflow="visible" style={{ animation: `boltSpark ${dur}s ease-in-out infinite` }}><path d="M7 1L1 8.5h4L3.5 14 10 6H6L7 1Z" fill="#facc15"/></svg>; })() : null },
                  { label: "Total focused", value: totalHoursDisplay, sub: "all time" },
                  { label: "Tasks done", value: String(totalTasks), sub: "all time" },
                ].map(({ label: _l, value, sub, icon }) => (
                  <div key={sub} style={{ flex: 1, background: theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: pageText(theme), display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      {icon ?? null}{value}
                    </div>
                    <div style={{ fontSize: 10.5, color: muted(theme), marginTop: 3 }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 600, color: muted(theme), marginBottom: 12 }}>Last 7 days</div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
                  {days.map(d => {
                    const pct = d.totalMinutes / maxMin;
                    const isToday = d.date === today;
                    return (
                      <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                        <div style={{ fontSize: 9, color: muted(theme), opacity: .6 }}>{d.totalMinutes > 0 ? `${d.totalMinutes}m` : ""}</div>
                        <div style={{ width: "100%", borderRadius: 4, backgroundColor: d.totalMinutes > 0 ? (isToday ? "#6fc46b" : theme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)") : (theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"), height: `${Math.max(pct * 56, d.totalMinutes > 0 ? 8 : 4)}px`, transition: "height .3s" }} />
                        <div style={{ fontSize: 10, color: isToday ? pageText(theme) : muted(theme), fontWeight: isToday ? 700 : 400 }}>{dayLabel(d.date)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ fontSize: 13, color: muted(theme), textAlign: "center" }}>
                {days.reduce((s, d) => s + d.totalMinutes, 0)} min this week · {days.filter(d => d.totalMinutes > 0).length} active days
              </div>
            </div>
          </div>
        );
      })()}
      </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "60px 20px 80px" : "100px 24px 140px" }}>

        {/* Section label */}
        <div style={{ textAlign: "center", marginBottom: 96 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <BoardtivityLogo size={80} dark={theme === "dark"} />
          </div>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 16, opacity: .5 }}>Built for how you think</div>
          <h2 style={{ margin: 0, fontSize: "clamp(22px,2.8vw,38px)", fontWeight: 900, letterSpacing: "-.05em", color: pageText(theme), lineHeight: 1.06 }}>Your Board, the Way You Need It.</h2>
        </div>

        {/* ── Focus Mode — full-width immersive ── */}
        <div ref={whyRef} style={{ marginBottom: 100, opacity: whyVisible ? 1 : 0, transform: whyVisible ? "none" : "translateY(24px)", transition: "opacity .7s ease, transform .7s ease" }}>
          <div style={{ maxWidth: 860, margin: "0 auto", borderRadius: 24, overflow: "hidden", backgroundColor: theme === "dark" ? "#0a0b0e" : "#0d0f12", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent)", pointerEvents: "none" }}/>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", minHeight: isMobile ? "auto" : 380 }}>
              {/* Left: actual focus mode UI replica */}
              <div style={{ padding: isMobile ? "52px 24px 36px" : "56px 48px 48px", borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,.05)", borderBottom: isMobile ? "1px solid rgba(255,255,255,.05)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  <div style={{ fontSize: 13, letterSpacing: ".16em", color: "rgba(247,248,251,.45)", fontWeight: 600 }}>2 / 3</div>
                  <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: "rgba(247,248,251,.72)", letterSpacing: "-.01em", lineHeight: 1.4 }}>
                    Study for Chemistry exam
                  </div>
                  <div style={{ marginTop: 20, fontSize: 72, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1, color: "#f7f8fb" }}>
                    18:45
                  </div>
                  {/* Progress — current step */}
                  <div style={{ marginTop: 28, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(247,248,251,.8)" }}>Practice problems</span>
                      <span style={{ fontSize: 14, color: "rgba(247,248,251,.4)" }}>2 / 3</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,.1)", overflow: "hidden", marginBottom: 18 }}>
                      <div style={{ height: "100%", width: "68%", borderRadius: 999, backgroundColor: "rgba(247,248,251,.88)" }}/>
                    </div>
                    {/* Overall segments */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(247,248,251,.35)" }}>Overall progress</span>
                      <span style={{ fontSize: 14, color: "rgba(247,248,251,.35)" }}>23%</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ fill: 100, green: true }, { fill: 0, green: false }, { fill: 0, green: false }].map((s, i) => (
                        <div key={i} style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,.1)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${s.fill}%`, borderRadius: 999, backgroundColor: s.green ? "#6fc46b" : "rgba(247,248,251,.88)" }}/>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Right: copy */}
              <div style={{ padding: isMobile ? "32px 24px 40px" : "56px 48px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h3 style={{ margin: "0 0 18px", fontSize: "clamp(22px,2.2vw,32px)", fontWeight: 800, letterSpacing: "-.04em", color: "#f7f8fb", lineHeight: 1.08 }}>Lock in.<br/>Step by step.</h3>
                <p style={{ margin: "0 0 36px", fontSize: 15, color: "rgba(255,255,255,.42)", lineHeight: 1.9 }}>
                  Enter a timed focus session for any task or subtask. Boardtivity chains through your steps automatically — so you stay on track without thinking about it.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {["Timed sessions per subtask", "Auto-chain through task steps", "Visual progress across all steps"].map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "rgba(255,255,255,.55)" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "rgba(255,255,255,.22)", flexShrink: 0 }}/>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Features — 3-col editorial ── */}
        <div ref={featuresRef}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 28 : 0, marginBottom: 88, opacity: featuresVisible ? 1 : 0, transform: featuresVisible ? "none" : "translateY(20px)", transition: "opacity .6s ease, transform .6s ease" }}>
            {([
              {
                label: "Visual Boards",
                heading: "Everything on\nyour board.",
                body: "Drag tasks anywhere on your board. Arrange by project, urgency, or however your mind works — no rigid columns.",
              },
              {
                label: "Taskweb & Taskchain",
                heading: "Break any task\ninto steps.",
                body: "Expand tasks into a subtask web you can see at once, or a sequential chain you step through one at a time.",
              },
              {
                label: "Idea Notes",
                heading: "Capture ideas\nnext to the work.",
                body: "Drop color-coded idea notes anywhere on your board. Link them to tasks so ideas and action stay together.",
              },
            ] as const).map((f, i) => (
              <div key={i} style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 28, paddingRight: isMobile ? 0 : (i < 2 ? 48 : 0), paddingBottom: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 20, opacity: .5 }}>{f.label}</div>
                <h3 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), lineHeight: 1.22 }}>{f.heading.split("\n").map((line, j) => <span key={j}>{line}{j === 0 ? <br/> : null}</span>)}</h3>
                <p style={{ margin: 0, fontSize: 14, color: muted(theme), lineHeight: 1.85, opacity: .68 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pricing ── */}
        <div ref={pricingRef} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, maxWidth: 720, margin: "0 auto" }}>
          {/* Free */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: "36px 28px", display: "flex", flexDirection: "column", opacity: pricingVisible ? 1 : 0, transform: pricingVisible ? "none" : "translateY(28px)", transition: "opacity .65s ease 0s, transform .65s ease 0s" }}>
            <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 16 }}>Free</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em", color: pageText(theme), marginBottom: 14 }}>Free forever</div>
            <div style={{ fontSize: 13, color: muted(theme), marginBottom: 18, lineHeight: 1.75, flexGrow: 1 }}>Full access to every feature — boards, tasks, subtasks, focus sessions, and idea notes. No credit card needed.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["1 board per type", "1 idea per board", "Focus mode & subtasks", "Taskweb & Taskchain"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: pageText(theme) }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: hexToRgba("#6fc46b", .15), border: "1px solid rgba(111,196,107,.35)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="#6fc46b" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => !isSignedIn && openSignUp()} style={{ ...buttonStyle(theme, false), width: "100%", fontSize: 14, height: 42, cursor: isSignedIn ? "default" : "pointer", opacity: isSignedIn ? .5 : 1 }}>{isSignedIn ? "Signed in" : "Get started free"}</button>
          </div>
          {/* Plus */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${theme === "dark" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"}`, backgroundColor: theme === "dark" ? "#0d0f12" : "#111315", padding: "36px 28px", display: "flex", flexDirection: "column", opacity: pricingVisible ? 1 : 0, transform: pricingVisible ? "none" : "translateY(28px)", transition: "opacity .65s ease .1s, transform .65s ease .1s" }}>
            <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent)", pointerEvents: "none" }}/>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,.45)" }}>Plus</div>
              <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,.38)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "3px 8px" }}>Most popular</div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em", color: "#f7f8fb", marginBottom: 14 }}>$6 / mo</div>
            <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,.42)", marginBottom: 18, flexGrow: 1 }}>More boards, custom idea colors, and everything we build next.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["Up to 10 task boards", "Up to 5 idea boards", "Custom idea note colors", "Early access to new features"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,.72)" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="rgba(255,255,255,.7)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => isPlus ? null : startCheckout("monthly")} disabled={checkoutLoading} style={{ width: "100%", height: 42, borderRadius: 999, border: isPlus ? "1px solid rgba(255,255,255,.18)" : "none", backgroundColor: isPlus ? "transparent" : "#f7f8fb", color: isPlus ? "rgba(255,255,255,.55)" : "#111315", fontSize: 14, fontWeight: 700, cursor: isPlus ? "default" : "pointer", opacity: checkoutLoading ? 0.6 : 1 }}>{isPlus ? "✓ Current plan" : checkoutLoading ? "Loading…" : "Get Plus — $6/mo"}</button>
          </div>
        </div>
      </section>

      {/* ── Feedback Board ── */}
      <section ref={feedbackRef} id="feedback" style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "60px 20px 80px" : "100px 32px 120px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10, opacity: .5 }}>Community</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,3vw,38px)", fontWeight: 900, letterSpacing: "-.04em", color: pageText(theme), lineHeight: 1.1 }}>Feature Requests & Feedback</h2>
          <p style={{ margin: 0, fontSize: 15, color: muted(theme), opacity: .6, lineHeight: 1.7 }}>Drop ideas, vote on what matters. The most wanted features get built first.</p>
        </div>

        {/* Post form */}
        {isSignedIn ? (
          <div style={{ marginBottom: 28, backgroundColor: theme === "dark" ? "#17191d" : "#ffffff", border: `1px solid ${border(theme)}`, borderRadius: 14, padding: "18px 20px" }}>
            <textarea
              placeholder="Share feedback, request a feature, or report a bug…"
              value={feedbackContent}
              onChange={e => { setFeedbackContent(e.target.value); setFeedbackError(null); }}
              maxLength={500}
              rows={3}
              style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontSize: 14, color: pageText(theme), fontFamily: "inherit", lineHeight: 1.65, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 12, borderTop: `1px solid ${border(theme)}`, paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: feedbackError ? "#c03030" : muted(theme), opacity: feedbackError ? 1 : .4 }}>
                {feedbackError ?? `${feedbackContent.length}/500`}
              </div>
              <button
                disabled={feedbackPosting || !feedbackContent.trim()}
                onClick={async () => {
                  setFeedbackPosting(true);
                  setFeedbackError(null);
                  try {
                    await postFeedback({ content: feedbackContent });
                    setFeedbackContent("");
                  } catch (e: any) {
                    const msg = e?.message ?? "";
                    const rlMatch = msg.match(/rate_limit:(\d+)/);
                    if (rlMatch) {
                      setFeedbackError(`You already posted today. Try again in ${rlMatch[1]}h.`);
                    } else {
                      setFeedbackError("Something went wrong, try again.");
                    }
                  }
                  setFeedbackPosting(false);
                }}
                style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", backgroundColor: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 13, fontWeight: 700, cursor: feedbackPosting || !feedbackContent.trim() ? "not-allowed" : "pointer", opacity: feedbackPosting || !feedbackContent.trim() ? .4 : 1, fontFamily: "inherit" }}
              >
                {feedbackPosting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 28, backgroundColor: theme === "dark" ? "#17191d" : "#ffffff", border: `1px solid ${border(theme)}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 14, color: muted(theme), opacity: .65 }}>Sign in to post or vote.</span>
            <button onClick={() => openSignIn()} style={{ ...buttonStyle(theme, true), fontSize: 13, height: 34 }}>Sign in</button>
          </div>
        )}

        {/* Posts list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {feedbackPosts === undefined ? (
            <div style={{ textAlign: "center", padding: "60px 0", fontSize: 14, color: muted(theme), opacity: .4 }}>Loading…</div>
          ) : feedbackPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", fontSize: 14, color: muted(theme), opacity: .4 }}>No posts yet — be the first!</div>
          ) : feedbackPosts.map((p) => {
            const score = p.upvotes - p.downvotes;
            const isReplying = replyingTo === p._id;
            return (
              <div key={p._id} style={{ borderRadius: 12, overflow: "hidden" }}>
                {/* Post row */}
                <div style={{ display: "flex", gap: 0, backgroundColor: theme === "dark" ? "#17191d" : "#ffffff", border: `1px solid ${border(theme)}`, borderRadius: isReplying || (p.replies && p.replies.length > 0) ? "12px 12px 0 0" : 12, padding: "14px 16px", alignItems: "flex-start" }}>
                  {/* Vote column */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0, marginRight: 12, paddingTop: 1 }}>
                    <button
                      onClick={async () => { if (isSignedIn) await voteFeedback({ postId: p._id, direction: "up" }); else openSignIn(); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "none", backgroundColor: p.userVote === "up" ? (theme === "dark" ? "rgba(111,196,107,.18)" : "rgba(60,180,90,.12)") : "transparent", cursor: "pointer", transition: "all .1s" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.5L10.5 8H1.5L6 1.5Z" fill={p.userVote === "up" ? "#6fc46b" : muted(theme)} opacity={p.userVote === "up" ? 1 : 0.45}/></svg>
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: score > 0 ? "#6fc46b" : score < 0 ? "#c03030" : muted(theme), lineHeight: 1, minWidth: 16, textAlign: "center" }}>{score}</span>
                    <button
                      onClick={async () => { if (isSignedIn) await voteFeedback({ postId: p._id, direction: "down" }); else openSignIn(); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "none", backgroundColor: p.userVote === "down" ? (theme === "dark" ? "rgba(200,60,60,.18)" : "rgba(180,40,40,.1)") : "transparent", cursor: "pointer", transition: "all .1s" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10.5L1.5 4H10.5L6 10.5Z" fill={p.userVote === "down" ? "#c03030" : muted(theme)} opacity={p.userVote === "down" ? 1 : 0.45}/></svg>
                    </button>
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: muted(theme), opacity: .5, marginBottom: 6 }}>
                      {p.authorName} · {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: 15, color: pageText(theme), lineHeight: 1.7, marginBottom: 10, wordBreak: "break-word" }}>{p.content}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button
                        onClick={() => { setReplyingTo(isReplying ? null : p._id); setReplyContent(""); setReplyError(null); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: muted(theme), opacity: .55, padding: 0, fontFamily: "inherit" }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={e => (e.currentTarget.style.opacity = "0.55")}
                      >
                        {isReplying ? "Cancel" : `Reply${p.replies && p.replies.length > 0 ? ` (${p.replies.length})` : ""}`}
                      </button>
                      {p.isOwner && (
                        <button
                          onClick={async () => { await deleteFeedback({ postId: p._id }); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#c03030", opacity: .5, padding: 0, fontFamily: "inherit" }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {(p.replies && p.replies.length > 0) && (
                  <div style={{ backgroundColor: theme === "dark" ? "#13151a" : "#f8f8f9", border: `1px solid ${border(theme)}`, borderTop: "none", borderRadius: isReplying ? "0" : "0 0 12px 12px" }}>
                    {p.replies.map((r, i) => (
                      <div key={r._id} style={{ display: "flex", gap: 10, padding: "12px 16px 12px 52px", borderTop: i > 0 ? `1px solid ${border(theme)}` : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: muted(theme), opacity: .45, marginBottom: 4 }}>
                            {r.authorName} · {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                          <div style={{ fontSize: 14, color: pageText(theme), lineHeight: 1.65, wordBreak: "break-word", opacity: .85 }}>{r.content}</div>
                        </div>
                        {r.isOwner && (
                          <button
                            onClick={async () => { await deleteReplyFeedback({ replyId: r._id }); }}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#c03030", opacity: .4, padding: 0, fontFamily: "inherit", flexShrink: 0, alignSelf: "flex-start", marginTop: 2 }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply form */}
                {isReplying && (
                  <div style={{ backgroundColor: theme === "dark" ? "#13151a" : "#f8f8f9", border: `1px solid ${border(theme)}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "12px 16px 12px 52px" }}>
                    <textarea
                      autoFocus
                      placeholder="Write a reply…"
                      value={replyContent}
                      onChange={e => { setReplyContent(e.target.value); setReplyError(null); }}
                      maxLength={300}
                      rows={2}
                      style={{ width: "100%", background: theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${border(theme)}`, borderRadius: 8, outline: "none", resize: "none", fontSize: 13, color: pageText(theme), fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box", padding: "8px 12px" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 8 }}>
                      <div style={{ fontSize: 11, color: replyError ? "#c03030" : muted(theme), opacity: replyError ? 1 : .4 }}>
                        {replyError ?? `${replyContent.length}/300`}
                      </div>
                      <button
                        disabled={replyPosting || !replyContent.trim()}
                        onClick={async () => {
                          setReplyPosting(true);
                          setReplyError(null);
                          try {
                            await replyFeedback({ postId: p._id, content: replyContent });
                            setReplyContent("");
                            setReplyingTo(null);
                          } catch (e: any) {
                            const msg = e?.message ?? "";
                            if (msg.includes("reply_rate_limit")) {
                              setReplyError("You've replied 5 times today. Try again tomorrow.");
                            } else {
                              setReplyError("Something went wrong, try again.");
                            }
                          }
                          setReplyPosting(false);
                        }}
                        style={{ height: 30, padding: "0 14px", borderRadius: 7, border: "none", backgroundColor: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 12, fontWeight: 700, cursor: replyPosting || !replyContent.trim() ? "not-allowed" : "pointer", opacity: replyPosting || !replyContent.trim() ? .4 : 1, fontFamily: "inherit" }}
                      >
                        {replyPosting ? "…" : "Reply"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Upgrade modal ── */}
      {upgradeOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: theme === "dark" ? "rgba(6,8,12,.7)" : "rgba(10,10,12,.32)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setUpgradeOpen(false); }}
        >
          <div style={{ width: "min(400px,100%)", backgroundColor: theme === "dark" ? "#1a1d22" : "#fbf8f1", borderRadius: 20, boxShadow: "0 30px 80px rgba(0,0,0,.28)", border: `1px solid ${border(theme)}`, padding: "28px 26px 22px", fontFamily: "inherit" }}>
            {/* Label */}
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 14 }}>Boardtivity Plus</div>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), marginBottom: 8, lineHeight: 1.2 }}>
              Unlock more with Plus
            </div>
            <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.65, marginBottom: 22 }}>
              More boards, custom idea colors, and everything we build next.
            </div>
            {/* Feature list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
              {[
                "Up to 10 task boards",
                "Up to 5 idea boards",
                "Custom idea note colors",
                "Early access to new features",
              ].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: pageText(theme) }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="2,7 5.5,10.5 12,3.5" stroke="#6fc46b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {f}
                </div>
              ))}
            </div>
            {/* Divider */}
            <div style={{ height: 1, backgroundColor: border(theme), marginBottom: 18 }} />
            {/* CTA */}
            {checkoutError && <div style={{ fontSize: 12, color: "#c03030", marginBottom: 10, textAlign: "center" }}>{checkoutError}</div>}
            <button
              onClick={() => { setUpgradeOpen(false); startCheckout("annual"); }}
              disabled={checkoutLoading}
              style={{ width: "100%", padding: "13px 0", borderRadius: 11, border: "none", backgroundColor: pageText(theme), color: pageBg(theme), fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.02em", marginBottom: 8, opacity: checkoutLoading ? 0.6 : 1, position: "relative" }}
            >
              {checkoutLoading ? "Loading…" : "Get Plus — $60/yr →"}
              <span style={{ position: "absolute", top: -9, right: 12, fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", backgroundColor: "#6fc46b", color: "#fff", borderRadius: 99, padding: "2px 7px" }}>Save 17%</span>
            </button>
            <button
              onClick={() => { setUpgradeOpen(false); startCheckout("monthly"); }}
              disabled={checkoutLoading}
              style={{ width: "100%", padding: "12px 0", borderRadius: 11, border: `1px solid ${border(theme)}`, background: "none", color: pageText(theme), fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.02em", marginBottom: 8, opacity: checkoutLoading ? 0.6 : 1 }}
            >
              {checkoutLoading ? "Loading…" : "Get Plus — $6/mo"}
            </button>
            <button
              onClick={() => setUpgradeOpen(false)}
              style={{ width: "100%", padding: "10px 0", borderRadius: 11, border: "none", background: "none", color: muted(theme), fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Maybe later
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: muted(theme) }}>
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: muted(theme), textDecoration: "none" }}>Terms</a>
              <span style={{ margin: "0 6px" }}>·</span>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: muted(theme), textDecoration: "none" }}>Privacy</a>
            </div>
          </div>
        </div>
      )}

      {/* ── Limit reached modal (Plus users at max) ── */}
      {limitReachedOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: theme === "dark" ? "rgba(6,8,12,.7)" : "rgba(10,10,12,.32)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setLimitReachedOpen(false); }}
        >
          <div style={{ width: "min(360px,100%)", backgroundColor: theme === "dark" ? "#1a1d22" : "#fbf8f1", borderRadius: 20, boxShadow: "0 30px 80px rgba(0,0,0,.28)", border: `1px solid ${border(theme)}`, padding: "28px 26px 22px", fontFamily: "inherit", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={pageText(theme)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), marginBottom: 8 }}>You've hit the limit</div>
            <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.65, marginBottom: 22 }}>
              Plus accounts support up to 10 task boards and 5 idea boards. You've reached the maximum.
            </div>
            <button
              onClick={() => setLimitReachedOpen(false)}
              style={{ width: "100%", padding: "12px 0", borderRadius: 11, border: "none", backgroundColor: pageText(theme), color: pageBg(theme), fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Post-purchase thank you modal ── */}
      {showSubscribedModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: theme === "dark" ? "rgba(6,8,12,.8)" : "rgba(10,10,12,.4)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSubscribedModal(false); }}
        >
          <div style={{ width: "min(400px,100%)", backgroundColor: theme === "dark" ? "#1a1d22" : "#fbf8f1", borderRadius: 22, boxShadow: "0 40px 100px rgba(0,0,0,.32)", border: `1px solid ${border(theme)}`, padding: "36px 30px 26px", fontFamily: "inherit", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.65)" : "rgba(0,0,0,.5)", background: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "6px 16px" }}>
                Plus
              </span>
            </div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 10 }}>Now on your account</div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-.04em", color: pageText(theme), marginBottom: 10 }}>You're all set</div>
            <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.7, marginBottom: 28 }}>
              Your subscription is active. You now have access to up to 10 task boards, 5 idea boards, custom idea colors, and more features to come. Thank you for your support!
            </div>
            <button
              onClick={() => setShowSubscribedModal(false)}
              style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.02em" }}
            >
              Jump back in →
            </button>
          </div>
        </div>
      )}

      {/* ── Sync overhaul update notice ── */}
      {showUpdateModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: theme === "dark" ? "rgba(6,8,12,.8)" : "rgba(10,10,12,.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowUpdateModal(false); try { localStorage.setItem("boardtivity_update_sync_v1_seen", "1"); } catch {} } }}
        >
          <div style={{ width: "min(420px,100%)", backgroundColor: theme === "dark" ? "#1a1d22" : "#fbf8f1", borderRadius: 22, boxShadow: "0 40px 100px rgba(0,0,0,.35)", border: `1px solid ${border(theme)}`, padding: "36px 30px 28px", fontFamily: "inherit", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.65)" : "rgba(0,0,0,.5)", background: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "6px 16px" }}>
                What&apos;s new
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-.04em", color: pageText(theme), marginBottom: 8, lineHeight: 1.2 }}>
              Boardtivity just got a major upgrade ✦
            </div>
            <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.75, marginBottom: 24, textAlign: "left" }}>
              <div style={{ marginBottom: 10 }}>We&apos;ve been heads down building — here&apos;s what&apos;s new:</div>
              {[
                ["Real-time sync", "your board now stays in perfect sync across all your devices, instantly"],
                ["One step closer to BOB", "our AI agent is coming, and it\u2019s going to change how you work"],
                ["Subtasks revamped", "cleaner flow for building out your tasks step by step"],
                ["Stability improvements", "a ton of under-the-hood fixes for a smoother experience"],
              ].map(([title, desc]) => (
                <div key={title} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                  <span style={{ marginTop: 2, flexShrink: 0, width: 6, height: 6, borderRadius: "50%", background: theme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)", display: "inline-block" }} />
                  <span><strong style={{ color: pageText(theme) }}>{title}</strong> — {desc}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: muted(theme), lineHeight: 1.6, marginBottom: 22, padding: "12px 14px", borderRadius: 10, background: theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${border(theme)}`, textAlign: "left" }}>
              Unfortunately, this update may have caused some tasks or ideas to not carry over. We&apos;re sorry for the disruption — everything will sync perfectly from here.
            </div>
            <button
              onClick={() => { setShowUpdateModal(false); try { localStorage.setItem("boardtivity_update_sync_v1_seen", "1"); } catch {} }}
              style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.02em" }}
            >
              Let&apos;s go →
            </button>
            <div style={{ marginTop: 12, fontSize: 12, color: muted(theme) }}>— The Boardtivity Team</div>
          </div>
        </div>
      )}

      {/* ── Name prompt modal ── */}
      {namePromptOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: theme === "dark" ? "rgba(6,8,12,.7)" : "rgba(10,10,12,.32)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div style={{ width: "min(380px,100%)", backgroundColor: theme === "dark" ? "#1a1d22" : "#fbf8f1", borderRadius: 20, boxShadow: "0 30px 80px rgba(0,0,0,.28)", border: `1px solid ${border(theme)}`, padding: "28px 26px 22px", fontFamily: "inherit" }}>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 12 }}>Quick setup</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), marginBottom: 8 }}>What's your name?</div>
            <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.6, marginBottom: 22 }}>Add your name so we can personalize your experience.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {[
                { placeholder: "First name", value: namePromptFirst, setter: setNamePromptFirst },
                { placeholder: "Last name (optional)", value: namePromptLast, setter: setNamePromptLast },
              ].map(({ placeholder, value, setter }) => (
                <input
                  key={placeholder}
                  type="text"
                  placeholder={placeholder}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  style={{ width: "100%", height: 42, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "rgba(255,255,255,.05)" : "#fff", color: pageText(theme), fontSize: 14, padding: "0 14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                />
              ))}
            </div>
            <button
              disabled={!namePromptFirst.trim() || namePromptSaving}
              onClick={async () => {
                if (!namePromptFirst.trim() || !user) return;
                setNamePromptSaving(true);
                try {
                  await user.update({ firstName: namePromptFirst.trim(), lastName: namePromptLast.trim() || undefined });
                  setNamePromptOpen(false);
                  localStorage.setItem("boardtivity_name_prompt_dismissed", "1");
                } catch {}
                setNamePromptSaving(false);
              }}
              style={{ width: "100%", padding: "13px 0", borderRadius: 11, border: "none", backgroundColor: pageText(theme), color: pageBg(theme), fontSize: 14, fontWeight: 800, cursor: namePromptFirst.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", marginBottom: 8, opacity: !namePromptFirst.trim() || namePromptSaving ? 0.5 : 1 }}
            >
              {namePromptSaving ? "Saving…" : "Save name"}
            </button>
            <button
              onClick={() => { setNamePromptOpen(false); try { localStorage.setItem("boardtivity_name_prompt_dismissed", "1"); } catch {} }}
              style={{ width: "100%", padding: "10px 0", borderRadius: 11, border: "none", background: "none", color: muted(theme), fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}


      {/* ── Duration Picker (main level — mobile + non-fullscreen desktop) ── */}
      {!isFullscreen && focusPicker && (() => {
        const pickerNote = notes.find(n => n.id === focusPicker.noteId);
        if (!pickerNote) return null;
        const presets = [15, 30, 60, 120];
        const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 950, backgroundColor: "rgba(6,7,10,.92)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
        const card: CSSProperties = { width: "min(400px,100%)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "32px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 0, textAlign: "center" };
        const presetBtn = (active: boolean): CSSProperties => ({
          height: 56, flex: 1, borderRadius: 14,
          border: active ? "1.5px solid rgba(255,255,255,.7)" : "1px solid rgba(255,255,255,.12)",
          backgroundColor: active ? "rgba(255,255,255,.15)" : "rgba(255,255,255,.05)",
          color: active ? "#f7f8fb" : "rgba(247,248,251,.55)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          transition: "background-color .15s, border-color .15s",
        });
        const customVal = parseInt(focusCustomMin, 10);
        const customValid = !isNaN(customVal) && customVal >= 1 && customVal <= 480;
        const effectiveSelected = focusPickerSelected ?? (focusPickerShowCustom && customValid ? customVal : null);
        const canStart = effectiveSelected !== null;
        const formatPreset = (m: number) => m >= 60 ? `${m / 60}hr` : `${m}`;
        const formatPresetSub = (m: number) => m >= 60 ? "" : " min";
        return (
          <div style={overlay} onClick={() => { setFocusPicker(null); setFocusPickerSelected(null); setFocusCustomMin(""); setFocusPickerShowCustom(false); }}>
            <div style={card} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(247,248,251,.4)", fontWeight: 600, marginBottom: 14 }}>Focus Session</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f7f8fb", letterSpacing: "-.02em", lineHeight: 1.2, marginBottom: 6 }}>{pickerNote.title}</div>
              {(pickerNote.totalTimeSpent ?? 0) > 0 && (
                <div style={{ fontSize: 12, color: "rgba(247,248,251,.4)", marginBottom: 8 }}>
                  {(pickerNote.totalTimeSpent ?? 0) >= 60
                    ? `${Math.floor((pickerNote.totalTimeSpent ?? 0) / 60)}h ${(pickerNote.totalTimeSpent ?? 0) % 60}m already logged`
                    : `${pickerNote.totalTimeSpent}m already logged`}
                </div>
              )}
              <div style={{ fontSize: 13, color: "rgba(247,248,251,.35)", marginBottom: 28 }}>{focusPickerPrompts[focusPickerPromptIdx]}</div>
              <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 12 }}>
                {presets.map(m => (
                  <button key={m} style={presetBtn(focusPickerSelected === m)} onClick={() => { setFocusPickerSelected(m); setFocusCustomMin(""); }}>
                    {formatPreset(m)}<span style={{ fontSize: 11, opacity: .6 }}>{formatPresetSub(m)}</span>
                  </button>
                ))}
                <button
                  style={{ ...presetBtn(focusPickerShowCustom && focusPickerSelected === null), flex: "0 0 auto", padding: "0 14px" }}
                  onClick={() => { setFocusPickerSelected(null); setFocusPickerShowCustom(true); setTimeout(() => (document.getElementById("focus-custom-input") as HTMLInputElement | null)?.focus(), 50); }}
                >
                  +
                </button>
              </div>
              {focusPickerShowCustom && (
                <div style={{ width: "100%", marginBottom: 12, display: "flex", gap: 8 }}>
                  <input
                    id="focus-custom-input"
                    type="number" min={1} max={480} placeholder="Custom min"
                    value={focusCustomMin}
                    onChange={e => setFocusCustomMin(e.target.value)}
                    style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${customValid ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.15)"}`, background: "rgba(255,255,255,.06)", color: "#f7f8fb", fontSize: 14, padding: "0 12px", outline: "none", fontFamily: "inherit" }}
                  />
                </div>
              )}
              <button
                disabled={!canStart}
                onClick={() => {
                  if (!canStart) return;
                  const mins = effectiveSelected!;
                  setFocusPickerSelected(null);
                  setFocusCustomMin("");
                  setFocusPickerShowCustom(false);
                  commitFocus(focusPicker.noteId, focusPicker.chain, mins);
                }}
                style={{ width: "100%", height: 50, borderRadius: 14, border: "none", backgroundColor: canStart ? "#f5f5f2" : "rgba(255,255,255,.08)", color: canStart ? "#111315" : "rgba(247,248,251,.25)", fontSize: 15, fontWeight: 700, cursor: canStart ? "pointer" : "default", fontFamily: "inherit", marginBottom: 16, transition: "background-color .15s, color .15s" }}
              >
                Start
              </button>
              <button onClick={() => { setFocusPicker(null); setFocusPickerSelected(null); setFocusCustomMin(""); setFocusPickerShowCustom(false); }} style={{ fontSize: 13, color: "rgba(247,248,251,.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px 16px", borderTop: `1px solid ${border(theme)}`, marginTop: 40 }}>
        <div style={{ fontSize: 12, color: muted(theme), display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" as const }}>
          <span>© {new Date().getFullYear()} Boardtivity</span>
          <a href="/privacy" style={{ color: muted(theme), textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a>
          <a href="/terms" style={{ color: muted(theme), textDecoration: "none", fontWeight: 600 }}>Terms of Service</a>
          <a href="mailto:contact@boardtivity.com" style={{ color: muted(theme), textDecoration: "none", fontWeight: 600 }}>Contact</a>
        </div>
      </footer>

    </main>
  );
}
