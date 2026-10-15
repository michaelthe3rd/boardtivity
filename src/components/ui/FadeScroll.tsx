"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// A horizontal row that scrolls when its items don't fit, fading out softly on whichever side
// has more to scroll to (instead of cutting off with a hard edge).
export default function FadeScroll({ children, style, gap = 6 }: { children: ReactNode; style?: CSSProperties; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  const fade = 18;
  const mask = edges.left || edges.right
    ? `linear-gradient(90deg, ${edges.left ? "transparent" : "#000"} 0, #000 ${edges.left ? fade : 0}px, #000 calc(100% - ${edges.right ? fade : 0}px), ${edges.right ? "transparent" : "#000"} 100%)`
    : undefined;

  return (
    <div
      ref={ref}
      // Vertical padding (cancelled by negative margin) so glows and shadows on the items aren't clipped by the scroll box.
      style={{ display: "flex", alignItems: "center", gap, minWidth: 0, padding: "12px 0", margin: "-12px 0", overflowX: "auto", scrollbarWidth: "none", WebkitMaskImage: mask, maskImage: mask, ...style }}
    >
      {children}
    </div>
  );
}
