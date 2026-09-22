"use client";

import { useState } from "react";
import type { ThemeMode } from "@/lib/board";
import { border, muted, pageBg, pageText } from "@/lib/ui";
import Modal from "@/components/ui/Modal";

type Base = { theme: ThemeMode; onClose: () => void };

export function UpgradeModal({ theme, onClose, onCheckout, checkoutLoading, checkoutError }: Base & { onCheckout: (plan: "monthly" | "annual") => void; checkoutLoading: boolean; checkoutError: string | null }) {
  return (
    <Modal theme={theme} onClose={onClose}>
      {/* Label */}
      <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 14 }}>Boardtivity Plus</div>
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), marginBottom: 8, lineHeight: 1.2 }}>
        Unlock more with Plus
      </div>
      <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.65, marginBottom: 22 }}>
        More boards, BOB AI assistant, and everything we build next.
      </div>
      {/* Feature list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
        {[
          "Up to 10 task boards",
          "Up to 5 idea boards",
          "BOB AI assistant",
          "Early access to new features",
        ].map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: pageText(theme) }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="2,7 5.5,10.5 12,3.5" stroke="#6fc46b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {f}
          </div>
        ))}
      </div>
      {/* Divider */}
      <div style={{ height: 1, backgroundColor: border(theme), marginBottom: 18 }} />
      {/* CTA */}
      {checkoutError && <div style={{ fontSize: 12, color: "#c03030", marginBottom: 10, textAlign: "center" }}>{checkoutError}</div>}
      {/* Annual */}
      <button
        onClick={() => { onClose(); onCheckout("annual"); }}
        disabled={checkoutLoading}
        style={{ width: "100%", padding: "13px 16px", borderRadius: 11, border: "none", backgroundColor: pageText(theme), color: pageBg(theme), fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.02em", marginBottom: 8, opacity: checkoutLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}
      >
        <span>{checkoutLoading ? "Loading…" : "Annual — $60 / yr"}</span>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", backgroundColor: "#6fc46b", color: "#fff", borderRadius: 99, padding: "2px 8px" }}>Save 17%</span>
      </button>
      {/* Monthly */}
      <button
        onClick={() => { onClose(); onCheckout("monthly"); }}
        disabled={checkoutLoading}
        style={{ width: "100%", padding: "13px 16px", borderRadius: 11, border: `1px solid ${border(theme)}`, background: "none", color: pageText(theme), fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.02em", marginBottom: 8, opacity: checkoutLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span>{checkoutLoading ? "Loading…" : "Monthly — $6 / mo"}</span>
        <span style={{ fontSize: 12, color: muted(theme) }}>→</span>
      </button>
      <button
        onClick={onClose}
        style={{ width: "100%", padding: "10px 0", borderRadius: 11, border: "none", background: "none", color: muted(theme), fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
      >
        Maybe later
      </button>
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: muted(theme) }}>
        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: muted(theme), textDecoration: "none" }}>Terms</a>
        <span style={{ margin: "0 6px" }}>·</span>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: muted(theme), textDecoration: "none" }}>Privacy</a>
      </div>
    </Modal>
  );
}

// Plus users who hit the board cap.
export function LimitReachedModal({ theme, onClose }: Base) {
  return (
    <Modal theme={theme} onClose={onClose} width={360} cardStyle={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={pageText(theme)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), marginBottom: 8 }}>You've hit the limit</div>
      <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.65, marginBottom: 22 }}>
        Plus accounts support up to 10 task boards and 5 idea boards. You've reached the maximum.
      </div>
      <button
        onClick={onClose}
        style={{ width: "100%", padding: "12px 0", borderRadius: 11, border: "none", backgroundColor: pageText(theme), color: pageBg(theme), fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
      >
        Got it
      </button>
    </Modal>
  );
}

// Shown after returning from Stripe checkout.
export function SubscribedModal({ theme, onClose }: Base) {
  return (
    <Modal theme={theme} onClose={onClose} strong cardStyle={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.65)" : "rgba(0,0,0,.5)", background: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "6px 16px" }}>
          Plus
        </span>
      </div>
      <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 10 }}>Now on your account</div>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-.04em", color: pageText(theme), marginBottom: 10 }}>You're all set</div>
      <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.7, marginBottom: 28 }}>
        Your subscription is active. You now have access to up to 10 task boards, 5 idea boards, BOB AI assistant, and more features to come. Thank you for your support!
      </div>
      <button
        onClick={onClose}
        style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.02em" }}
      >
        Jump back in →
      </button>
    </Modal>
  );
}

