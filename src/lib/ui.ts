import type { CSSProperties } from "react";
import type { ThemeMode } from "@/lib/board";

// Theme tokens and shared inline-style builders.

export function pageBg(theme: ThemeMode) {
  return theme === "dark" ? "#0d0f12" : "#f3f1eb";
}

export function pageText(theme: ThemeMode) {
  return theme === "dark" ? "#f5f5f2" : "#171613";
}

export function muted(theme: ThemeMode) {
  return theme === "dark" ? "rgba(255,255,255,.72)" : "rgba(23,22,19,.62)";
}

export function surface(theme: ThemeMode) {
  return theme === "dark" ? "#17191d" : "#ffffff";
}

export function border(theme: ThemeMode) {
  return theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)";
}

export function paper(theme: ThemeMode) {
  return theme === "dark" ? "#2d3137" : "#fafaf7";
}

export function grid(theme: ThemeMode) {
  return theme === "dark" ? "rgba(255,255,255,.032)" : "rgba(78,78,78,.065)";
}

export function panel(theme: ThemeMode) {
  return theme === "dark" ? "#1f2329" : "#ffffff";
}

export function inputBg(theme: ThemeMode) {
  return theme === "dark" ? "#282c33" : "#ffffff";
}

export function buttonStyle(theme: ThemeMode, dark = false, compact = false): CSSProperties {
  return {
    height: compact ? 36 : 40,
    borderRadius: 999,
    border: dark ? "1px solid #111315" : `1px solid ${border(theme)}`,
    backgroundColor: dark ? "#111315" : theme === "dark" ? "#23262b" : "#ffffff",
    color: dark ? "#f7f8fb" : theme === "dark" ? "#f5f5f2" : "#433d35",
    padding: compact ? "0 12px" : "0 14px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };
}

export function fieldStyle(theme: ThemeMode): CSSProperties {
  return {
    borderRadius: 10,
    border: `1px solid ${border(theme)}`,
    backgroundColor: inputBg(theme),
    height: 52,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    color: pageText(theme),
    opacity: 1,
  };
}

export function circleButton(theme: ThemeMode, size = 40): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `1px solid ${border(theme)}`,
    backgroundColor: theme === "dark" ? "#23262b" : "#ffffff",
    color: theme === "dark" ? "#f5f5f2" : "#433d35",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };
}

export function pill(theme: ThemeMode): CSSProperties {
  return {
    padding: "5px 9px",
    borderRadius: 999,
    border: `1px solid ${border(theme)}`,
    backgroundColor: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.82)",
    fontSize: 11,
    fontWeight: 700,
    color: theme === "dark" ? "#eaeae8" : "#61594e",
    whiteSpace: "nowrap",
  };
}
