"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getTheme(): Theme {
  try {
    const s = localStorage.getItem("boardtivity");
    if (s) {
      const d = JSON.parse(s) as { theme?: string };
      if (d.theme === "dark") return "dark";
    }
  } catch {}
  return "light";
}

const themes = {
  light: {
    bg: "#ffffff",
    text: "#1a1a18",
    muted: "rgba(17,19,21,.4)",
    border: "rgba(17,19,21,.08)",
    link: "#111315",
    navLink: "rgba(17,19,21,.45)",
    h2: "#111315",
    h3: "#111315",
  },
  dark: {
    bg: "#0d0f12",
    text: "#f0f0ee",
    muted: "rgba(240,240,238,.38)",
    border: "rgba(255,255,255,.08)",
    link: "#f0f0ee",
    navLink: "rgba(240,240,238,.45)",
    h2: "#f0f0ee",
    h3: "#f0f0ee",
  },
};

export function LegalPage({ title, lastUpdated, children }: {
  title: string;
  lastUpdated: string;
  children: (t: typeof themes.light) => React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  const t = themes[theme];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: t.bg, color: t.text, transition: "background-color .2s, color .2s" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 100px", fontFamily: "'Satoshi', Arial, sans-serif", lineHeight: 1.8 }}>
        <div style={{ marginBottom: 48 }}>
          <a href="/" style={{ fontSize: 13, color: t.navLink, textDecoration: "none", fontWeight: 600 }}>← Back to Boardtivity</a>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8, marginTop: 0, color: t.text }}>{title}</h1>
        <p style={{ fontSize: 14, color: t.muted, marginBottom: 40, marginTop: 0 }}>Last updated: {lastUpdated}</p>

        {children(t)}

        <div style={{ marginTop: 64, paddingTop: 24, borderTop: `1px solid ${t.border}`, fontSize: 13, color: t.muted, display: "flex", gap: 20 }}>
          <a href="/terms" style={{ color: t.navLink, textDecoration: "none", fontWeight: 600 }}>Terms of Service</a>
          <a href="/privacy" style={{ color: t.navLink, textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a>
          <a href="/" style={{ color: t.navLink, textDecoration: "none", fontWeight: 600 }}>Back to Boardtivity</a>
        </div>
      </div>
    </div>
  );
}
