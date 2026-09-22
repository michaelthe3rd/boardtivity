"use client";

import type { CSSProperties } from "react";
import { fmtFocusTime } from "@/lib/dates";
import { useHome } from "@/components/home/HomeContext";

// Shown when a focus session ends: log time and mark the task or subtask done.
export default function SessionReviewModal() {
  const {
    notes, setFocusNoteId, focusReview, setFocusReview, focusStatsData, handleFocusReviewDone,
  } = useHome();
  if (!(focusReview)) return null;
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
          {fmtFocusTime(focusReview.elapsedMin)} focused
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
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f7f8fb" }}>{fmtFocusTime(todayMin)}</div>
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
}
