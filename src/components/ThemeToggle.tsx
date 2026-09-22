"use client";

import { useState } from "react";
import type { ThemeMode } from "@/lib/board";
import { border, circleButton } from "@/lib/ui";

export default function ThemeToggle({ theme, onToggle, size = 40 }: { theme: ThemeMode; onToggle: () => void; size?: number }) {
  const [flicker, setFlicker] = useState(false);
  function handleClick() {
    setFlicker(true);
    onToggle();
  }
  const isOn = theme === "light";
  return (
    <button
      onClick={handleClick}
      onAnimationEnd={() => setFlicker(false)}
      aria-label="Toggle theme"
      style={{
        ...circleButton(theme, size),
        boxShadow: isOn ? `0 0 0 1px ${border(theme)}, 0 0 10px rgba(255,200,40,.35)` : undefined,
      }}
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        className={flicker ? "bulb-flicker" : undefined}
      >
        {/* bulb globe */}
        <path d="M12 2C8.686 2 6 4.686 6 8c0 2.21 1.13 4.16 2.85 5.28V15a1 1 0 0 0 1 1h4.3a1 1 0 0 0 1-1v-1.72C16.87 12.16 18 10.21 18 8c0-3.314-2.686-6-6-6Z"
          fill={isOn ? "rgba(255,210,60,.95)" : "currentColor"}
          stroke={isOn ? "rgba(200,155,20,.7)" : "currentColor"}
          strokeWidth={isOn ? "0" : "0.5"}
          opacity={isOn ? 1 : 0.55}
        />
        {/* base bands */}
        <line x1="9.5" y1="17" x2="14.5" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={isOn ? 0.8 : 0.5}/>
        <line x1="10" y1="19" x2="14" y2="19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={isOn ? 0.8 : 0.5}/>
        <line x1="10.5" y1="21" x2="13.5" y2="21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={isOn ? 0.6 : 0.35}/>
        {/* glow rays — only when on */}
        {isOn && [[-5,-5],[5,-5],[0,-7],[-7,0],[7,0]].map(([dx,dy],i) => (
          <line key={i}
            x1={12+dx*0.55} y1={8+dy*0.55}
            x2={12+dx} y2={8+dy}
            stroke="rgba(255,220,60,.7)" strokeWidth="1.3" strokeLinecap="round"
          />
        ))}
      </svg>
    </button>
  );
}
