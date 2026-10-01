"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useHome } from "@/components/home/HomeContext";

// Single home for every pop-up (dialogs, focus screens, panels, toasts that cover the page).
// In fullscreen the browser only paints the fullscreen element's subtree, so overlays are
// portaled into it; otherwise they go to <body>. Render overlays here instead of placing
// them inside or outside #board-shell by hand.
export default function OverlayLayer({ children }: { children: ReactNode }) {
  const { isFullscreen } = useHome(); // re-renders when fullscreen toggles
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const target = (isFullscreen && document.fullscreenElement) || document.body;
  return createPortal(children, target);
}
