"use client";

import type { CSSProperties } from "react";
import { fmtFocusTime } from "@/lib/dates";
import { useHome } from "@/components/home/HomeContext";

// Full-screen focus timer with subtask chain progress, pause/break and exit confirm.
export default function FocusOverlay() {
  const {
    notes, focusOpen, setFocusOpen, focusNoteId, setFocusNoteId, focusStepId, setFocusStepId, focusSecondsLeft,
    setFocusSecondsLeft, focusCompleted, focusPaused, setFocusPaused, breakSecondsLeft, setBreakSecondsLeft, focusChainMode, setFocusChainMode,
    focusNextStep, focusExitConfirm, setFocusExitConfirm, focusSessionStartRef, focusStartedAtRef, focusTotalSecsRef, focusPausedSecsRef, isAdmin,
    advanceToNext, closeFocusWithReview,
  } = useHome();
  if (!(focusOpen && focusNoteId)) return null;
  const focusNote = notes.find(n => n.id === focusNoteId);
  if (!focusNote) return null;
  const focusStep = focusStepId ? focusNote?.steps.find(s => s.id === focusStepId) : null;
  const completedLabel = focusStep ? focusStep.title : focusNote?.title;
  const isSubtask = !!focusStep;
  const isLastSubtask = isSubtask && !focusNextStep && focusChainMode;
  const allSteps = focusNote?.steps ?? [];


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




  // Shared progress bar sub-component (inline)
  const progressBar = (dimmed = false) => {
    const hasChain = focusChainMode && allSteps.length > 1;
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
            {fmtFocusTime(Math.floor((Date.now() - focusSessionStartRef.current) / 60000))} focused — log it before you go.
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
}
