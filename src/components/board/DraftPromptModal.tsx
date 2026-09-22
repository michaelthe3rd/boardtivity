"use client";

import { pageText, muted, border, buttonStyle} from "@/lib/ui";
import { useHome } from "@/components/home/HomeContext";

// Asks whether to keep an unfinished task as a draft.
export default function DraftPromptModal() {
  const {
    boardTheme, setComposerOpen, draftPromptOpen, setDraftPromptOpen, resetComposer, saveDraft,
  } = useHome();
  if (!(draftPromptOpen)) return null;
  return (
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
  );
}
