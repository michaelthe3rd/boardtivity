
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { ThemeMode, BoardType, Importance, FlowMode, Board, Step, Note, Draft } from "@/lib/board";
import { useMutation, useQuery } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

const NOTE_PALETTE = [
  { light: "#e8f1fb", dark: "#1b2d3e", halo: "rgba(90,150,230,.20)",  swatch: "#4a8fe0" },  // sky blue
  { light: "#fbeee8", dark: "#3a2318", halo: "rgba(220,130,80,.20)",   swatch: "#e07a38" },  // peach
  { light: "#eef7ee", dark: "#1c301c", halo: "rgba(80,180,80,.20)",    swatch: "#3db83d" },  // sage
  { light: "#f6eeff", dark: "#291a3c", halo: "rgba(140,80,230,.20)",   swatch: "#8a40e8" },  // lavender
  { light: "#fff8e6", dark: "#352c12", halo: "rgba(210,175,60,.20)",   swatch: "#c8980a" },  // butter
  { light: "#eef8f8", dark: "#192e2e", halo: "rgba(70,190,190,.20)",   swatch: "#1ab8b8" },  // teal
  { light: "#ffedf0", dark: "#36191c", halo: "rgba(220,90,105,.20)",   swatch: "#e0445a" },  // rose
  { light: "#f1f1fb", dark: "#1e1e30", halo: "rgba(120,120,220,.20)",  swatch: "#6060d8" },  // periwinkle
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

function ideaNoteWidth(title: string): number {
  const len = title.length;
  if (len <= 32) return 228;
  if (len <= 60) return 280;
  if (len <= 100) return 330;
  return 370;
}
const STEP_W = 166;
const STEP_H = 62;

const INITIAL_BOARDS: Board[] = [
  { id: "my-board", name: "My Board", type: "task" },
  { id: "my-thoughts", name: "My Ideas", type: "thought" },
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
    id: Date.now() + i,
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
  return theme === "dark" ? "rgba(255,255,255,.055)" : "rgba(78,78,78,.10)";
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

function BoardtivityLogo({ size = 32, dark = false }: { size?: number; dark?: boolean }) {
  const color = dark ? "#f5f5f2" : "#171613";
  return (
    <svg width={size} height={size} viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <rect x="15" y="15" width="190" height="150" rx="28" ry="28" stroke={color} strokeWidth="9"/>
      <path d="M38 38 H58 M38 38 V58" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M182 38 H162 M182 38 V58" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M38 142 H58 M38 142 V122" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M182 142 H162 M182 142 V122" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <text x="110" y="118" fontFamily="Satoshi, Arial, sans-serif" fontWeight="900" fontSize="85" textAnchor="middle" fill={color}>B</text>
    </svg>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
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
        ...circleButton(theme, 36),
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
  const [detailNoteId, setDetailNoteId] = useState<number | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailEditTitle, setDetailEditTitle] = useState("");
  const [detailEditBody, setDetailEditBody] = useState("");
  const [activeStep, setActiveStep] = useState<{ noteId: number; stepId: number } | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [renameBoardId, setRenameBoardId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
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
  const focusNoteIdRef = useRef<number | null>(null);
  const focusStepIdRef = useRef<number | null>(null);
  const notesRef = useRef<typeof notes>([]);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [composerColorIdx, setComposerColorIdx] = useState(0);
  const [thoughtUnlinkTarget, setThoughtUnlinkTarget] = useState<number | null>(null);
  const thoughtUnlinkTargetRef = useRef<number | null>(null);
  const thoughtHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const boardMenuRef = useRef<HTMLDivElement | null>(null);
  const boardButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
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
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);

  const joinWaitlist = useMutation(api.waitlist.join);
  const feedbackPosts = useQuery(api.feedback.list);
  const postFeedback = useMutation(api.feedback.post);
  const voteFeedback = useMutation(api.feedback.vote);
  const deleteFeedback = useMutation(api.feedback.remove);
  const replyFeedback = useMutation(api.feedback.reply);
  const deleteReplyFeedback = useMutation(api.feedback.removeReply);
  const { user, isSignedIn } = useUser();
  const { openSignIn, openSignUp, signOut } = useClerk();

  async function submitWaitlist(email: string) {
    if (!email.includes("@")) return;
    const boardState = JSON.stringify({ boards, notes, activeBoardId });
    await joinWaitlist({ email, boardState });
    setWaitlistDone(true);
  }

  // TODO: enable after running `npx convex dev` to push boards schema
  // const saveBoard = useMutation(api.boards.save);
  // const savedBoard = useQuery(api.boards.load);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false); // noteId (number) or boardId (string)
  const [boardGrid, setBoardGrid] = useState<"grid" | "dots" | "blank">(() => readLocal("boardGrid", "grid"));
  const [thoughtColorMode, setThoughtColorMode] = useState<"random" | "fixed">(() => readLocal("thoughtColorMode", "random"));
  const [thoughtFixedColorIdx, setThoughtFixedColorIdx] = useState<number>(() => readLocal("thoughtFixedColorIdx", 0));
  const settingsRef = useRef<HTMLDivElement | null>(null);

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

  const getBg = (importance: Importance | undefined) => {
    if (!importance || importance === "none") return boardTheme === "dark" ? "#2a2d32" : "#ebebeb";
    const c = PRIORITY_COLORS[importance as "High"|"Medium"|"Low"];
    return blendHex(c, boardTheme === "dark" ? "#17191d" : "#ffffff", boardTheme === "dark" ? 0.28 : 0.32);
  };
  const getHalo = (importance: Importance | undefined) => {
    if (!importance || importance === "none") return boardTheme === "dark" ? "rgba(140,140,140,.18)" : "rgba(0,0,0,.10)";
    return hexToRgba(PRIORITY_COLORS[importance as "High"|"Medium"|"Low"], boardTheme === "dark" ? 0.30 : 0.48);
  };
  const getNoteBorder = (importance: Importance | undefined) => {
    if (!importance || importance === "none") return `1px solid ${boardTheme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.10)"}`;
    return `1.5px solid ${hexToRgba(PRIORITY_COLORS[importance as "High"|"Medium"|"Low"], boardTheme === "dark" ? 0.28 : 0.42)}`;
  };
  const getAccent = (importance: Importance | undefined) => {
    if (!importance || importance === "none") return muted(boardTheme);
    return PRIORITY_COLORS[importance as "High"|"Medium"|"Low"];
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

  // Load persisted state — wait for Clerk to resolve before hydrating
  useEffect(() => {
    // isSignedIn is undefined while Clerk is still loading — wait for it
    if (isSignedIn === undefined) return;
    try {
      const saved = localStorage.getItem("boardtivity");
      if (saved) {
        const data = JSON.parse(saved) as {
          theme?: ThemeMode;
          boardTheme?: ThemeMode;
          boards?: Board[];
          notes?: Note[];
          activeBoardId?: string;
          drafts?: Draft[];
          thoughtColorMode?: "random" | "fixed";
          thoughtFixedColorIdx?: number;
          boardGrid?: "grid" | "dots" | "blank";
        };
        // Theme always restores — signed in or not
        if (data.theme) setTheme(data.theme);
        if (data.boardTheme) setBoardTheme(data.boardTheme);
        // Everything else only restores for signed-in users
        if (isSignedIn) {
          if (Array.isArray(data.boards) && data.boards.length > 0) setBoards(data.boards);
          if (Array.isArray(data.notes)) setNotes(data.notes);
          if (data.activeBoardId) setActiveBoardId(data.activeBoardId);
          if (Array.isArray(data.drafts)) setDrafts(data.drafts);
          if (data.thoughtColorMode) setThoughtColorMode(data.thoughtColorMode);
          if (typeof data.thoughtFixedColorIdx === "number") setThoughtFixedColorIdx(data.thoughtFixedColorIdx);
          if (data.boardGrid) setBoardGrid(data.boardGrid);
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

  // Sync theme attributes to document root so CSS data-theme rules apply reactively
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.backgroundColor = pageBg(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-board-theme", boardTheme);
  }, [boardTheme]);

  // Persist state to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (isSignedIn) {
        // Signed in: save everything
        localStorage.setItem("boardtivity", JSON.stringify({ theme, boardTheme, boards, notes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid }));
      } else {
        // Signed out: only save theme preferences so dark/light mode survives refresh
        localStorage.setItem("boardtivity", JSON.stringify({ theme, boardTheme }));
      }
    } catch {}
  }, [isHydrated, isSignedIn, theme, boardTheme, boards, notes, activeBoardId, drafts, thoughtColorMode, thoughtFixedColorIdx, boardGrid]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!boardsOpen && !settingsOpen) return;
      if (boardMenuRef.current?.contains(target)) return;
      if (boardButtonRef.current?.contains(target)) return;
      if (settingsRef.current?.contains(target)) return;
      if (settingsButtonRef.current?.contains(target)) return;
      setBoardsOpen(false);
      setSettingsOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [boardsOpen, settingsOpen]);

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

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!boardContainerRef.current) return;
    if (!document.fullscreenElement) {
      boardContainerRef.current.requestFullscreen();
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

  useEffect(() => {
    if (!focusOpen || focusCompleted || focusPaused) return;
    const id = window.setInterval(() => {
      setFocusSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
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
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
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

  function advanceToNext() {
    const next = focusNextStep;
    setFocusCompleted(false);
    setFocusNextStep(null);
    if (next) {
      setFocusStepId(next.id);
      focusStepIdRef.current = next.id;
      setFocusSecondsLeft((next.minutes ?? 25) * 60);
    } else {
      setFocusOpen(false);
      setFocusNoteId(null);
      setFocusStepId(null);
      setFocusChainMode(false);
    }
  }

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
      colorIdx: composerColorIdx,
    };

    setNotes((prev) => [...prev, note]);
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
      id: Date.now(),
      title: title.trim(),
      body: body.trim(),
      dueDate,
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
    setDetailNoteId(null);
  }

  function deleteTask(noteId: number) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId).map((n) => ({ ...n, linkedNoteIds: n.linkedNoteIds.filter((id) => id !== noteId) })));
    setDetailNoteId(null);
  }

  function startFocus(noteId: number, chain = false) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    let stepId: number | undefined;
    if (chain && note.steps.length > 0) {
      const first = note.steps.find(s => !s.done);
      if (!first) return; // all done
      stepId = first.id;
    }
    const step = stepId ? note.steps.find(s => s.id === stepId) : null;
    const total = step ? (step.minutes ?? 25) : (note.minutes ?? estimateTime(note.title));
    setFocusNoteId(noteId);
    setFocusStepId(stepId ?? null);
    setFocusChainMode(chain);
    setFocusSecondsLeft(total * 60);
    setFocusOpen(true);
  }

  return (
    <main style={{ minHeight: "100vh", fontFamily: "'Satoshi', Arial, sans-serif" }}>
      <section style={{ padding: isMobile ? "16px 18px 0" : "24px 48px 0" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <BoardtivityLogo size={isMobile ? 36 : 52} dark={theme === "dark"} />
            <span style={{ fontSize: isMobile ? 15 : 17, letterSpacing: ".02em", color: pageText(theme), fontWeight: 700 }}>Boardtivity</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isMobile && (
              <button
                onClick={() => feedbackRef.current?.scrollIntoView({ behavior: "smooth" })}
                style={{ ...buttonStyle(theme, false), fontSize: 13 }}
              >
                Feedback
              </button>
            )}
            <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
            {isSignedIn ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!isMobile && <span style={{ fontSize: 13, color: muted(theme) }}>{user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress}</span>}
                <button onClick={() => signOut()} style={buttonStyle(theme, false)}>Sign out</button>
              </div>
            ) : (
              <>
                <button onClick={() => openSignIn()} style={buttonStyle(theme, false)}>Sign in</button>
                {!isMobile && <button onClick={() => setWaitlistOpen(true)} style={buttonStyle(theme, true)}>Join waitlist</button>}
              </>
            )}
          </div>
        </header>
      </section>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{
        maxWidth: 560, margin: "0 auto", padding: isMobile ? "48px 20px 48px" : "80px 24px 72px",
        textAlign: "center",
        opacity: heroVisible ? 1 : 0,
        transform: heroVisible ? "none" : "translateY(20px)",
        transition: "opacity .75s ease, transform .75s ease",
      }}>
        <h1 style={{ margin: "0 0 24px", fontSize: "clamp(34px,4.8vw,64px)", lineHeight: 1.0, fontWeight: 900, letterSpacing: "-.055em", color: pageText(theme) }}>
          The <span className="hue-rotate">Board</span> and the Produc<span className="hue-rotate">tivity</span><br/>in one.
        </h1>
        <p style={{ margin: "0 auto 40px", maxWidth: 460, fontSize: 17, color: muted(theme), lineHeight: 1.82, opacity: .7 }}>
          Boardtivity is a freeform visual board for your tasks, ideas, and focus. Drag tasks anywhere, let AI break them down into steps, link ideas, chain subtasks, and lock into focus mode — all in one place.
        </p>

        {/* Inline email capture */}
        {isSignedIn ? (
          <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: muted(theme), opacity: .65, backgroundColor: theme === "dark" ? "rgba(111,196,107,.08)" : "rgba(60,190,90,.07)", border: `1px solid ${theme === "dark" ? "rgba(111,196,107,.2)" : "rgba(60,190,90,.2)"}`, borderRadius: 999, padding: "8px 16px" }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3.5" stroke="#6fc46b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Signed in — your board saves automatically
            </div>
          </div>
        ) : waitlistDone ? (
          <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "center", padding: "8px 0" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: theme === "dark" ? "rgba(111,196,107,.12)" : "rgba(60,190,90,.08)", border: `1.5px solid ${theme === "dark" ? "rgba(111,196,107,.32)" : "rgba(60,190,90,.28)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polyline points="5,13 9.5,17.5 19,8" stroke="#6fc46b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), marginBottom: 10 }}>You're on the waitlist.</div>
            <div style={{ fontSize: 15, color: muted(theme), lineHeight: 1.75, opacity: .7 }}>
              Keep an eye on your email — we'll reach out<br/>when Boardtivity is ready to launch.
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 400, margin: "0 auto" }}>
            <div style={{ marginBottom: 12, fontSize: 13, color: muted(theme), opacity: .6, letterSpacing: "-.01em" }}>
              Sign up to sync your board across devices &amp; get notified when the full app is ready.
            </div>
            <input
              type="email"
              placeholder="your@email.com"
              value={waitlistEmail}
              onChange={e => setWaitlistEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitWaitlist(waitlistEmail); }}
              style={{ width: "100%", height: 48, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#1c1f25" : "#ffffff", color: pageText(theme), fontSize: 15, padding: "0 16px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 }}
            />
            <button
              onClick={() => submitWaitlist(waitlistEmail)}
              style={{ width: "100%", height: 48, borderRadius: 10, border: "none", backgroundColor: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em" }}
            >
              Save my board &amp; sign up
            </button>
            <div style={{ marginTop: 10, fontSize: 12, color: muted(theme), opacity: .4 }}>Free · No credit card needed</div>
          </div>
        )}
        </section>

      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "0 48px 16px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: muted(theme), opacity: .55 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="7" y1="2" x2="7" y2="12"/><polyline points="3,8 7,12 11,8"/></svg>
          Try the board
        </div>
      </section>

      <section id="boardtivity-board" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 48px 24px" }}>
        {isMobile && (
          <div style={{ borderRadius: 16, border: `1px solid ${border(theme)}`, backgroundColor: paper(theme), padding: "32px 24px", textAlign: "center" }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: muted(theme), opacity: .5 }}>
                <rect x="3" y="5" width="30" height="20" rx="2.5"/>
                <line x1="11" y1="31" x2="25" y2="31"/>
                <line x1="18" y1="25" x2="18" y2="31"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: pageText(theme), marginBottom: 8 }}>Best on desktop</div>
            <div style={{ fontSize: 13, color: muted(theme), lineHeight: 1.7, opacity: .7 }}>The interactive board is designed for larger screens. Try it on your computer or iPad.</div>
          </div>
        )}
        <div id="board-shell" ref={boardContainerRef} style={{ ...boardStyle, ...(isFullscreen ? { borderRadius: 0, border: "none", minHeight: "100vh" } : {}), ...(isMobile ? { display: "none" } : {}) }}>
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
          {!waitlistDone && !isSignedIn && activeNotes.length > 0 && (
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
                        <span style={pill(boardTheme)}>{step.minutes} min</span>
                      </div>
                    </button>
                  ))
                )}

              {activeNotes.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, color: boardTheme === "dark" ? "#d8d8d6" : "#70695e" }}>
                    <img src="/logo-vertical.svg" alt="Boardtivity" style={{ width: 180, opacity: boardTheme === "dark" ? 0.65 : 0.55, filter: boardTheme === "dark" ? "invert(1)" : "none", pointerEvents: "none", userSelect: "none" }} />
                    <div style={{ width: 360 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
                        Click + to create your first {thoughtMode ? "idea" : "task"}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6 }}>
                        Drag the board, zoom in or out, and build your workspace from there.
                      </div>
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
                    width: note.type === "thought" ? ideaNoteWidth(note.title) : NOTE_W,
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
                            : `1.5px solid ${NOTE_PALETTE[(thoughtColorMode === "fixed" ? thoughtFixedColorIdx : (note.colorIdx ?? 0)) % NOTE_PALETTE.length].halo.replace(/[\d.]+\)$/, boardTheme === "dark" ? "0.32)" : "0.48)")}`,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: note.completed
                      ? (boardTheme === "dark" ? "#0e2e18" : "#e6f9ee")
                      : note.type === "task"
                        ? getBg(note.importance)
                        : paletteBg(thoughtColorMode === "fixed" ? thoughtFixedColorIdx : (note.colorIdx ?? 0), boardTheme),
                    boxShadow: thoughtDropTarget === note.id
                      ? `0 0 0 4px ${boardTheme === "dark" ? "rgba(140,150,230,.28)" : "rgba(100,110,200,.18)"}, 0 0 20px ${boardTheme === "dark" ? "rgba(140,150,230,.22)" : "rgba(100,110,200,.16)"}, 0 10px 18px rgba(59,43,16,.06)`
                      : thoughtUnlinkTarget === note.id
                        ? "0 0 0 4px rgba(220,60,60,.25), 0 0 20px rgba(220,60,60,.20), 0 10px 18px rgba(59,43,16,.06)"
                        : note.completed
                          ? `0 0 0 3px rgba(60,180,90,.25), 0 10px 18px rgba(0,0,0,.06)`
                          : note.type === "task"
                            ? `0 0 0 3px ${getHalo(note.importance)}, 0 10px 18px rgba(59,43,16,.06)`
                            : `0 0 0 3px ${paletteHalo(thoughtColorMode === "fixed" ? thoughtFixedColorIdx : (note.colorIdx ?? 0))}, 0 10px 18px rgba(59,43,16,.06)`,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "box-shadow .22s ease, border-color .22s ease",
                  }}
                  className={thoughtUnlinkTarget === note.id ? "thought-vibrate" : undefined}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={pill(boardTheme)}>{note.type === "task" ? "Task" : "Idea"}</div>
                    {note.type === "task" && note.dueDate && <div style={{ ...pill(boardTheme), fontWeight: 800 }}>Due {formatDate(note.dueDate)}</div>}
                  </div>

                  <div style={{ marginTop: 18, marginBottom: 6, fontSize: 17, lineHeight: 1.12, fontWeight: 700, color: noteText(boardTheme) }}>
                    {note.title}
                  </div>

                  {note.body && note.type === "thought" && (
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: noteSub(boardTheme) }}>
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

          <div style={{ position: "absolute", top: 12, left: 16, right: 16, zIndex: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              {/* Theme toggle — lightbulb */}
              <ThemeToggle theme={boardTheme} onToggle={() => setBoardTheme((t) => (t === "dark" ? "light" : "dark"))} />

              {/* Divider */}
              <div style={{ width: 1, height: 18, backgroundColor: border(boardTheme), margin: "0 2px" }} />

              {/* Center board */}
              <button onClick={centerBoard} style={circleButton(boardTheme)} aria-label="Center board" title="Center board">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>
              </button>

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
                  <button onClick={() => addBoard("task")} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 12 }}>+ Task</button>
                  <button onClick={() => addBoard("thought")} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 12 }}>+ Idea board</button>
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

              {/* Thought Note Color */}
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 10 }}>Idea Note Color</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, padding: 3, backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 10, border: `1px solid ${border(boardTheme)}` }}>
                  {(["random","fixed"] as const).map(mode => (
                    <button key={mode} onClick={() => setThoughtColorMode(mode)} style={{
                      flex: 1, height: 32, borderRadius: 8,
                      border: "none",
                      backgroundColor: thoughtColorMode === mode ? (boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#ffffff") : "transparent",
                      boxShadow: thoughtColorMode === mode ? (boardTheme === "dark" ? "0 1px 4px rgba(0,0,0,.3)" : "0 1px 4px rgba(0,0,0,.1)") : "none",
                      color: thoughtColorMode === mode ? pageText(boardTheme) : muted(boardTheme),
                      fontSize: 13, fontWeight: thoughtColorMode === mode ? 700 : 500, cursor: "pointer", textTransform: "capitalize",
                      transition: "background-color .12s, box-shadow .12s",
                    }}>{mode}</button>
                  ))}
                </div>
                {thoughtColorMode === "fixed" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {NOTE_PALETTE.map((p, i) => (
                      <button key={i} onClick={() => setThoughtFixedColorIdx(i)} style={{
                        width: 26, height: 26, borderRadius: "50%",
                        border: thoughtFixedColorIdx === i ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent",
                        outline: thoughtFixedColorIdx === i ? `2px solid ${p.swatch}` : "none",
                        outlineOffset: 2,
                        backgroundColor: p.swatch, cursor: "pointer", padding: 0,
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Account */}
              <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 2 }}>Account</div>
                {isSignedIn ? (
                  <>
                    <div style={{ fontSize: 13, color: muted(boardTheme), opacity: .7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user?.emailAddresses?.[0]?.emailAddress}
                    </div>
                    <button onClick={() => { setSettingsOpen(false); signOut(); }} style={{ ...buttonStyle(boardTheme, false), width: "100%", fontSize: 14, height: 42 }}>Sign out</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setSettingsOpen(false); openSignIn(); }} style={{ ...buttonStyle(boardTheme, false), width: "100%", fontSize: 14, height: 42 }}>Sign in</button>
                    <button onClick={() => { setSettingsOpen(false); setWaitlistOpen(true); }} style={{ ...buttonStyle(boardTheme, true), width: "100%", fontSize: 14, height: 42 }}>Join waitlist</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Fullscreen button — bottom left */}
          <button
            onClick={toggleFullscreen}
            style={{ ...circleButton(boardTheme, 34), position: "absolute", left: 18, bottom: 18, zIndex: 3, boxShadow: "0 8px 16px rgba(89,72,48,.08)" }}
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
            onClick={() => { setComposerColorIdx(thoughtColorMode === "fixed" ? thoughtFixedColorIdx : Math.floor(Math.random() * NOTE_PALETTE.length)); setComposerOpen(true); }}
            style={{ ...circleButton(boardTheme, 34), position: "absolute", right: 18, bottom: 18, zIndex: 3, boxShadow: "0 8px 16px rgba(89,72,48,.08)" }}
            aria-label="Add note"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
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
                    backgroundColor: thoughtMode ? paletteBg(composerColorIdx, boardTheme) : getBg(importance === "none" ? undefined : importance),
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

                {!thoughtMode && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
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

                    <div style={{ ...fieldStyle(boardTheme), justifyContent: "space-between" }}>
                      <button onClick={() => setMinutes((m) => Math.max(5, m - 5))} style={circleButton(boardTheme, 30)}>-</button>
                      <div style={{ flex: 1, textAlign: "center", color: pageText(boardTheme), opacity: 0.92 }}>{minutes} min</div>
                      <button onClick={() => setMinutes((m) => m + 5)} style={circleButton(boardTheme, 30)}>+</button>
                    </div>
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
                          AI planning
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
                            {aiSteps.length > 0 ? "Re-breakdown" : "Breakdown Task"}
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                        {aiSteps.length === 0 ? (
                          <div style={{ color: muted(boardTheme), fontSize: 14 }}>
                            {title.trim() ? "Click Breakdown Task to generate subtasks." : "Type a task first."}
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
                                  const newMins = Math.max(5, step.minutes - 5);
                                  setAiSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, minutes: newMins } : s));
                                  setMinutes((m) => Math.max(5, m - 5));
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: muted(boardTheme), fontSize: 16, padding: "0 2px", lineHeight: 1, fontWeight: 700 }}
                              >−</button>
                              <span style={{ fontSize: 14, fontWeight: 600, color: muted(boardTheme), minWidth: 22, textAlign: "center" }}>{step.minutes}</span>
                              <button
                                onClick={() => {
                                  setAiSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, minutes: s.minutes + 5 } : s));
                                  setMinutes((m) => m + 5);
                                }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: muted(boardTheme), fontSize: 16, padding: "0 2px", lineHeight: 1, fontWeight: 700 }}
                              >+</button>
                              <span style={{ fontSize: 13, color: muted(boardTheme) }}>min</span>
                              <button
                                onClick={() => {
                                  setMinutes((m) => Math.max(5, m - step.minutes));
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
                    {detailNote.type === "task" ? "Task details" : "Idea"}
                  </div>
                  {detailNote.type !== "task" && detailNote.createdAt && (
                    <div style={{ fontSize: 11, color: muted(boardTheme), opacity: .5 }}>
                      · Created {new Date(detailNote.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                </div>
                {detailEditing && detailNote.type !== "task" ? (
                  <input
                    autoFocus
                    value={detailEditTitle}
                    onChange={e => setDetailEditTitle(e.target.value)}
                    style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 22, fontWeight: 700, color: pageText(boardTheme), fontFamily: "inherit", padding: 0, boxSizing: "border-box" }}
                  />
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{detailNote.title}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {detailNote.type !== "task" && !detailEditing && (
                  <button
                    onClick={() => { setDetailEditTitle(detailNote.title); setDetailEditBody(detailNote.body ?? ""); setDetailEditing(true); }}
                    style={{ ...circleButton(boardTheme, 36), fontSize: 14 }}
                    title="Edit idea"
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
              <div style={{ borderRadius: 13, backgroundColor: (detailNote.completed || (detailNote.steps.length > 0 && detailNote.steps.every(s => s.done))) ? (boardTheme === "dark" ? "#0e2e18" : "#e6f9ee") : detailNote.type === "task" ? getBg(detailNote.importance === "none" ? undefined : detailNote.importance) : paletteBg(thoughtColorMode === "fixed" ? thoughtFixedColorIdx : (detailNote.colorIdx ?? 0), boardTheme), border: (detailNote.completed || (detailNote.steps.length > 0 && detailNote.steps.every(s => s.done))) ? `1px solid ${boardTheme === "dark" ? "rgba(60,180,90,.2)" : "rgba(60,180,90,.15)"}` : "1px solid rgba(0,0,0,.05)", padding: 20, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto" }}>
                {/* Focus header */}
                <div style={{ paddingBottom: 16, borderBottom: `1px solid ${border(boardTheme)}`, marginBottom: 16 }}>
                  {detailNote.dueDate && (
                    <div style={{ fontSize: 15, fontWeight: 600, color: pageText(boardTheme), marginBottom: 6 }}>
                      Due {formatDate(detailNote.dueDate)}
                    </div>
                  )}
                  {detailNote.type !== "task" && detailEditing ? (
                    <textarea
                      value={detailEditBody}
                      onChange={e => setDetailEditBody(e.target.value)}
                      placeholder="Add a note…"
                      rows={4}
                      style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontSize: 14, color: pageText(boardTheme), fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box", padding: 0 }}
                    />
                  ) : detailNote.body ? (
                    <div style={{ fontSize: 14, color: muted(boardTheme), lineHeight: 1.7 }}>
                      {detailNote.body}
                    </div>
                  ) : detailNote.type !== "task" ? (
                    <div style={{ fontSize: 14, color: muted(boardTheme), opacity: .4, lineHeight: 1.7, fontStyle: "italic" }}>No note added.</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                    {detailNote.minutes && <span style={pill(boardTheme)}>{detailNote.minutes} min</span>}
                    {detailNote.importance && detailNote.importance !== "none" && (
                      <span style={pill(boardTheme)}>{detailNote.importance} priority</span>
                    )}
                    {detailNote.type === "task" && (() => {
                      const doneCount = detailNote.steps.filter(s => s.done).length;
                      const total = detailNote.steps.length;
                      const completed = detailNote.completed || (total > 0 && doneCount === total);
                      if (completed) return <span style={pill(boardTheme)}>Completed</span>;
                      if (total > 0 && doneCount > 0) return <span style={pill(boardTheme)}>{doneCount}/{total} done</span>;
                      return <span style={pill(boardTheme)}>Not started</span>;
                    })()}
                  </div>
                </div>

                {detailNote.type === "task" ? (
                  <>
                    <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 12 }}>
                      Subtasks
                    </div>
                    {detailNote.steps.length === 0 ? (
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
                            <span style={{ ...pill(boardTheme), flexShrink: 0 }}>{step.minutes} min</span>
                          </button>
                        ))}
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
                            setNotes(ns => ns.map(n => n.id === detailNote.id ? { ...n, title: detailEditTitle.trim(), body: detailEditBody.trim() } : n));
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
                                  <div style={{ marginTop: 3, fontSize: 13, color: muted(boardTheme) }}>{nextStep.minutes} min</div>
                                </div>
                              ) : (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: pageText(boardTheme) }}>{detailNote.title}</div>
                                  <div style={{ marginTop: 3, fontSize: 13, color: muted(boardTheme) }}>{detailNote.minutes} min</div>
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
                <span style={pill(boardTheme)}>{stepModal.minutes} min</span>
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
          ? Math.min(100, Math.max(0, ((currentStepSecs - focusSecondsLeft) / currentStepSecs) * 100))
          : Math.min(100, Math.max(0, progressPct));

        // Shared progress bar sub-component (inline)
        const progressBar = (dimmed = false) => {
          const hasChain = focusChainMode && allSteps.length > 1;
          const trackAlpha = dimmed ? ".07" : ".10";
          const fillAlpha = dimmed ? ".22" : ".88";
          const barColor = `rgba(247,248,251,${fillAlpha})`;
          const trackColor = `rgba(255,255,255,${trackAlpha})`;
          return (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: hasChain ? 16 : 0 }}>
              {/* Current subtask bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: dimmed ? "rgba(247,248,251,.42)" : "rgba(247,248,251,.82)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {focusStep ? focusStep.title : (focusNote?.title ?? "")}
                  </span>
                  {hasChain && focusNote && focusStep && (
                    <span style={{ fontSize: 15, color: dimmed ? "rgba(247,248,251,.25)" : "rgba(247,248,251,.42)", flexShrink: 0 }}>
                      {focusNote.steps.findIndex(s => s.id === focusStepId) + 1} / {focusNote.steps.length}
                    </span>
                  )}
                </div>
                <div style={{ height: 6, borderRadius: 999, backgroundColor: trackColor, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${currentStepFill}%`, borderRadius: 999, backgroundColor: barColor, transition: "width 1s linear" }} />
                </div>
              </div>
              {/* Overall task bar — only shown in chain mode */}
              {hasChain && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: dimmed ? "rgba(247,248,251,.2)" : "rgba(247,248,251,.38)" }}>Overall progress</span>
                    <span style={{ fontSize: 15, color: dimmed ? "rgba(247,248,251,.2)" : "rgba(247,248,251,.38)", flexShrink: 0 }}>{Math.round(progressPct)}%</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {allSteps.map((s, i) => (
                      <div key={s.id} style={{
                        flex: s.minutes ?? 25, height: 6, borderRadius: 999,
                        backgroundColor: trackColor, overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: `${stepFills[i]}%`, borderRadius: 999,
                          backgroundColor: s.done
                            ? dimmed ? "rgba(111,196,107,.4)" : "#6fc46b"
                            : barColor,
                          transition: "width 1s linear",
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 40,
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
                        onClick={() => { setFocusOpen(false); setFocusCompleted(false); setFocusNextStep(null); setFocusNoteId(null); setFocusStepId(null); setFocusChainMode(false); }}
                        style={focusBtnGhost}
                      >
                        Finish
                      </button>
                    </>
                  ) : (
                    <button onClick={advanceToNext} style={focusBtnPrimary}>
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
                  <button onClick={() => { setFocusPaused(false); setBreakSecondsLeft(0); }} style={focusBtnPrimary}>
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
                  {String(Math.floor(focusSecondsLeft / 60)).padStart(2, "0")}:{String(focusSecondsLeft % 60).padStart(2, "0")}
                </div>
                <div style={{ marginTop: 48, width: "100%" }}>
                  {progressBar(false)}
                </div>
                <div style={{ marginTop: 44, display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => { setFocusPaused(true); setBreakSecondsLeft(300); }} style={focusBtnPrimary}>
                    5 min break
                  </button>
                  <button onClick={() => setFocusSecondsLeft(1)} style={focusBtnSecondary}>
                    Skip
                  </button>
                  <button onClick={() => setFocusExitConfirm(true)} style={focusBtnGhost}>
                    Exit
                  </button>
                </div>
              </div>
            )}

            {/* Exit confirmation overlay */}
            {focusExitConfirm && (
              <div style={{ position: "absolute", inset: 0, zIndex: 10, backgroundColor: "rgba(6,7,10,.88)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, textAlign: "center", padding: "40px 28px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f7f8fb", marginBottom: 10 }}>Exit focus mode?</div>
                <div style={{ fontSize: 14, color: "rgba(247,248,251,.45)", marginBottom: 28, lineHeight: 1.65 }}>Your timer will reset and your progress won't be saved.</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => {
                      setFocusOpen(false); setFocusExitConfirm(false); setFocusPaused(false);
                      setBreakSecondsLeft(0); setFocusSecondsLeft(0);
                      setFocusNoteId(null); setFocusStepId(null); setFocusChainMode(false);
                    }}
                    style={{ height: 40, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(220,60,60,.3)", backgroundColor: "rgba(220,60,60,.15)", color: "rgba(255,150,150,.85)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    Exit anyway
                  </button>
                  <button
                    onClick={() => setFocusExitConfirm(false)}
                    style={{ height: 40, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", backgroundColor: "rgba(255,255,255,.08)", color: "rgba(247,248,251,.75)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    Keep going
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
        <div ref={pricingRef} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
          {/* Free */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: "36px 28px", display: "flex", flexDirection: "column", opacity: pricingVisible ? 1 : 0, transform: pricingVisible ? "none" : "translateY(28px)", transition: "opacity .65s ease 0s, transform .65s ease 0s" }}>
            <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 16 }}>Free</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em", color: pageText(theme), marginBottom: 14 }}>Free forever</div>
            <div style={{ fontSize: 13, color: muted(theme), marginBottom: 18, lineHeight: 1.75, flexGrow: 1 }}>Full access to every feature — boards, tasks, subtasks, focus sessions, and idea notes. No credit card needed.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["Up to 3 boards", "Unlimited tasks & ideas", "Focus mode & subtasks", "Taskweb & Taskchain"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: pageText(theme) }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: hexToRgba("#6fc46b", .15), border: "1px solid rgba(111,196,107,.35)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="#6fc46b" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => setWaitlistOpen(true)} style={{ ...buttonStyle(theme, false), width: "100%", fontSize: 14, height: 42 }}>Get started free</button>
          </div>
          {/* Plus */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${theme === "dark" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"}`, backgroundColor: theme === "dark" ? "#0d0f12" : "#111315", padding: "36px 28px", display: "flex", flexDirection: "column", opacity: pricingVisible ? 1 : 0, transform: pricingVisible ? "none" : "translateY(28px)", transition: "opacity .65s ease .1s, transform .65s ease .1s" }}>
            <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent)", pointerEvents: "none" }}/>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,.45)" }}>Plus</div>
              <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,.38)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "3px 8px" }}>Most popular</div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em", color: "#f7f8fb", marginBottom: 14 }}>$5.99 / mo</div>
            <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,.42)", marginBottom: 18, flexGrow: 1 }}>Everything in Free, plus more boards and personalization to match your workflow.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["Up to 10 boards", "Custom idea note colors", "Google & Apple Calendar sync", "Priority support"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,.72)" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="rgba(255,255,255,.7)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => setWaitlistOpen(true)} style={{ width: "100%", height: 42, borderRadius: 999, border: "none", backgroundColor: "#f7f8fb", color: "#111315", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Get Plus</button>
          </div>
          {/* Beta */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: "36px 28px", display: "flex", flexDirection: "column", opacity: pricingVisible ? 1 : 0, transform: pricingVisible ? "none" : "translateY(28px)", transition: "opacity .65s ease .2s, transform .65s ease .2s" }}>
            <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 16 }}>Beta</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em", color: pageText(theme), marginBottom: 14 }}>Join early.</div>
            <div style={{ fontSize: 13, color: muted(theme), marginBottom: 18, lineHeight: 1.75, flexGrow: 1 }}>Get early access, shape the product with direct feedback, and lock in launch pricing before we go live.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["Everything in Plus, free during beta", "Direct line to the founders", "Lock in launch pricing"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: pageText(theme) }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: hexToRgba("#6fc46b", .15), border: "1px solid rgba(111,196,107,.35)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="#6fc46b" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => setWaitlistOpen(true)} style={{ ...buttonStyle(theme, true), width: "100%", fontSize: 14, height: 42 }}>Join waitlist</button>
          </div>
        </div>
      </section>

      {/* ── Waitlist modal ── */}
      {waitlistOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: theme === "dark" ? "rgba(6,8,12,.6)" : "rgba(0,0,0,.28)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setWaitlistOpen(false); setWaitlistDone(false); setWaitlistEmail(""); } }}>
          <div style={{ width: "min(420px,100%)", borderRadius: 18, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: "32px 28px", boxShadow: "0 32px 80px rgba(0,0,0,.24)" }}>
            {waitlistDone ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: theme === "dark" ? "rgba(80,180,100,.15)" : "rgba(60,190,90,.12)", border: "1.5px solid rgba(60,180,90,.35)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><polyline points="5,12 9,16 17,7" stroke="#6fc46b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: pageText(theme), marginBottom: 8 }}>
                  {activeNotes.length > 0 ? "Board saved!" : "You're on the list."}
                </div>
                <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.7 }}>
                  {activeNotes.length > 0
                    ? "Your board is saved. We'll reach out when Boardtivity launches."
                    : "We'll reach out when Boardtivity is ready. Thanks for joining early."}
                </div>
                <button onClick={() => { setWaitlistOpen(false); setWaitlistDone(false); setWaitlistEmail(""); }} style={{ ...buttonStyle(theme, true), marginTop: 24, width: "100%" }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: pageText(theme), marginBottom: 6 }}>
                  {activeNotes.length > 0 ? "Save your board & join the waitlist" : "Join the waitlist"}
                </div>
                <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.7, marginBottom: 22 }}>
                  {activeNotes.length > 0
                    ? "Enter your email to save your board and get early access when Boardtivity launches."
                    : "Be the first to know when Boardtivity launches. We'll notify you with early access and launch pricing."}
                </div>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && waitlistEmail.includes("@")) setWaitlistDone(true); }}
                  style={{ width: "100%", height: 48, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: inputBg(theme), color: pageText(theme), padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
                <button
                  onClick={() => submitWaitlist(waitlistEmail)}
                  style={{ ...buttonStyle(theme, true), marginTop: 10, width: "100%", fontSize: 14, height: 44 }}
                >Join waitlist</button>
                <button onClick={() => setWaitlistOpen(false)} style={{ background: "none", border: "none", width: "100%", marginTop: 8, fontSize: 13, color: muted(theme), cursor: "pointer", padding: "6px 0" }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

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

    </main>
  );
}
