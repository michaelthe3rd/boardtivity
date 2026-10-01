"use client";

import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { BoardArrow, BoardSticker, Note, StickerKind, ThemeMode } from "@/lib/board";
import { NOTE_H, noteCardWidth } from "@/lib/boardLayout";
import { border, muted, pageText, panel } from "@/lib/ui";
import LockIcon from "@/components/ui/LockIcon";
import { useHome } from "@/components/home/HomeContext";

// ── Stickers ──────────────────────────────────────────────────────────────────
export const STICKER_KINDS: { kind: StickerKind; label: string }[] = [
  { kind: "arrow", label: "Arrow" },
  { kind: "star", label: "Star" },
  { kind: "alert", label: "Important" },
  { kind: "question", label: "Question" },
  { kind: "check", label: "Done" },
  { kind: "heart", label: "Love" },
  { kind: "fire", label: "Hot" },
  { kind: "pin", label: "Pin" },
];

const STICKER_EMOJI: Partial<Record<StickerKind, string>> = {
  star: "⭐", alert: "❗", question: "❓", check: "✅", heart: "❤️", fire: "🔥", pin: "📌",
};

const STICKER_SIZE = 48;

export function StickerGlyph({ kind, size = STICKER_SIZE, theme }: { kind: StickerKind; size?: number; theme: ThemeMode }) {
  if (kind === "arrow") {
    // A chunky right-pointing arrow; rotate the sticker to aim it.
    const fill = theme === "dark" ? "#f5f5f2" : "#171613";
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block" }}>
        <path d="M6 19h22v-9l15 14-15 14v-9H6z" fill={fill} stroke={theme === "dark" ? "#171613" : "#fff"} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  }
  return <span style={{ fontSize: size * 0.78, lineHeight: `${size}px`, display: "block", textAlign: "center", width: size, height: size }} aria-hidden="true">{STICKER_EMOJI[kind]}</span>;
}

// ── Geometry ──────────────────────────────────────────────────────────────────
type Rect = { cx: number; cy: number; hw: number; hh: number };

function cardRect(note: Note): Rect {
  const w = noteCardWidth(note.title);
  return { cx: note.x + w / 2, cy: note.y + NOTE_H / 2, hw: w / 2, hh: NOTE_H / 2 };
}

// Where the line from `r`'s center toward (tx, ty) leaves the card, pushed out by `pad`.
function edgePoint(r: Rect, tx: number, ty: number, pad: number) {
  const dx = tx - r.cx, dy = ty - r.cy;
  if (dx === 0 && dy === 0) return { x: r.cx, y: r.cy };
  const t = Math.min(dx === 0 ? Infinity : (r.hw + pad) / Math.abs(dx), dy === 0 ? Infinity : (r.hh + pad) / Math.abs(dy));
  return { x: r.cx + dx * t, y: r.cy + dy * t };
}

function arrowColor(theme: ThemeMode, selected: boolean) {
  if (selected) return "#3b82f6";
  return theme === "dark" ? "rgba(255,255,255,.6)" : "rgba(23,22,19,.55)";
}

// Small floating toolbar that stays readable at any zoom level.
function SelectionBar({ x, y, scale, theme, children }: { x: number; y: number; scale: number; theme: ThemeMode; children: ReactNode }) {
  return (
    <div
      data-drawing="true"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", left: x, top: y, zIndex: 6,
        transform: `translate(-50%, -100%) scale(${1 / scale})`, transformOrigin: "50% 100%",
        display: "flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 12,
        backgroundColor: panel(theme), border: `1px solid ${border(theme)}`, boxShadow: "0 8px 24px rgba(0,0,0,.16)",
      }}
    >
      {children}
    </div>
  );
}

function barButton(theme: ThemeMode, danger = false): CSSProperties {
  return {
    height: 30, minWidth: 30, padding: "0 8px", borderRadius: 8, border: "none", cursor: "pointer",
    backgroundColor: "transparent", color: danger ? "#c03030" : pageText(theme), fontSize: 13, fontWeight: 700,
    display: "grid", placeItems: "center", fontFamily: "inherit",
  };
}

