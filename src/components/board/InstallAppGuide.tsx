"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ThemeMode } from "@/lib/board";
import { pageText, muted, border } from "@/lib/ui";
import { MoreVerticalIcon, PlusSquareIcon, ShareIcon } from "@/components/ui/Icons";

// Chrome/Edge/Android fire this before offering their own install prompt; we keep it so our button can trigger it.
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so also check for touch.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const STEPS: Record<Platform, { label: string; steps: { icon: ReactNode; text: ReactNode }[] }> = {
  ios: {
    label: "iPhone & iPad",
    steps: [
      { icon: <ShareIcon size={15} />, text: <>Open boardtivity.com in <b>Safari</b> and tap the <b>Share</b> button</> },
      { icon: <PlusSquareIcon size={15} />, text: <>Scroll down and tap <b>Add to Home Screen</b></> },
      { icon: <span style={{ fontWeight: 800, fontSize: 12 }}>3</span>, text: <>Tap <b>Add</b>. Boardtivity opens full screen from its icon, like any app</> },
    ],
  },
  android: {
    label: "Android",
    steps: [
      { icon: <MoreVerticalIcon size={15} />, text: <>Open boardtivity.com in <b>Chrome</b> and tap the <b>menu</b> (three dots)</> },
      { icon: <PlusSquareIcon size={15} />, text: <>Tap <b>Add to Home screen</b> or <b>Install app</b></> },
      { icon: <span style={{ fontWeight: 800, fontSize: 12 }}>3</span>, text: <>Confirm, then open Boardtivity from your home screen</> },
    ],
  },
  desktop: {
    label: "Computer",
    steps: [
      { icon: <PlusSquareIcon size={15} />, text: <>In <b>Chrome</b> or <b>Edge</b>, click the install icon at the right end of the address bar</> },
      { icon: <ShareIcon size={15} />, text: <>In <b>Safari</b> on Mac, choose <b>File → Add to Dock</b></> },
    ],
  },
};

export default function InstallAppGuide({ theme, mobile = false }: { theme: ThemeMode; mobile?: boolean }) {
  const [platform, setPlatform] = useState<Platform>("ios");
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => { e.preventDefault(); setPromptEvent(e as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const dark = theme === "dark";
  const chip = (active: boolean) => ({
    flex: 1, height: mobile ? 34 : 30, borderRadius: 8, fontSize: mobile ? 13 : 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${active ? (dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.2)") : border(theme)}`,
    background: active ? (dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)") : "transparent",
    color: active ? pageText(theme) : muted(theme),
  });

  if (installed) {
    return <p style={{ margin: 0, fontSize: mobile ? 13 : 12, color: muted(theme), lineHeight: 1.5 }}>You&apos;re using the Boardtivity app. Open it any time from your home screen.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: mobile ? 13 : 12, color: muted(theme), lineHeight: 1.5 }}>
        Add Boardtivity to your home screen and it opens like an app: full screen, no browser bar, one tap away.
      </p>

      {promptEvent && (
        <button
          onClick={async () => { await promptEvent.prompt(); const { outcome } = await promptEvent.userChoice; if (outcome === "accepted") setInstalled(true); setPromptEvent(null); }}
          style={{ height: mobile ? 46 : 40, borderRadius: mobile ? 12 : 10, border: "none", background: pageText(theme), color: dark ? "#111" : "#fff", fontSize: mobile ? 15 : 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          Install Boardtivity
        </button>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        {(Object.keys(STEPS) as Platform[]).map((p) => (
          <button key={p} type="button" onClick={() => setPlatform(p)} style={chip(platform === p)}>{STEPS[p].label}</button>
        ))}
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {STEPS[platform].steps.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${border(theme)}`, color: pageText(theme) }}>{s.icon}</span>
            <span style={{ fontSize: mobile ? 13.5 : 12.5, color: pageText(theme), lineHeight: 1.45, paddingTop: 4 }}>{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
