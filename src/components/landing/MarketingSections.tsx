"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeMode } from "@/lib/board";
import { pageText, muted, border, panel, pill, buttonStyle } from "@/lib/ui";
import { useRevealOnScroll, useIsMobile } from "@/lib/hooks";
import { hexToRgba } from "@/lib/colors";
import BoardtivityLogo from "@/components/BoardtivityLogo";
import { CheckIcon } from "@/components/ui/Icons";

// Landing content below the board. Signed out: focus showcase, features, pricing.
// Signed in: only the upgrade (pricing) section, and nothing for Plus members, so the board stays the focus.
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
  // Card + copy rows go single-column below 900px; side by side they squeeze the copy.
  const stacked = useIsMobile(900);

  if (isSignedIn && isPlus) return null;

  return (
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: isSignedIn ? (isMobile ? "32px 20px 48px" : "56px 24px 72px") : (isMobile ? "60px 20px 80px" : "100px 24px 140px") }}>

        {!isSignedIn && <>
        {/* Section label */}
        <div style={{ textAlign: "center", marginBottom: 96 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <BoardtivityLogo size={80} dark={theme === "dark"} />
          </div>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 16, opacity: .5 }}>What you can do</div>
          <h2 style={{ margin: 0, fontSize: "clamp(22px,2.8vw,38px)", fontWeight: 900, letterSpacing: "-.05em", color: pageText(theme), lineHeight: 1.06 }}>Everything you need, on one board.</h2>
        </div>

        {/* ── Focus Mode — copy beside a tilted focus-screen card, mirroring the Taskchain below ── */}
        <div ref={whyRef} style={{ marginBottom: isMobile ? 48 : 72, opacity: whyVisible ? 1 : 0, transform: whyVisible ? "none" : "translateY(24px)", transition: "opacity .7s ease, transform .7s ease" }}>
          <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: stacked ? "1fr" : "1fr 340px", gap: stacked ? 32 : 64, alignItems: "center" }}>
              {/* The focus screen as a tilted card (right on desktop, on top on phones) */}
              <div style={{ order: stacked ? 0 : 1, width: "100%", maxWidth: isMobile ? 320 : stacked ? 400 : 340, justifySelf: "center", boxSizing: "border-box", padding: isMobile ? "22px 16px 18px" : "36px 26px 28px", borderRadius: 16, backgroundColor: "#060708", border: "1.5px solid rgba(255,255,255,.08)", transform: isMobile ? "none" : "rotate(1.5deg)", boxShadow: `0 0 0 3px ${theme === "dark" ? "rgba(140,140,140,.12)" : "rgba(0,0,0,.05)"}, 0 18px 36px rgba(0,0,0,${theme === "dark" ? .3 : .12})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  {/* Task + step counter */}
                  <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(247,248,251,.45)", fontWeight: 700 }}>Study for exam · 2 / 3</div>
                  {/* Current step name */}
                  <div style={{ marginTop: isMobile ? 8 : 12, fontSize: isMobile ? 16 : 19, fontWeight: 600, color: "rgba(247,248,251,.75)", letterSpacing: "-.01em", lineHeight: 1.35, maxWidth: 260 }}>
                    Practice problems
                  </div>
                  {/* Big countdown — matches real 96px timer */}
                  <div style={{ marginTop: isMobile ? 18 : 24, fontSize: isMobile ? 48 : 80, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1, color: "#f7f8fb" }}>
                    24:00
                  </div>
                  {/* Single continuous progress bar — white fill, matches real UI */}
                  <div style={{ marginTop: isMobile ? 24 : 30, width: "100%", height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,.10)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "38%", borderRadius: 999, backgroundColor: "rgba(247,248,251,.88)" }}/>
                  </div>
                  {/* Buttons — matches real active session: 5 min break + Exit */}
                  <div style={{ marginTop: isMobile ? 20 : 26, display: "flex", gap: 10 }}>
                    <div style={{ height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", backgroundColor: "rgba(255,255,255,.08)", color: "rgba(247,248,251,.75)", padding: "0 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>5 min break</div>
                    <div style={{ height: 38, borderRadius: 999, border: "1px solid rgba(220,60,60,.25)", backgroundColor: "rgba(220,60,60,.10)", color: "rgba(255,160,160,.7)", padding: "0 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>Exit</div>
                  </div>
                  {/* Stats card — streak + hours preview */}
                  <div style={{ marginTop: isMobile ? 18 : 22, width: "100%", boxSizing: "border-box", backgroundColor: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px" }}>
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
                    {/* Mini bar chart — last 7 days (hidden on phones to save height) */}
                    {!isMobile && <div style={{ marginTop: 14, display: "flex", gap: 4, alignItems: "flex-end", height: 36 }}>
                      {[0.3, 0.6, 0.45, 1, 0.7, 0.55, 0.8].map((h, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
                          <div style={{ width: "100%", borderRadius: 3, backgroundColor: i === 6 ? "#6fc46b" : "rgba(255,255,255,.28)", height: `${h * 28}px` }}/>
                          <div style={{ fontSize: 8, color: "rgba(247,248,251,.25)" }}>{["S","M","T","W","T","F","S"][i]}</div>
                        </div>
                      ))}
                    </div>}
                  </div>
                </div>
              </div>
              {/* Left: copy */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h3 style={{ margin: "0 0 18px", fontSize: "clamp(22px,2.2vw,32px)", fontWeight: 800, letterSpacing: "-.04em", color: pageText(theme), lineHeight: 1.08 }}>Focus with a timer.<br/>Keep your streak going.</h3>
                <p style={{ margin: isMobile ? "0 0 18px" : "0 0 28px", fontSize: isMobile ? 14 : 15, color: muted(theme), opacity: .7, lineHeight: isMobile ? 1.65 : 1.8 }}>
                  Pick a task and start the timer. When you finish one step, Boardtivity moves you to the next. Every minute you focus is saved, so you can see your progress.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 12 }}>
                  {["Choose 15 min, 30 min, 1 hour, 2 hours, or your own time", "Moves you to the next step for you", "See your streak and total focus time", "See what you finished after each session"].map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 12, fontSize: isMobile ? 13 : 14, color: pageText(theme), opacity: .85 }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", border: "1px solid #3d8b40", backgroundColor: "#6fc46b" }}>
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5.2l2 2 4-4.4" stroke="#0e2e18" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
          </div>
        </div>

        {/* ── Features, as a Taskchain ── */}
        <div ref={featuresRef} style={{ marginBottom: isMobile ? 72 : 120, opacity: featuresVisible ? 1 : 0, transform: featuresVisible ? "none" : "translateY(20px)", transition: "opacity .6s ease, transform .6s ease" }}>
          <FeatureChain theme={theme} isMobile={isMobile} stacked={stacked} />
        </div>

        </>}

        {/* ── Pricing ── */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 12, opacity: .5 }}>{isSignedIn ? "Boardtivity Plus" : "Pricing"}</div>
          <h2 style={{ margin: 0, fontSize: "clamp(22px,2.4vw,32px)", fontWeight: 900, letterSpacing: "-.045em", color: pageText(theme), lineHeight: 1.1 }}>{isSignedIn ? "Need more room? Upgrade to Plus." : "Free to start. Plus when you need more."}</h2>
        </div>
        <div ref={pricingRef} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, maxWidth: 720, margin: "0 auto" }}>
          {/* Free */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${border(theme)}`, backgroundColor: panel(theme), padding: "36px 28px", display: "flex", flexDirection: "column", opacity: pricingVisible ? 1 : 0, transform: pricingVisible ? "none" : "translateY(28px)", transition: "opacity .65s ease 0s, transform .65s ease 0s" }}>
            <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: muted(theme), marginBottom: 16 }}>Free</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.035em", color: pageText(theme), marginBottom: 14 }}>Free forever</div>
            <div style={{ fontSize: 13, color: muted(theme), marginBottom: 18, lineHeight: 1.75, flexGrow: 1 }}>Plan your tasks, save ideas, and focus with a timer. No credit card needed.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["1 task board and 1 idea board", "Split tasks into steps", "Focus timer and streaks", "Due dates and email reminders", "Works on all your devices"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: pageText(theme) }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: hexToRgba("#6fc46b", .15), border: "1px solid rgba(111,196,107,.35)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="#6fc46b" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => !isSignedIn && onSignUp()} style={{ ...buttonStyle(theme, false), width: "100%", fontSize: 14, height: 42, cursor: isSignedIn ? "default" : "pointer", opacity: isSignedIn ? .5 : 1 }}>{isSignedIn ? "Current plan" : "Get started free"}</button>
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
            <div style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,.42)", marginBottom: 18, flexGrow: 1 }}>Everything in Free, plus more boards, the BOB AI helper, and new features first.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
              {["Up to 10 task boards", "Up to 5 idea boards", "BOB AI helper", "Get new features first"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,.72)" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,5.5 4.2,7.5 8,3" stroke="rgba(255,255,255,.7)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {f}
                </div>
              ))}
            </div>
            {isPlus ? (
              <button disabled style={{ width: "100%", height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", backgroundColor: "transparent", color: "rgba(255,255,255,.55)", fontSize: 14, fontWeight: 700, cursor: "default", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><CheckIcon size={15} strokeWidth={2.4} />Current plan</button>
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

type Feature = { heading: string; body: string };

const FEATURES: Feature[] = [
  { heading: "Put tasks anywhere", body: "Move tasks around your board however you like. Lock a task so it stays in place. Add grid lines, or go full screen." },
  { heading: "Split big tasks into steps", body: "Break a task into smaller steps with Taskweb and Taskchain. See all the steps at once, or do them one at a time." },
  { heading: "Save your ideas", body: "Keep ideas on their own board, away from your tasks. Connect ideas that go together." },
  { heading: "Don't miss a deadline", body: "Add a due date and time to a task. We'll email you a reminder before it's due." },
  { heading: "Works on every device", body: "Sign in and your board stays in sync on your computer, phone, and tablet. Changes save as you go." },
  { heading: "Get help from BOB", body: "Tell BOB, your AI helper, what you need to do. BOB adds the tasks, splits them into steps, and sets up your board." },
];

// The features drawn as a Taskchain: one task on the left, its six steps on the right.
// Steps check off (in the board's real "done" green) as they scroll past the middle of the screen,
// and the task's step dots fill to match.
function FeatureChain({ theme, isMobile, stacked }: { theme: ThemeMode; isMobile: boolean; stacked: boolean }) {
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.62;
      setDoneCount(stepRefs.current.filter((el) => el && el.getBoundingClientRect().top < line).length);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  const dark = theme === "dark";
  const doneBg = dark ? "#0e2e18" : "#e6f9ee";
  const doneBorder = dark ? "rgba(60,180,90,.30)" : "rgba(60,180,90,.45)";
  const dot = (done: boolean, size: number) => ({
    width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "inline-block",
    border: done ? "1px solid #3d8b40" : `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"}`,
    backgroundColor: done ? "#6fc46b" : dark ? "rgba(255,255,255,.12)" : "#f1f1ef",
    transition: "background-color .3s ease, border-color .3s ease",
  });
  const allDone = doneCount === FEATURES.length;

  const taskCard = (
    <div style={stacked ? { maxWidth: 400 } : { position: "sticky", top: 120 }}>
      <div style={{
        padding: isMobile ? "12px 16px 14px" : "16px 20px 18px", borderRadius: 16, transform: isMobile ? "none" : "rotate(-1.5deg)",
        backgroundColor: allDone ? doneBg : panel(theme),
        border: `1.5px solid ${allDone ? doneBorder : border(theme)}`,
        boxShadow: `0 0 0 3px ${allDone ? "rgba(60,180,90,.2)" : dark ? "rgba(140,140,140,.12)" : "rgba(0,0,0,.05)"}, 0 18px 36px rgba(0,0,0,${dark ? .3 : .07})`,
        transition: "background-color .4s ease, border-color .4s ease, box-shadow .4s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={pill(theme)}>Boardtivity</div>
          {allDone && <div style={{ ...pill(theme), fontWeight: 800, color: dark ? "rgba(100,220,120,.9)" : "rgba(30,120,60,.85)", border: "1px solid rgba(60,180,90,.3)", backgroundColor: "rgba(60,180,90,.1)" }}>Completed</div>}
        </div>
        <div style={{ margin: isMobile ? "16px 0 16px" : "30px 0 30px", fontSize: isMobile ? 26 : 38, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-.035em", color: pageText(theme) }}>Simple.<br/>Organized.<br/>Focused.</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 7 }}>{FEATURES.map((_, i) => <span key={i} style={dot(i < doneCount, 10)}/>)}</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: muted(theme), fontVariantNumeric: "tabular-nums" }}>{doneCount} / {FEATURES.length} features</span>
        </div>
      </div>
      <p style={{ margin: isMobile ? "14px 2px 0" : "22px 4px 0", fontSize: isMobile ? 13 : 14, lineHeight: 1.7, color: muted(theme), opacity: .6, maxWidth: stacked ? 420 : 280 }}>
        In Boardtivity, big tasks split into small steps. These are ours. Scroll to check them off.
      </p>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: stacked ? "1fr" : "300px 1fr", gap: isMobile ? 20 : stacked ? 28 : 64, alignItems: "start" }}>
      {taskCard}
      <div style={{ position: "relative" }}>
        {/* The chain line, running behind the step checkboxes */}
        <div style={{ position: "absolute", left: isMobile ? 22 : 27, top: 30, bottom: 30, width: 1.5, backgroundColor: border(theme) }}/>
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 14 }}>
          {FEATURES.map((f, i) => {
            const done = i < doneCount;
            return (
              <div key={f.heading} ref={(el) => { stepRefs.current[i] = el; }} style={{
                position: "relative", display: "flex", gap: isMobile ? 12 : 16, alignItems: "flex-start", padding: isMobile ? "12px 14px 13px" : "18px 20px 18px 18px", borderRadius: 12,
                backgroundColor: panel(theme),
                border: `1.5px solid ${done ? doneBorder : border(theme)}`,
                transition: "background-color .35s ease, border-color .35s ease",
              }}>
                <span style={{ ...dot(done, 16), marginTop: isMobile ? 1 : 3, display: "grid", placeItems: "center" }}>
                  {done && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5.2l2 2 4-4.4" stroke="#0e2e18" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                <div>
                  {!isMobile && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: muted(theme), opacity: .5, marginBottom: 6 }}>Step {i + 1}</div>}
                  <h3 style={{ margin: isMobile ? "0 0 3px" : "0 0 6px", fontSize: isMobile ? 15 : 16, lineHeight: 1.3, fontWeight: 800, letterSpacing: "-.02em", color: pageText(theme), textDecoration: "none" }}>{f.heading}</h3>
                  <p style={{ margin: 0, fontSize: isMobile ? 13 : 14, lineHeight: isMobile ? 1.5 : 1.65, color: muted(theme), opacity: .7 }}>{f.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
