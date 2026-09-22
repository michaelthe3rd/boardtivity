"use client";

import type { ThemeMode } from "@/lib/board";
import { pageText, muted, border, panel, buttonStyle } from "@/lib/ui";
import { useRevealOnScroll } from "@/lib/hooks";
import { hexToRgba } from "@/lib/colors";
import BoardtivityLogo from "@/components/BoardtivityLogo";

// Signed-out landing content below the demo board: focus mode showcase, features, pricing.
export default function MarketingSections({ theme, isMobile, isSignedIn, isPlus, checkoutLoading, onSignUp, onCheckout }: {
  theme: ThemeMode;
  isMobile: boolean;
  isSignedIn: boolean | undefined;
  isPlus: boolean;
  checkoutLoading: boolean;
  onSignUp: () => void;
  onCheckout: (plan: "monthly" | "annual") => void;
}) {
  const [whyRef, whyVisible] = useRevealOnScroll();
  const [featuresRef, featuresVisible] = useRevealOnScroll();
  const [pricingRef, pricingVisible] = useRevealOnScroll();

  return (
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "60px 20px 80px" : "100px 24px 140px" }}>

        {/* Section label */}
        <div style={{ textAlign: "center", marginBottom: 96 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <BoardtivityLogo size={80} dark={theme === "dark"} />
          </div>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 16, opacity: .5 }}>Built for how you think</div>
          <h2 style={{ margin: 0, fontSize: "clamp(22px,2.8vw,38px)", fontWeight: 900, letterSpacing: "-.05em", color: pageText(theme), lineHeight: 1.06 }}>Your Board, the Way You Need It.</h2>
        </div>

        {/* ── Focus Mode — full-width immersive ── */}
        <div ref={whyRef} style={{ marginBottom: 100, opacity: whyVisible ? 1 : 0, transform: whyVisible ? "none" : "translateY(24px)", transition: "opacity .7s ease, transform .7s ease" }}>
          <div style={{ maxWidth: 860, margin: "0 auto", borderRadius: 24, overflow: "hidden", backgroundColor: "#060708", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent)", pointerEvents: "none" }}/>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", minHeight: isMobile ? "auto" : 400 }}>
              {/* Left: active focus session replica matching real UI */}
              <div style={{ padding: isMobile ? "52px 24px 40px" : "56px 48px 52px", borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,.05)", borderBottom: isMobile ? "1px solid rgba(255,255,255,.05)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  {/* Step counter */}
                  <div style={{ fontSize: 13, letterSpacing: ".16em", color: "rgba(247,248,251,.45)", fontWeight: 600 }}>2 / 3</div>
                  {/* Current step name */}
                  <div style={{ marginTop: 12, fontSize: 19, fontWeight: 600, color: "rgba(247,248,251,.75)", letterSpacing: "-.01em", lineHeight: 1.35, maxWidth: 260 }}>
                    Practice problems
                  </div>
                  {/* Big countdown — matches real 96px timer */}
                  <div style={{ marginTop: 28, fontSize: isMobile ? 72 : 88, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1, color: "#f7f8fb" }}>
                    24:00
                  </div>
                  {/* Single continuous progress bar — white fill, matches real UI */}
                  <div style={{ marginTop: 36, width: "100%", height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,.10)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "38%", borderRadius: 999, backgroundColor: "rgba(247,248,251,.88)" }}/>
                  </div>
                  {/* Buttons — matches real active session: 5 min break + Exit */}
                  <div style={{ marginTop: 32, display: "flex", gap: 10 }}>
                    <div style={{ height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", backgroundColor: "rgba(255,255,255,.08)", color: "rgba(247,248,251,.75)", padding: "0 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>5 min break</div>
                    <div style={{ height: 38, borderRadius: 999, border: "1px solid rgba(220,60,60,.25)", backgroundColor: "rgba(220,60,60,.10)", color: "rgba(255,160,160,.7)", padding: "0 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>Exit</div>
                  </div>
                  {/* Stats card — streak + hours preview */}
                  <div style={{ marginTop: 24, width: "100%", backgroundColor: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#f7f8fb", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          <svg width="9" height="13" viewBox="0 0 11 15" fill="none"><path d="M7 1L1 8.5h4L3.5 14 10 6H6L7 1Z" fill="#facc15"/></svg>
                          5
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(247,248,251,.35)", marginTop: 3 }}>day streak</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#f7f8fb" }}>14h</div>
                        <div style={{ fontSize: 10, color: "rgba(247,248,251,.35)", marginTop: 3 }}>total focused</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#f7f8fb" }}>23</div>
                        <div style={{ fontSize: 10, color: "rgba(247,248,251,.35)", marginTop: 3 }}>tasks done</div>
                      </div>
                    </div>
                    {/* Mini bar chart — last 7 days */}
                    <div style={{ marginTop: 14, display: "flex", gap: 4, alignItems: "flex-end", height: 36 }}>
                      {[0.3, 0.6, 0.45, 1, 0.7, 0.55, 0.8].map((h, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
                          <div style={{ width: "100%", borderRadius: 3, backgroundColor: i === 6 ? "#6fc46b" : "rgba(255,255,255,.28)", height: `${h * 28}px` }}/>
                          <div style={{ fontSize: 8, color: "rgba(247,248,251,.25)" }}>{["S","M","T","W","T","F","S"][i]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Right: copy */}
              <div style={{ padding: isMobile ? "32px 24px 44px" : "56px 48px 52px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h3 style={{ margin: "0 0 18px", fontSize: "clamp(22px,2.2vw,32px)", fontWeight: 800, letterSpacing: "-.04em", color: "#f7f8fb", lineHeight: 1.08 }}>Lock in.<br/>Build the streak.</h3>
                <p style={{ margin: "0 0 36px", fontSize: 15, color: "rgba(255,255,255,.42)", lineHeight: 1.9 }}>
                  Commit to a session and go. Boardtivity counts down, chains through your subtasks, and logs every minute — so your streak and stats grow automatically.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {["Commit to a dedicated session — your call on how long", "Auto-chain through subtasks without losing focus", "Streak and total hours tracked across every session", "Session review screen after every finish"].map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "rgba(255,255,255,.55)" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "rgba(255,255,255,.22)", flexShrink: 0 }}/>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Features — 4-col editorial ── */}
        <div ref={featuresRef}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 28 : 0, marginBottom: 88, opacity: featuresVisible ? 1 : 0, transform: featuresVisible ? "none" : "translateY(20px)", transition: "opacity .6s ease, transform .6s ease" }}>
            {([
              {
                label: "Visual Boards",
                heading: "Everything on\nyour board.",
                body: "Drag tasks anywhere on your board. Arrange by project, urgency, or however your mind works — no rigid columns.",
              },
              {
                label: "Taskweb & Taskchain",
                heading: "Break any task\ninto steps.",
                body: "Expand tasks into a subtask web you can see at once, or a sequential chain you step through one at a time.",
              },
              {
                label: "Focus Sessions",
                heading: "Timed sessions,\nyour way.",
                body: "Pick 15m, 25m, 45m, 1hr, or a custom duration. Boardtivity counts down and auto-chains through subtasks.",
              },
              {
                label: "Streaks & Stats",
                heading: "Track your\nmomentum.",
                body: "Every session logs time and builds your streak. See total hours focused, tasks completed, and daily activity.",
              },
            ] as const).map((f, i) => (
              <div key={i} style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 28, paddingRight: isMobile ? 0 : (i < 3 ? 40 : 0), paddingBottom: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 20, opacity: .5 }}>{f.label}</div>
                <h3 style={{ margin: "0 0 16px", fontSize: 19, fontWeight: 800, letterSpacing: "-.03em", color: pageText(theme), lineHeight: 1.22 }}>{f.heading.split("\n").map((line, j) => <span key={j}>{line}{j === 0 ? <br/> : null}</span>)}</h3>
                <p style={{ margin: 0, fontSize: 14, color: muted(theme), lineHeight: 1.85, opacity: .68 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pricing ── */}
        <div ref={pricingRef} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, maxWidth: 720, margin: "0 auto" }}>
          {/* Free */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: "36px 28px", display: "flex", flexDirection: "column", opacity: pricingVisible ? 1 : 0, transform: pricingVisible ? "none" : "translateY(28px)", transition: "opacity .65s ease 0s, transform .65s ease 0s" }}>
            <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 16 }}>Free</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em", color: pageText(theme), marginBottom: 14 }}>Free forever</div>
            <div style={{ fontSize: 13, color: muted(theme), marginBottom: 18, lineHeight: 1.75, flexGrow: 1 }}>Full access to every feature — boards, tasks, subtasks, focus sessions, and idea notes. No credit card needed.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["1 board per type", "1 idea per board", "Focus sessions & streak tracking", "Taskweb & Taskchain"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: pageText(theme) }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: hexToRgba("#6fc46b", .15), border: "1px solid rgba(111,196,107,.35)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="#6fc46b" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => !isSignedIn && onSignUp()} style={{ ...buttonStyle(theme, false), width: "100%", fontSize: 14, height: 42, cursor: isSignedIn ? "default" : "pointer", opacity: isSignedIn ? .5 : 1 }}>{isSignedIn ? "Signed in" : "Get started free"}</button>
          </div>
          {/* Plus */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${theme === "dark" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"}`, backgroundColor: theme === "dark" ? "#0d0f12" : "#111315", padding: "36px 28px", display: "flex", flexDirection: "column", opacity: pricingVisible ? 1 : 0, transform: pricingVisible ? "none" : "translateY(28px)", transition: "opacity .65s ease .1s, transform .65s ease .1s" }}>
            <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent)", pointerEvents: "none" }}/>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,.45)" }}>Plus</div>
              <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: "rgba(255,255,255,.38)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "3px 8px" }}>Most popular</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em", color: "#f7f8fb" }}>$6</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,.45)", marginLeft: 4 }}>/ mo</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.35)", marginLeft: 10 }}>or $60 / yr</span>
              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", backgroundColor: "#6fc46b", color: "#fff", borderRadius: 99, padding: "2px 7px" }}>Save 17%</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,.42)", marginBottom: 18, flexGrow: 1 }}>More boards, BOB AI assistant, and everything we build next.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["Up to 10 task boards", "Up to 5 idea boards", "BOB AI assistant", "Early access to new features"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,.72)" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="rgba(255,255,255,.7)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            {isPlus ? (
              <button disabled style={{ width: "100%", height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", backgroundColor: "transparent", color: "rgba(255,255,255,.55)", fontSize: 14, fontWeight: 700, cursor: "default" }}>✓ Current plan</button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => onCheckout("annual")} disabled={checkoutLoading} style={{ width: "100%", height: 42, borderRadius: 999, border: "none", backgroundColor: "#f7f8fb", color: "#111315", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: checkoutLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {checkoutLoading ? "Loading…" : <><span>Get Plus — $60 / yr</span><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", backgroundColor: "#6fc46b", color: "#fff", borderRadius: 99, padding: "2px 7px" }}>Save 17%</span></>}
                </button>
                <button onClick={() => onCheckout("monthly")} disabled={checkoutLoading} style={{ width: "100%", height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,.2)", backgroundColor: "transparent", color: "rgba(255,255,255,.7)", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: checkoutLoading ? 0.6 : 1 }}>
                  {checkoutLoading ? "Loading…" : "Get Plus — $6 / mo"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
  );
}
