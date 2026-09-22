"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ThemeMode } from "@/lib/board";
import { border } from "@/lib/ui";

// Centered dialog over a blurred backdrop. `strong` dims the page more (used for celebratory notices).
export default function Modal({ theme, onClose, width = 400, strong = false, cardStyle, children }: {
  theme: ThemeMode;
  onClose?: () => void;
  width?: number;
  strong?: boolean;
  cardStyle?: CSSProperties;
  children: ReactNode;
}) {
  const dark = theme === "dark";
  const backdrop = strong ? (dark ? "rgba(6,8,12,.8)" : "rgba(10,10,12,.4)") : (dark ? "rgba(6,8,12,.7)" : "rgba(10,10,12,.32)");
  const blur = strong ? "blur(12px)" : "blur(10px)";
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: backdrop, backdropFilter: blur, WebkitBackdropFilter: blur, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div style={{
        width: `min(${width}px,100%)`, backgroundColor: dark ? "#1a1d22" : "#fbf8f1",
        borderRadius: strong ? 22 : 20, boxShadow: strong ? "0 40px 100px rgba(0,0,0,.32)" : "0 30px 80px rgba(0,0,0,.28)",
        border: `1px solid ${border(theme)}`, padding: strong ? "36px 30px 26px" : "28px 26px 22px", fontFamily: "inherit",
        ...cardStyle,
      }}>
        {children}
      </div>
    </div>
  );
}
