import type { ThemeMode, Importance } from "@/lib/board";

export const NOTE_PALETTE = [
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
export const TASK_PALETTE = [
  { light: "#fde8e8", dark: "#3d1515", halo: "rgba(215,60,60,.22)",   swatch: "#c03030" },  // red   (High default)
  { light: "#fdeede", dark: "#3a2210", halo: "rgba(220,130,40,.22)",  swatch: "#d07030" },  // orange (Med default)
  { light: "#fdfae0", dark: "#352c12", halo: "rgba(210,190,40,.22)",  swatch: "#c8960a" },  // yellow (Low default)
  ...NOTE_PALETTE.slice(0, 7), // pink → lime only (no orange/yellow/red overlap)
];

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Blend a hex color into a background hex — returns a fully opaque rgb string.
export function blendHex(hex: string, bgHex: string, alpha: number): string {
  const pr = parseInt(hex.slice(1,3),16), pg = parseInt(hex.slice(3,5),16), pb = parseInt(hex.slice(5,7),16);
  const br = parseInt(bgHex.slice(1,3),16), bg2 = parseInt(bgHex.slice(3,5),16), bb = parseInt(bgHex.slice(5,7),16);
  const r = Math.round(pr*alpha + br*(1-alpha));
  const g = Math.round(pg*alpha + bg2*(1-alpha));
  const b = Math.round(pb*alpha + bb*(1-alpha));
  return `rgb(${r},${g},${b})`;
}

// Ensures the card background has at least `minDelta` average-RGB distance from the page background.
// Prevents near-invisible cards when custom colors are very dark (dark mode) or very light (light mode).
export function clampCardBg(cssColor: string, pageBgHex: string, minDelta: number): string {
  const m = cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return cssColor;
  let r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
  const pr = parseInt(pageBgHex.slice(1,3),16), pg = parseInt(pageBgHex.slice(3,5),16), pb = parseInt(pageBgHex.slice(5,7),16);
  const pageLum = (pr + pg + pb) / 3;
  const cardLum = (r + g + b) / 3;
  if (pageLum < 128) {
    // Dark page: card must be brighter
    const deficit = (pageLum + minDelta) - cardLum;
    if (deficit > 0) { r = Math.min(255, Math.round(r + deficit)); g = Math.min(255, Math.round(g + deficit)); b = Math.min(255, Math.round(b + deficit)); }
  } else {
    // Light page: card must be darker
    const excess = cardLum - (pageLum - minDelta);
    if (excess > 0) { r = Math.max(0, Math.round(r - excess)); g = Math.max(0, Math.round(g - excess)); b = Math.max(0, Math.round(b - excess)); }
  }
  return `rgb(${r},${g},${b})`;
}

export const PRIORITY_COLORS: Record<"High"|"Medium"|"Low", string> = { High: "#c03030", Medium: "#d07030", Low: "#c8960a" };

export function paletteBg(colorIdx: number | undefined, theme: ThemeMode): string {
  const p = NOTE_PALETTE[(colorIdx ?? 0) % NOTE_PALETTE.length];
  return theme === "dark" ? p.dark : p.light;
}

export function paletteHalo(colorIdx: number | undefined): string {
  return NOTE_PALETTE[(colorIdx ?? 0) % NOTE_PALETTE.length].halo;
}

export function noteText(theme: ThemeMode) {
  return theme === "dark" ? "#f5f5f2" : "#1f1d1a";
}

export function noteSub(theme: ThemeMode) {
  return theme === "dark" ? "#d9d9d7" : "#696257";
}

export function priorityColor(importance: Importance | undefined, theme: ThemeMode) {
  if (importance === "High") return theme === "dark" ? "#ff8080" : "#c03030";
  if (importance === "Medium") return theme === "dark" ? "#ffaa60" : "#b05a20";
  if (importance === "Low") return theme === "dark" ? "#e8d840" : "#8a7a10";
  return theme === "dark" ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.38)";
}
