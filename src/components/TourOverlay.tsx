"use client";
import { useState, useEffect } from "react";

const STEPS = [
  {
    icon: (
      <svg width="59" height="48" viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="15" width="190" height="150" rx="28" ry="28" stroke="#111315" strokeWidth="9"/>
        <path d="M38 38 H58 M38 38 V58" stroke="#111315" strokeWidth="6" strokeLinecap="round"/>
        <path d="M182 38 H162 M182 38 V58" stroke="#111315" strokeWidth="6" strokeLinecap="round"/>
        <path d="M38 142 H58 M38 142 V122" stroke="#111315" strokeWidth="6" strokeLinecap="round"/>
        <path d="M182 142 H162 M182 142 V122" stroke="#111315" strokeWidth="6" strokeLinecap="round"/>
        <text x="110" y="118" fontFamily="Satoshi, Arial Black, sans-serif" fontWeight="900" fontSize="85" textAnchor="middle" fill="#111315">B</text>
      </svg>
    ),
    title: "Welcome to Boardtivity!",
    subtitle: "Let's take 30 seconds to show you everything. You can skip anytime.",
    cta: "Let's go",
  },
  {
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3" width="20" height="18" rx="3" stroke="#111315" strokeWidth="1.8"/>
        <path d="M7 8h10M7 12h6" stroke="#111315" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="17" cy="16" r="3" fill="#111315"/>
        <path d="M16 16l1 1 1.5-1.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Tasks",
    subtitle: "Create tasks, set priority (High / Medium / Low), add subtasks, and check them off. Tap + to add your first one.",
    cta: "Next",
  },
  {
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2a7 7 0 00-4 12.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26A7 7 0 0012 2z" stroke="#111315" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 21h6" stroke="#111315" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    title: "Ideas",
    subtitle: "Capture freeform notes and thoughts as sticky cards. Great for research, brainstorming, or anything that doesn't fit a task.",
    cta: "Next",
  },
  {
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2L3 14h8l-1 8L21 10h-8l1-8z" stroke="#111315" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Focus Mode",
    subtitle: "Lock in on one task at a time with a countdown timer. No distractions. Tap the lightning bolt icon to enter focus.",
    cta: "Next",
  },
  {
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="#111315" strokeWidth="1.8"/>
        <path d="M9 9a3 3 0 015.196 2c0 1.657-1.343 2.5-3.196 3v1M12 18v.5" stroke="#111315" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    title: "Bob — Your AI",
    subtitle: "Bob breaks down tasks into steps, suggests ideas, and answers questions about your board. Tap the Bob button to chat.",
    cta: "Next",
  },
  {
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 6L9 17l-5-5" stroke="#111315" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "You're all set!",
    subtitle: "That's everything. Start by adding your first task — tap the + button and get things moving.",
    cta: "Start using Boardtivity",
  },
];

export default function TourOverlay({
  isSignedIn,
  isMobile,
}: {
  isSignedIn: boolean;
  isMobile: boolean;
}) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("boardtivity_tour_v1")) {
      // Small delay so the board loads behind it first
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [isSignedIn]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function dismiss() {
    localStorage.setItem("boardtivity_tour_v1", "1");
    setVisible(false);
  }

  function next() {
    if (isLast) { dismiss(); return; }
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 140);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: isMobile ? "flex-end" : "center",
        backgroundColor: "rgba(0,0,0,0.52)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: isMobile ? "24px 24px 0 0" : "24px",
          padding: isMobile ? "32px 28px 44px" : "44px 52px",
          width: isMobile ? "100%" : "460px",
          maxWidth: "100%",
          position: "relative",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.14)",
          fontFamily: "'Satoshi', Arial, sans-serif",
          opacity: animating ? 0 : 1,
          transform: animating ? "translateY(6px)" : "translateY(0)",
          transition: "opacity 0.14s, transform 0.14s",
        }}
      >
        {/* Skip button */}
        <button
          onClick={dismiss}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            border: "none",
            background: "none",
            fontSize: 13,
            color: "#bbb",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
            padding: "4px 8px",
          }}
        >
          Skip
        </button>

        {/* Icon */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          {current.icon}
        </div>

        {/* Text */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontSize: isMobile ? 20 : 22,
              fontWeight: 800,
              color: "#111315",
              marginBottom: 10,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            {current.title}
          </div>
          <div style={{ fontSize: 15, color: "#666", lineHeight: 1.65 }}>
            {current.subtitle}
          </div>
        </div>

        {/* Progress dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 6,
            marginBottom: 24,
          }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === step ? "#111315" : "#e5e5e5",
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={next}
          style={{
            width: "100%",
            padding: "15px",
            backgroundColor: "#111315",
            color: "#fff",
            border: "none",
            borderRadius: 13,
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: "-0.01em",
          }}
        >
          {current.cta}
        </button>
      </div>
    </div>
  );
}
