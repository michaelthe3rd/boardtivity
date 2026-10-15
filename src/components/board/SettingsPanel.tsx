"use client";

import { Fragment } from "react";
import BoardtivityLogo from "@/components/BoardtivityLogo";
import { NOTE_PALETTE, TASK_PALETTE, TASK_DEFAULT_COUNT } from "@/lib/colors";
import { pageText, muted, border, panel, buttonStyle, circleButton, swatchStyle, RAINBOW } from "@/lib/ui";
import { useHome } from "@/components/home/HomeContext";
import EmailSettings from "@/components/board/EmailSettings";
import { CloseIcon } from "@/components/ui/Icons";
import { SyncCloud, syncLabel } from "@/components/ui/SyncStatus";
import InstallAppGuide from "@/components/board/InstallAppGuide";

// Slide-in board settings panel: theme, background, colors, account and data export.
export default function SettingsPanel() {
  const {
    openTutorial, activeBoard,
    boardTheme, notes, setUpgradeOpen, confirmSignOut, setConfirmSignOut, settingsOpen,
    setSettingsOpen, bobAutoSend, setBobAutoSend, boardGrid, setBoardGrid, thoughtColorMode, setThoughtColorMode, thoughtFixedColorIdx,
    setThoughtFixedColorIdx, taskColorMode, setTaskColorMode, taskHighColorIdx, setTaskHighColorIdx, taskMedColorIdx, setTaskMedColorIdx, taskLowColorIdx,
    setTaskLowColorIdx, taskSingleColorIdx, setTaskSingleColorIdx, taskSingleCustom, setTaskSingleCustom, taskHighCustom, setTaskHighCustom, taskMedCustom,
    setTaskMedCustom, taskLowCustom, setTaskLowCustom, cloudSyncState, setCloudSyncState, subscription, isPlus,
    setBobUserInfoFn, bobUserInfo, colorWheelSingleRef, colorWheelHighRef, colorWheelMedRef, colorWheelLowRef, settingsRef, startPortal,
    exportToIcs, pushToCloud, user, isSignedIn, openSignIn, openSignUp, signOut,
  } = useHome();
  // Only the colors for the board you're on: idea colors on idea boards, task colors on task boards.
  const isIdeaBoard = activeBoard?.type === "thought";
  // Tagged only while open, so the tour never spotlights the panel while it's slid off-screen.
  const colorsTour = settingsOpen ? "settings-colors" : undefined;
  return (
    <div ref={settingsRef} style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: "min(360px, 100vw)",
      zIndex: 31,
      backgroundColor: panel(boardTheme),
      borderLeft: `1px solid ${border(boardTheme)}`,
      boxShadow: settingsOpen ? (boardTheme === "dark" ? "-12px 0 40px rgba(0,0,0,.5)" : "-12px 0 40px rgba(0,0,0,.12)") : "none",
      transform: settingsOpen ? "translateX(0)" : "translateX(100%)",
      transition: "transform .22s cubic-bezier(.4,0,.2,1)",
      display: "flex", flexDirection: "column", overflowY: "auto", overscrollBehavior: "contain",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${border(boardTheme)}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BoardtivityLogo size={26} dark={boardTheme === "dark"} />
          <span style={{ fontSize: 16, fontWeight: 700, color: pageText(boardTheme) }}>Settings</span>
        </div>
        <button onClick={() => setSettingsOpen(false)} style={{ ...circleButton(boardTheme, 32), fontSize: 14 }}><CloseIcon size={14} /></button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "20px 24px", display: "grid", gap: 28, alignContent: "start" }}>

        {/* Board Background */}
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 10 }}>Board Background</div>
          <div style={{ display: "flex", gap: 6, padding: 3, backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 10, border: `1px solid ${border(boardTheme)}` }}>
            {([
              { id: "grid" as const, label: "Grid", preview: (
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  {[0,6,12,18].map(x => <line key={`v${x}`} x1={x} y1={0} x2={x} y2={14} stroke="currentColor" strokeWidth="0.8" opacity="0.6"/>)}
                  {[0,7,14].map(y => <line key={`h${y}`} x1={0} y1={y} x2={18} y2={y} stroke="currentColor" strokeWidth="0.8" opacity="0.6"/>)}
                </svg>
              )},
              { id: "dots" as const, label: "Dots", preview: (
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  {[3,9,15].flatMap(x => [3,10].map(y => <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="currentColor" opacity="0.6"/>))}
                </svg>
              )},
              { id: "blank" as const, label: "Blank", preview: (
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  <rect x="1" y="1" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="0.8" opacity="0.3"/>
                </svg>
              )},
            ]).map(({ id, label, preview }) => {
              const active = boardGrid === id;
              return (
                <button key={id} onClick={() => setBoardGrid(id)} style={{
                  flex: 1, height: 52, borderRadius: 8,
                  border: "none",
                  backgroundColor: active ? (boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#ffffff") : "transparent",
                  boxShadow: active ? (boardTheme === "dark" ? "0 1px 4px rgba(0,0,0,.3)" : "0 1px 4px rgba(0,0,0,.1)") : "none",
                  color: active ? pageText(boardTheme) : muted(boardTheme),
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: "background-color .12s, box-shadow .12s",
                }}>
                  {preview}
                  <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Idea Colors */}
        {isIdeaBoard && (
        <div data-tour={colorsTour} style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>Idea Colors</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: muted(boardTheme), lineHeight: 1.5 }}>
              Pick a color for new ideas, or use the shuffle for a random color. You can change any idea&apos;s color later with the circle in its corner.
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", padding: 6, margin: -6 }}>
              {/* Shuffle / randomize */}
              <button onClick={() => setThoughtColorMode("random")} style={swatchStyle(boardTheme, RAINBOW, thoughtColorMode === "random", 22, true)} title="Randomize color" />
              {NOTE_PALETTE.map((p, i) => (
                <button key={i} onClick={() => { setThoughtColorMode("fixed"); setThoughtFixedColorIdx(i); }} style={swatchStyle(boardTheme, p.swatch, (thoughtColorMode === "fixed" && thoughtFixedColorIdx === i), 22)} title={p.name} />
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 11, color: muted(boardTheme), lineHeight: 1.5 }}>
              {thoughtColorMode === "random" ? "New ideas will get a random color each time." : `New ideas will default to ${NOTE_PALETTE[thoughtFixedColorIdx]?.name}.`}
            </p>
          </div>
        </div>

        )}

        {/* Task Colors */}
        {!isIdeaBoard && (
        <div data-tour={colorsTour} style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>Task Colors</div>
          <div style={{ display: "grid", gap: 14 }}>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 6, padding: 3, backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 10, border: `1px solid ${border(boardTheme)}` }}>
                {(["priority", "single"] as const).map(m => (
                  <button key={m} onClick={() => setTaskColorMode(m)} style={{
                    flex: 1, height: 32, borderRadius: 8, border: "none",
                    backgroundColor: taskColorMode === m ? (boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#ffffff") : "transparent",
                    boxShadow: taskColorMode === m ? (boardTheme === "dark" ? "0 1px 4px rgba(0,0,0,.3)" : "0 1px 4px rgba(0,0,0,.1)") : "none",
                    color: taskColorMode === m ? pageText(boardTheme) : muted(boardTheme),
                    fontSize: 13, fontWeight: taskColorMode === m ? 700 : 500, cursor: "pointer",
                    transition: "background-color .12s, box-shadow .12s",
                  }}>
                    {m === "priority" ? "By Priority" : "One Color"}
                  </button>
                ))}
              </div>

              {taskColorMode === "priority" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {(["High", "Medium", "Low"] as const).map((lvl) => {
                    const currentIdx = lvl === "High" ? taskHighColorIdx : lvl === "Medium" ? taskMedColorIdx : taskLowColorIdx;
                    const setter = lvl === "High" ? setTaskHighColorIdx : lvl === "Medium" ? setTaskMedColorIdx : setTaskLowColorIdx;
                    const customVal = lvl === "High" ? taskHighCustom : lvl === "Medium" ? taskMedCustom : taskLowCustom;
                    const setCustom = lvl === "High" ? setTaskHighCustom : lvl === "Medium" ? setTaskMedCustom : setTaskLowCustom;
                    const wheelRef = lvl === "High" ? colorWheelHighRef : lvl === "Medium" ? colorWheelMedRef : colorWheelLowRef;
                    return (
                      <div key={lvl}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: pageText(boardTheme), marginBottom: 6 }}>{lvl} priority</div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", alignItems: "center", padding: 6, margin: -6 }}>
                          {TASK_PALETTE.map((p, i) => (
                            <Fragment key={i}>
                            {i === TASK_DEFAULT_COUNT && <span aria-hidden style={{ width: 1, height: 16, margin: "0 3px", flexShrink: 0, backgroundColor: border(boardTheme) }} />}
                            <button onClick={() => setter(i)} style={swatchStyle(boardTheme, p.swatch, (currentIdx === i && currentIdx < TASK_PALETTE.length), 20)} /></Fragment>
                          ))}
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <button
                              onClick={() => { setter(TASK_PALETTE.length); wheelRef.current?.click(); }}
                              title="Pick custom color"
                              style={swatchStyle(boardTheme, customVal || RAINBOW, currentIdx >= TASK_PALETTE.length, 20, true)}
                            />
                            <input ref={wheelRef} type="color"
                              value={customVal || "#ff6600"}
                              onChange={e => { setCustom(e.target.value); setter(TASK_PALETTE.length); }}
                              style={{ position: "absolute", opacity: 0, width: 0, height: 0, top: 0, left: 0, pointerEvents: "none" }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: muted(boardTheme), marginBottom: 8 }}>Apply one color to all tasks regardless of priority.</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", alignItems: "center", padding: 6, margin: -6 }}>
                    {TASK_PALETTE.map((p, i) => (
                      <Fragment key={i}>
                      {i === TASK_DEFAULT_COUNT && <span aria-hidden style={{ width: 1, height: 16, margin: "0 3px", flexShrink: 0, backgroundColor: border(boardTheme) }} />}
                      <button onClick={() => setTaskSingleColorIdx(i)} style={swatchStyle(boardTheme, p.swatch, (taskSingleColorIdx === i && taskSingleColorIdx < TASK_PALETTE.length), 20)} /></Fragment>
                    ))}
                    {/* Custom color — solid when picked, rainbow when not */}
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <button
                        onClick={() => { setTaskSingleColorIdx(TASK_PALETTE.length); colorWheelSingleRef.current?.click(); }}
                        title="Pick custom color"
                        style={swatchStyle(boardTheme, taskSingleCustom || RAINBOW, taskSingleColorIdx >= TASK_PALETTE.length, 20, true)}
                      />
                      <input ref={colorWheelSingleRef} type="color"
                        value={taskSingleCustom || "#ff6600"}
                        onChange={e => { setTaskSingleCustom(e.target.value); setTaskSingleColorIdx(TASK_PALETTE.length); }}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0, top: 0, left: 0, pointerEvents: "none" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
        </div>
        )}

        {/* Email */}
        {isSignedIn && <EmailSettings theme={boardTheme} />}

        {/* BOB */}
        <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>BOB</div>
            {!isPlus && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: muted(boardTheme), opacity: .6 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Plus only
              </span>
            )}
          </div>

          {isPlus ? (
            <div style={{ display: "grid", gap: 14 }}>
              {/* About You */}
              <div style={{
                background: boardTheme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)",
                border: `1px solid ${border(boardTheme)}`, borderRadius: 12, padding: "14px 14px 12px",
                display: "grid", gap: 8,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: pageText(boardTheme), letterSpacing: ".01em" }}>About You</div>
                <textarea
                  value={bobUserInfo}
                  onChange={e => setBobUserInfoFn({ userInfo: e.target.value })}
                  placeholder="Tell BOB about yourself — your name, role, goals, or anything helpful…"
                  rows={4}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: boardTheme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
                    border: `1px solid ${border(boardTheme)}`, borderRadius: 8,
                    padding: "8px 10px", fontSize: 13, color: pageText(boardTheme),
                    outline: "none", lineHeight: 1.6, resize: "vertical",
                  }}
                />
                <p style={{ margin: 0, fontSize: 11, color: muted(boardTheme), lineHeight: 1.5 }}>
                  BOB uses this context to personalize responses across all your devices.
                </p>
              </div>

              {/* Auto-send toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: pageText(boardTheme) }}>Send on silence</div>
                  <div style={{ fontSize: 11.5, color: muted(boardTheme), marginTop: 2 }}>Auto-send after a pause in speech</div>
                </div>
                <button
                  onClick={() => { const v = !bobAutoSend; setBobAutoSend(v); try { localStorage.setItem("bob_auto_send", String(v)); } catch {} }}
                  style={{
                    flexShrink: 0, width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
                    backgroundColor: bobAutoSend ? (boardTheme === "dark" ? "#4a9eff" : "#2563eb") : (boardTheme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"),
                    position: "relative", transition: "background-color .18s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: bobAutoSend ? 21 : 3,
                    width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff",
                    transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                    display: "block",
                  }} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              background: boardTheme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)",
              border: `1px solid ${border(boardTheme)}`, borderRadius: 12, padding: "16px 14px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: pageText(boardTheme) }}>BOB is a Plus feature</div>
              <p style={{ margin: 0, fontSize: 12, color: muted(boardTheme), lineHeight: 1.55, maxWidth: 220 }}>
                An AI helper that plans your day, adds tasks for you, and keeps your board in order.
              </p>
              <button onClick={() => { setSettingsOpen(false); setUpgradeOpen(true); }} style={{
                padding: "7px 18px", borderRadius: 99, border: "none", cursor: "pointer",
                background: boardTheme === "dark" ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)",
                color: pageText(boardTheme), fontSize: 12, fontWeight: 700,
              }}>Upgrade to Plus →</button>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 2 }}>Calendar</div>
          <button
            onClick={exportToIcs}
            disabled={!notes.some(n => n.dueDate && !n.completed)}
            style={{
              ...buttonStyle(boardTheme, false),
              width: "100%", fontSize: 13, height: 40,
              opacity: notes.some(n => n.dueDate && !n.completed) ? 1 : 0.45,
            }}
          >
            Export tasks to calendar (.ics)
          </button>
          <p style={{ fontSize: 11, color: muted(boardTheme), margin: 0, lineHeight: 1.5 }}>
            Exports all tasks with due dates. Open with Apple Calendar, or import into Google Calendar via Settings → Import.
          </p>
        </div>

        {/* Billing */}
        {isSignedIn && (
          <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>Billing</div>

            {/* Plan card */}
            <div style={{
              background: boardTheme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)",
              border: `1px solid ${border(boardTheme)}`, borderRadius: 12, padding: "14px 14px 12px",
              display: "grid", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: pageText(boardTheme) }}>
                    {isPlus ? "Boardtivity Plus" : "Free Plan"}
                  </div>
                  {isPlus && subscription?.currentPeriodEnd && (
                    <div style={{ fontSize: 11.5, color: muted(boardTheme), marginTop: 2 }}>
                      Renews {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                  {isPlus && subscription?.status === "past_due" && (
                    <div style={{ fontSize: 11.5, color: "#e05555", marginTop: 2 }}>Payment past due</div>
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                  padding: "3px 10px", borderRadius: 999,
                  background: isPlus ? (boardTheme === "dark" ? "rgba(74,158,255,.15)" : "rgba(37,99,235,.1)") : (boardTheme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)"),
                  color: isPlus ? (boardTheme === "dark" ? "#4a9eff" : "#2563eb") : muted(boardTheme),
                  border: `1px solid ${isPlus ? (boardTheme === "dark" ? "rgba(74,158,255,.2)" : "rgba(37,99,235,.15)") : border(boardTheme)}`,
                }}>
                  {isPlus ? "Active" : "Free"}
                </span>
              </div>

              {isPlus ? (
                <button
                  onClick={startPortal}
                  style={{ ...buttonStyle(boardTheme, false), width: "100%", fontSize: 13, height: 38 }}
                >
                  Manage subscription
                </button>
              ) : (
                <button
                  onClick={() => { setSettingsOpen(false); setUpgradeOpen(true); }}
                  style={{ ...buttonStyle(boardTheme, true), width: "100%", fontSize: 13, height: 38 }}
                >
                  Upgrade to Plus
                </button>
              )}
            </div>
          </div>
        )}

        {/* Help */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>Help</div>
          <button
            onClick={openTutorial}
            style={{ ...buttonStyle(boardTheme, false), width: "100%", height: 40, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9v.3" /><circle cx="12" cy="16.9" r=".6" fill="currentColor" />
            </svg>
            Replay the tutorial
          </button>
        </div>

        {/* Get the app */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700 }}>Get the app</div>
          <InstallAppGuide theme={boardTheme} />
        </div>

        {/* Account */}
        <div style={{ borderTop: `1px solid ${border(boardTheme)}`, paddingTop: 20, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 700, marginBottom: 2 }}>Account</div>
          {isSignedIn ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                <span style={{ fontSize: 13, color: muted(boardTheme), opacity: .7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user?.emailAddresses?.[0]?.emailAddress}
                </span>
                {isPlus && (
                  <span style={{ flexShrink: 0, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: boardTheme === "dark" ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)", background: boardTheme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", border: `1px solid ${border(boardTheme)}`, borderRadius: 999, padding: "3px 9px", lineHeight: 1 }}>
                    Plus
                  </span>
                )}
              </div>
              <div
                onClick={cloudSyncState === "error" ? () => { setCloudSyncState("loading"); pushToCloud(); } : undefined}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: muted(boardTheme), cursor: cloudSyncState === "error" ? "pointer" : "default" }}
              >
                <SyncCloud state={cloudSyncState} />
                {syncLabel(cloudSyncState, "click")}
              </div>
              {confirmSignOut === "settings" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setConfirmSignOut(null); setSettingsOpen(false); signOut({ redirectUrl: "/" }); }} style={{ ...buttonStyle(boardTheme, false), flex: 1, fontSize: 13, height: 42 }}>Yes, sign out</button>
                  <button onClick={() => setConfirmSignOut(null)} style={{ ...buttonStyle(boardTheme, false), flex: 1, fontSize: 13, height: 42 }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmSignOut("settings")} style={{ ...buttonStyle(boardTheme, false), width: "100%", fontSize: 14, height: 42 }}>Sign out</button>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: muted(boardTheme) }}>
                <SyncCloud state="signedOut" />
                Not synced. Sign in to save your board across devices
              </div>
              <button onClick={() => { setSettingsOpen(false); openSignIn(); }} style={{ ...buttonStyle(boardTheme, false), width: "100%", fontSize: 14, height: 42 }}>Sign in</button>
              <button onClick={() => { setSettingsOpen(false); openSignUp(); }} style={{ ...buttonStyle(boardTheme, true), width: "100%", fontSize: 14, height: 42 }}>Sign up</button>
            </>
          )}
        </div>
        <div style={{ textAlign: "center", paddingTop: 12, fontSize: 11, color: muted(boardTheme) }}>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: muted(boardTheme), textDecoration: "none" }}>Terms</a>
          <span style={{ margin: "0 6px" }}>·</span>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: muted(boardTheme), textDecoration: "none" }}>Privacy</a>
        </div>
      </div>
    </div>
  );
}
