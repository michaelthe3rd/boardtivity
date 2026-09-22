"use client";

import { pageText, border, buttonStyle} from "@/lib/ui";
import { useHome } from "@/components/home/HomeContext";

// Rename board dialog.
export default function RenameBoardModal() {
  const {
    boardTheme, renameBoardId, setRenameBoardId, renameValue, setRenameValue, saveRename,
  } = useHome();
  if (!(renameBoardId)) return null;
  return (
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
  );
}
