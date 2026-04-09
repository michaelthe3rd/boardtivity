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

export function LegalPage({ title, lastUpdated, children }: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  const isDark = theme === "dark";
  const bg = isDark ? "#0d0f12" : "#ffffff";
  const text = isDark ? "#f0f0ee" : "#1a1a18";
  const muted = isDark ? "rgba(240,240,238,.38)" : "rgba(17,19,21,.4)";
  const border = isDark ? "rgba(255,255,255,.08)" : "rgba(17,19,21,.08)";
  const navLink = isDark ? "rgba(240,240,238,.45)" : "rgba(17,19,21,.45)";

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: bg, color: text,
      // CSS variables so child elements can reference theme colors
      ["--legal-text" as string]: text,
      ["--legal-muted" as string]: muted,
      ["--legal-border" as string]: border,
      ["--legal-link" as string]: text,
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 100px", fontFamily: "'Satoshi', Arial, sans-serif", lineHeight: 1.8 }}>
        <div style={{ marginBottom: 48 }}>
          <a href="/" style={{ fontSize: 13, color: navLink, textDecoration: "none", fontWeight: 600 }}>← Back to Boardtivity</a>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8, marginTop: 0, color: text }}>{title}</h1>
        <p style={{ fontSize: 14, color: muted, marginBottom: 40, marginTop: 0 }}>Last updated: {lastUpdated}</p>

        {children}

        <div style={{ marginTop: 64, paddingTop: 24, borderTop: `1px solid ${border}`, fontSize: 13, color: muted, display: "flex", gap: 20 }}>
          <a href="/terms" style={{ color: navLink, textDecoration: "none", fontWeight: 600 }}>Terms of Service</a>
          <a href="/privacy" style={{ color: navLink, textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a>
          <a href="/" style={{ color: navLink, textDecoration: "none", fontWeight: 600 }}>Back to Boardtivity</a>
        </div>
      </div>
    </div>
  );
}
