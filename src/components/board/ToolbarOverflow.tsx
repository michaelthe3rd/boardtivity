"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ThemeMode } from "@/lib/board";
import { border, circleButton, panel } from "@/lib/ui";
import { MoreVerticalIcon } from "@/components/ui/Icons";

// Board toolbar buttons that fold into a "More" menu when the toolbar is too narrow to fit
// them next to BOB. Wide: the buttons render inline. Compact: one button opens them in a column.
export default function ToolbarOverflow({ theme, compact, children }: { theme: ThemeMode; compact: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (!compact) setOpen(false); }, [compact]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!compact) return <>{children}</>;

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex" }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        className={open ? undefined : "hover-tip"}
        data-tip="More"
        style={{
          ...circleButton(theme),
          ...(open ? { backgroundColor: theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.07)" } : {}),
        }}
      >
        <MoreVerticalIcon size={16} />
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          style={{
            position: "absolute", top: 46, left: "50%", transform: "translateX(-50%)", zIndex: 10,
            display: "flex", flexDirection: "column", gap: 6, padding: 5,
            borderRadius: 999, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme),
            boxShadow: theme === "dark" ? "0 8px 24px rgba(0,0,0,.4)" : "0 8px 24px rgba(0,0,0,.12)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