// ── Arrows (rendered inside the zoomed canvas) ───────────────────────────────
export function ArrowsLayer({ boardW, boardH }: { boardW: number; boardH: number }) {
  const { arrows, activeNotes, activeBoardId, boardTheme, scale, drawSelection, setDrawSelection, updateArrow, reverseArrow, deleteArrow } = useHome();
  const byId = new Map(activeNotes.map(n => [n.id, n]));
  const visible = arrows
    .filter(a => a.boardId === activeBoardId)
    .map(a => {
      const from = byId.get(a.fromNoteId), to = byId.get(a.toNoteId);
      if (!from || !to) return null;
      const fr = cardRect(from), tr = cardRect(to);
      const p1 = edgePoint(fr, tr.cx, tr.cy, 6);
      const p2 = edgePoint(tr, fr.cx, fr.cy, 10);
      return { arrow: a, p1, p2, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } };
    })
    .filter((v): v is { arrow: BoardArrow; p1: { x: number; y: number }; p2: { x: number; y: number }; mid: { x: number; y: number } } => v !== null);

  const selected = drawSelection?.type === "arrow" ? visible.find(v => v.arrow.id === drawSelection.id) : undefined;

  return (
    <>
      <svg width={boardW} height={boardH} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
        <defs>
          {[false, true].map(sel => (
            <marker key={String(sel)} id={`bt-arrowhead-${sel ? "sel" : "def"}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={arrowColor(boardTheme, sel)} />
            </marker>
          ))}
        </defs>
        {visible.map(({ arrow, p1, p2 }) => {
          const isSel = drawSelection?.type === "arrow" && drawSelection.id === arrow.id;
          return (
            <g key={arrow.id}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={arrowColor(boardTheme, isSel)} strokeWidth={isSel ? 3 : 2.5} strokeLinecap="round" markerEnd={`url(#bt-arrowhead-${isSel ? "sel" : "def"})`} />
              {/* Wide invisible hit area so thin arrows are easy to click */}
              <line
                data-drawing="true"
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke="transparent" strokeWidth={18}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setDrawSelection({ type: "arrow", id: arrow.id }); }}
              />
            </g>
          );
        })}
      </svg>

      {visible.filter(v => v.arrow.label).map(({ arrow, mid }) => (
        <div
          key={`label-${arrow.id}`}
          data-drawing="true"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setDrawSelection({ type: "arrow", id: arrow.id }); }}
          style={{
            position: "absolute", left: mid.x, top: mid.y, transform: "translate(-50%, -50%)", zIndex: 2,
            padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
            backgroundColor: panel(boardTheme), color: pageText(boardTheme), border: `1px solid ${border(boardTheme)}`,
          }}
        >
          {arrow.label}
        </div>
      ))}

      {selected && (
        <SelectionBar x={selected.mid.x} y={selected.mid.y - 18} scale={scale} theme={boardTheme}>
          <input
            autoFocus={!selected.arrow.label}
            value={selected.arrow.label ?? ""}
            onChange={e => updateArrow(selected.arrow.id, { label: e.target.value.slice(0, 40) || undefined })}
            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setDrawSelection(null); }}
            placeholder="Label (e.g. then, blocks)"
            style={{ width: 170, height: 30, borderRadius: 8, border: `1px solid ${border(boardTheme)}`, padding: "0 9px", fontSize: 13, fontFamily: "inherit", backgroundColor: "transparent", color: pageText(boardTheme), outline: "none" }}
          />
          <button type="button" title="Reverse direction" aria-label="Reverse direction" onClick={() => reverseArrow(selected.arrow.id)} style={barButton(boardTheme)}>⇄</button>
          <button type="button" title="Delete arrow" aria-label="Delete arrow" onClick={() => deleteArrow(selected.arrow.id)} style={barButton(boardTheme, true)}>Delete</button>
        </SelectionBar>
      )}
    </>
  );
}

// ── Stickers (rendered inside the zoomed canvas) ─────────────────────────────
export function StickersLayer() {
  const { stickers, activeBoardId, boardTheme, scale, drawSelection, setDrawSelection, updateSticker, deleteSticker } = useHome();
  const dragRef = useRef<{ id: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const visible = stickers.filter(s => s.boardId === activeBoardId);
  const selected = drawSelection?.type === "sticker" ? visible.find(s => s.id === drawSelection.id) : undefined;

  return (
    <>
      {visible.map((s: BoardSticker) => {
        const isSel = selected?.id === s.id;
        return (
          <div
            key={s.id}
            data-drawing="true"
            role="img"
            aria-label={`${STICKER_KINDS.find(k => k.kind === s.kind)?.label ?? "Sticker"} sticker`}
            onPointerDown={e => {
              e.stopPropagation();
              if (e.button === 2) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = { id: s.id, startX: e.clientX, startY: e.clientY, x: s.x, y: s.y, moved: false };
            }}
            onPointerMove={e => {
              const d = dragRef.current;
              if (!d || d.id !== s.id || s.locked) return;
              const dx = (e.clientX - d.startX) / scale, dy = (e.clientY - d.startY) / scale;
              if (!d.moved && Math.hypot(dx, dy) < 4) return;
              d.moved = true;
              updateSticker(s.id, { x: Math.round(d.x + dx), y: Math.round(d.y + dy) });
            }}
            onPointerUp={e => {
              e.stopPropagation();
              const d = dragRef.current;
              dragRef.current = null;
              if (d && !d.moved) setDrawSelection(isSel ? null : { type: "sticker", id: s.id });
            }}
            onClick={e => e.stopPropagation()}
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); updateSticker(s.id, { locked: !s.locked }); }}
            style={{
              position: "absolute", left: s.x - STICKER_SIZE / 2, top: s.y - STICKER_SIZE / 2, width: STICKER_SIZE, height: STICKER_SIZE,
              transform: `rotate(${s.rotation}deg)`, zIndex: 3, cursor: s.locked ? "pointer" : "grab", touchAction: "none",
              borderRadius: 12, outline: isSel ? "2px solid #3b82f6" : "none", outlineOffset: 3,
              filter: "drop-shadow(0 3px 5px rgba(0,0,0,.18))", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
            }}
          >
            <StickerGlyph kind={s.kind} theme={boardTheme} />
          </div>
        );
      })}

      {selected && (
        <SelectionBar x={selected.x} y={selected.y - STICKER_SIZE / 2 - 12} scale={scale} theme={boardTheme}>
          <button type="button" title="Rotate left" aria-label="Rotate left" onClick={() => updateSticker(selected.id, { rotation: (selected.rotation - 45 + 360) % 360 })} style={barButton(boardTheme)}>↺</button>
          <button type="button" title="Rotate right" aria-label="Rotate right" onClick={() => updateSticker(selected.id, { rotation: (selected.rotation + 45) % 360 })} style={barButton(boardTheme)}>↻</button>
          <button type="button" title={selected.locked ? "Unlock" : "Lock in place"} aria-label={selected.locked ? "Unlock sticker" : "Lock sticker"} aria-pressed={!!selected.locked} onClick={() => updateSticker(selected.id, { locked: !selected.locked })} style={barButton(boardTheme)}>
            <LockIcon locked={!!selected.locked} size={14} />
          </button>
          <button type="button" title="Delete sticker" aria-label="Delete sticker" onClick={() => deleteSticker(selected.id)} style={barButton(boardTheme, true)}>Delete</button>
        </SelectionBar>
      )}
    </>
  );
}

