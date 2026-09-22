import type { Board, BoardType, Step } from "@/lib/board";

export const BOARD_W = 6800;

export const BOARD_H = 4200;

export const NOTE_W = 228;

export const NOTE_H = 138;

export function noteCardWidth(title: string): number {
  const len = title.length;
  if (len <= 28) return 228;
  if (len <= 52) return 268;
  if (len <= 85) return 308;
  return 344;
}

export function titleFontSize(title: string): number {
  const len = title.length;
  if (len <= 40) return 17;
  if (len <= 70) return 15;
  return 13;
}

export const STEP_W = 210;

export const STEP_H = 62;

export const INITIAL_BOARDS: Board[] = [
  { id: "my-board", name: "My Board", type: "task" },
  { id: "my-thoughts", name: "My Ideas", type: "thought" },
];

// Collision-resistant integer ID: millisecond timestamp × 1000 + random 0–999.
// Safe up to year ~2255 within Number.MAX_SAFE_INTEGER.
export function genId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

export function nextBoardName(existing: Board[], type: BoardType) {
  const base = type === "task" ? "My Board" : "My Ideas";
  const count = existing.filter((b) => b.type === type).length;
  return count === 0 ? base : `${base} #${count + 1}`;
}

export function layoutWeb(noteX: number, noteY: number, steps: Step[]) {
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

export function layoutChain(noteX: number, noteY: number, steps: Step[]) {
  const startX = noteX + NOTE_W + 72;
  const startY = noteY - 12;
  return steps.map((step, index) => ({
    ...step,
    x: startX + index * 210,
    y: startY + index * 24,
  }));
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem("boardtivity");
    if (s) { const d = JSON.parse(s); if (d[key] !== undefined) return d[key] as T; }
  } catch {}
  return fallback;
}