// One-time notice about the April 2026 sync overhaul.
export function WhatsNewModal({ theme, onClose }: Base) {
  return (
    <Modal theme={theme} onClose={onClose} width={420} strong cardStyle={{ textAlign: "center", padding: "36px 30px 28px", boxShadow: "0 40px 100px rgba(0,0,0,.35)" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.65)" : "rgba(0,0,0,.5)", background: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "6px 16px" }}>
          What&apos;s new
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-.04em", color: pageText(theme), marginBottom: 8, lineHeight: 1.2 }}>
        Boardtivity just got a major upgrade ✦
      </div>
      <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.75, marginBottom: 24, textAlign: "left" }}>
        <div style={{ marginBottom: 10 }}>We&apos;ve been heads down building — here&apos;s what&apos;s new:</div>
        {[
          ["Real-time sync", "your board now stays in perfect sync across all your devices, instantly"],
          ["One step closer to BOB", "our AI agent is coming, and it\u2019s going to change how you work"],
          ["Subtasks revamped", "cleaner flow for building out your tasks step by step"],
          ["Stability improvements", "a ton of under-the-hood fixes for a smoother experience"],
        ].map(([title, desc]) => (
          <div key={title} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
            <span style={{ marginTop: 2, flexShrink: 0, width: 6, height: 6, borderRadius: "50%", background: theme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)", display: "inline-block" }} />
            <span><strong style={{ color: pageText(theme) }}>{title}</strong> — {desc}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: muted(theme), lineHeight: 1.6, marginBottom: 22, padding: "12px 14px", borderRadius: 10, background: theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", border: `1px solid ${border(theme)}`, textAlign: "left" }}>
        Unfortunately, this update may have caused some tasks or ideas to not carry over. We&apos;re sorry for the disruption — everything will sync perfectly from here.
      </div>
      <button
        onClick={onClose}
        style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.02em" }}
      >
        Let&apos;s go →
      </button>
      <div style={{ marginTop: 12, fontSize: 12, color: muted(theme) }}>— The Boardtivity Team</div>
    </Modal>
  );
}

export function NamePromptModal({ theme, initialFirst = "", initialLast = "", onSave, onDismiss }: { theme: ThemeMode; initialFirst?: string; initialLast?: string; onSave: (first: string, last: string) => Promise<void>; onDismiss: () => void }) {
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [saving, setSaving] = useState(false);
  return (
    <Modal theme={theme} width={380}>
      <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 12 }}>Quick setup</div>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), marginBottom: 8 }}>What's your name?</div>
      <div style={{ fontSize: 14, color: muted(theme), lineHeight: 1.6, marginBottom: 22 }}>Add your name so we can personalize your experience.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {[
          { placeholder: "First name", value: first, setter: setFirst },
          { placeholder: "Last name (optional)", value: last, setter: setLast },
        ].map(({ placeholder, value, setter }) => (
          <input
            key={placeholder}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={e => setter(e.target.value)}
            style={{ width: "100%", height: 42, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "rgba(255,255,255,.05)" : "#fff", color: pageText(theme), fontSize: 14, padding: "0 14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        ))}
      </div>
      <button
        disabled={!first.trim() || saving}
        onClick={async () => {
          if (!first.trim()) return;
          setSaving(true);
          try {
            await onSave(first.trim(), last.trim());
            onDismiss();
          } catch {}
          setSaving(false);
        }}
        style={{ width: "100%", padding: "13px 0", borderRadius: 11, border: "none", backgroundColor: pageText(theme), color: pageBg(theme), fontSize: 14, fontWeight: 800, cursor: first.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", marginBottom: 8, opacity: !first.trim() || saving ? 0.5 : 1 }}
      >
        {saving ? "Saving…" : "Save name"}
      </button>
      <button
        onClick={onDismiss}
        style={{ width: "100%", padding: "10px 0", borderRadius: 11, border: "none", background: "none", color: muted(theme), fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
      >
        Skip for now
      </button>
    </Modal>
  );
}