// ── Draw toolbar (fixed to the board frame, not zoomed) ──────────────────────
export function DrawToolbar() {
  const { drawMode, drawTool, setDrawTool, connectFromId, setConnectFromId, setDrawModeOn, boardTheme } = useHome();
  if (!drawMode) return null;
  const dark = boardTheme === "dark";
  const hint = drawTool.type === "connect"
    ? (connectFromId === null ? "Click a card to start an arrow" : "Now click the card it points to")
    : `Click the board to place a ${STICKER_KINDS.find(k => k.kind === drawTool.kind)?.label.toLowerCase()} sticker`;
  const toolStyle = (active: boolean): CSSProperties => ({
    width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer", padding: 0, display: "grid", placeItems: "center",
    backgroundColor: active ? (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)") : "transparent",
    boxShadow: active ? `inset 0 0 0 1.5px ${dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)"}` : "none",
  });

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, maxWidth: "calc(100% - 24px)" }}
    >
      <div role="status" style={{ fontSize: 12, fontWeight: 600, color: muted(boardTheme), backgroundColor: panel(boardTheme), border: `1px solid ${border(boardTheme)}`, borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" }}>
        {hint}
      </div>
      <div role="toolbar" aria-label="Drawing tools" style={{ display: "flex", alignItems: "center", gap: 2, padding: 5, borderRadius: 14, backgroundColor: panel(boardTheme), border: `1px solid ${border(boardTheme)}`, boxShadow: "0 10px 30px rgba(0,0,0,.14)", overflowX: "auto" }}>
        <button
          type="button"
          title="Connect cards with an arrow"
          aria-label="Connect cards"
          aria-pressed={drawTool.type === "connect"}
          onClick={() => { setDrawTool({ type: "connect" }); setConnectFromId(null); }}
          style={{ ...toolStyle(drawTool.type === "connect"), width: "auto", padding: "0 12px", gap: 6, display: "flex", alignItems: "center", color: pageText(boardTheme), fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="7" height="6" rx="1.5" /><rect x="15" y="14" width="7" height="6" rx="1.5" /><path d="M9 7h4a3 3 0 0 1 3 3v4" /><path d="M13.5 11.5 16 14l2.5-2.5" /></svg>
          Connect
        </button>
        <div style={{ width: 1, height: 26, backgroundColor: border(boardTheme), margin: "0 4px" }} />
        {STICKER_KINDS.map(({ kind, label }) => {
          const active = drawTool.type === "sticker" && drawTool.kind === kind;
          return (
            <button key={kind} type="button" title={`${label} sticker`} aria-label={`${label} sticker`} aria-pressed={active} onClick={() => { setDrawTool({ type: "sticker", kind }); setConnectFromId(null); }} style={toolStyle(active)}>
              <StickerGlyph kind={kind} size={26} theme={boardTheme} />
            </button>
          );
        })}
        <div style={{ width: 1, height: 26, backgroundColor: border(boardTheme), margin: "0 4px" }} />
        <button
          type="button"
          onClick={() => setDrawModeOn(false)}
          style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "none", cursor: "pointer", backgroundColor: dark ? "#f5f5f2" : "#171613", color: dark ? "#171613" : "#f5f5f2", fontSize: 13, fontWeight: 800, fontFamily: "inherit" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
