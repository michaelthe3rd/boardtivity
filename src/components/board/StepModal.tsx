"use client";

import { pageText, muted, border, buttonStyle, circleButton, pill } from "@/lib/ui";
import { useHome } from "@/components/home/HomeContext";

// Subtask detail dialog.
export default function StepModal() {
  const {
    boardTheme, activeStep, setActiveStep, stepModal, startFocus,
  } = useHome();
  if (!(stepModal && activeStep)) return null;
  return (
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
  );
}
