"use client";

import type { CSSProperties, ReactNode } from "react";

// A styled date field: renders `children` as the visible label and lays an invisible native
// <input type="date"> over it. Desktop browsers only open the calendar from the input's own
// (hidden) icon, so we open it explicitly on click with showPicker().
export default function DateField({ value, onChange, children, style }: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: "relative", ...style }}>
      {children}
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        onClick={e => { try { e.currentTarget.showPicker(); } catch { /* unsupported or already open */ } }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 1 }}
      />
    </div>
  );
}
