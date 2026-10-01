
"use client";

import BobAgent from "@/components/BobAgent";
import TourOverlay from "@/components/TourOverlay";
import { useHomeState } from "@/components/home/useHomeState";
import { HomeContext } from "@/components/home/HomeContext";
import LockIcon from "@/components/ui/LockIcon";
import { ArrowsLayer, StickersLayer, DrawToolbar } from "@/components/board/DrawingLayer";
import RenameBoardModal from "@/components/board/RenameBoardModal";
import DraftPromptModal from "@/components/board/DraftPromptModal";
import StepModal from "@/components/board/StepModal";
import NoteDetailModal from "@/components/board/NoteDetailModal";
import TaskComposer from "@/components/board/TaskComposer";
import MobileBoard from "@/components/board/MobileBoard";
import SettingsPanel from "@/components/board/SettingsPanel";
import FocusOverlay from "@/components/focus/FocusOverlay";
import SessionReviewModal from "@/components/focus/SessionReviewModal";
import ProfilePanel from "@/components/focus/ProfilePanel";
import BoardtivityLogo from "@/components/BoardtivityLogo";
import ThemeToggle from "@/components/ThemeToggle";
import DurationPicker from "@/components/focus/DurationPicker";
import FeedbackBoard from "@/components/landing/FeedbackBoard";
import MarketingSections from "@/components/landing/MarketingSections";
import { UpgradeModal, LimitReachedModal, SubscribedModal, WhatsNewModal, NamePromptModal } from "@/components/modals/AccountModals";
import { NOTE_PALETTE, paletteBg, paletteHalo, noteText, noteSub} from "@/lib/colors";
import { pageText, muted, border, paper, grid, panel, buttonStyle, circleButton, pill } from "@/lib/ui";
import { todayStr, formatDateShort, fmtTime} from "@/lib/dates";
import { BOARD_W, BOARD_H, NOTE_W, NOTE_H, noteCardWidth, titleFontSize, STEP_W, STEP_H} from "@/lib/boardLayout";

export function HomeShell() {
  const home = useHomeState();
  const {
    toggleNoteLock, startLongPress, trackLongPress, cancelLongPress, lastPointerTypeRef, lockToast,
    drawMode, setDrawModeOn, drawTool, connectFromId, setConnectFromId, setDrawSelection, connectCard, placeSticker,
    theme, setTheme, boardTheme, setBoardTheme, boards, activeBoardId, setActiveBoardId, boardsOpen,
    setBoardsOpen, notes, highlightedNoteIds, setDetailNoteId, setDetailEditing, setActiveStep, setComposerOpen, setRenameBoardId,
    setRenameValue, focusPicker, setFocusPicker, setProfileOpen, upgradeOpen, setUpgradeOpen, limitReachedOpen, setLimitReachedOpen,
    showSubscribedModal, setShowSubscribedModal, showUpdateModal, setShowUpdateModal, namePromptOpen, setNamePromptOpen, userMenuOpen, setUserMenuOpen,
    setComposerColorIdx, thoughtUnlinkTarget, setThoughtUnlinkTarget, heroRef, heroVisible, confirmSignOut, setConfirmSignOut, checkoutLoading,
    checkoutError, showSyncPill, titleMounted, settingsOpen, setSettingsOpen, bobAutoSend, confirmDeleteId, setConfirmDeleteId,
    isFullscreen, boardGrid, thoughtColorMode, thoughtFixedColorIdx, taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx,
    taskSingleColorIdx, cloudSyncState, setCloudSyncState, thoughtDropTarget, setThoughtDropTarget, scale, pan, thoughtUnlinkTargetRef,
    thoughtHoverTimerRef, viewportRef, boardContainerRef, boardMenuRef, boardButtonRef, settingsButtonRef, userMenuRef, feedbackRef,
    isMobile, isPlus, isAdmin, isNativeApp, focusStatsData, bobUserInfo, boardDragRef, noteDragRef,
    thoughtDropTargetRef, stepDragRef, draggedRef, activeBoard, activeNotes, getBg, getHalo, getNoteBorder,
    thoughtMode, boardStyle, fullscreenOverride, nativeAppOverride, taskBoards, thoughtBoards, startCheckout, centerBoard,
    pushToCloud, toggleFullscreen, addBoard, deleteBoard, onViewportPointerDown, onViewportPointerMove, onViewportPointerUp, toggleThoughtLink,
    handleBobSweep, handleBobEditNote, handleBobDeleteNotes, handleBobHighlightNotes, handleBobLaunchFocus, handleBobSaveUndo, handleBobUndo, handleBobSetIdeaColor,
    handleBobConfigureTaskColors, handleBobConfigureBoard, handleBobAddNote, commitFocus, user, isSignedIn, clerkLoaded, openSignIn,
    openSignUp, signOut,
  } = home;

  return (
    <HomeContext.Provider value={home}>
    <main style={{ minHeight: "100vh", fontFamily: "'Satoshi', Arial, sans-serif" }}>
      <TourOverlay isSignedIn={!!isSignedIn} isMobile={isMobile} />


      <section style={{ padding: isMobile ? "10px 18px 0" : "24px 48px 0", display: isNativeApp ? "none" : undefined }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <BoardtivityLogo size={isMobile ? 36 : 52} dark={theme === "dark"} />
            {!isSignedIn && <span style={{ fontSize: isMobile ? 15 : 17, letterSpacing: ".02em", color: pageText(theme), fontWeight: 700 }}>Boardtivity</span>}
          </div>
          {titleMounted && (
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: isMobile ? 13 : 20, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 800, color: pageText(theme), pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap" }}>
              Boardtivity
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isMobile && (
              <button
                onClick={() => feedbackRef.current?.scrollIntoView({ behavior: "smooth" })}
                style={{ ...buttonStyle(theme, false), fontSize: 13 }}
              >
                Feedback
              </button>
            )}
            {!isMobile && <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} size={40} />}
            {isSignedIn ? (
              <div ref={userMenuRef} style={{ position: "relative" }}>
                <button
                  onClick={() => { setUserMenuOpen(v => !v); setConfirmSignOut(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: pageText(theme), backgroundColor: panel(theme), border: `1px solid ${border(theme)}`, borderRadius: 999, padding: isMobile ? "0 10px" : "0 12px", height: isMobile ? 32 : 40, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {isMobile ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  ) : (
                    <>
                      {user?.firstName
                        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
                        : user?.emailAddresses?.[0]?.emailAddress}
                      {isPlus && (
                        <span style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.55)", background: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "3px 9px", lineHeight: 1 }}>
                          Plus
                        </span>
                      )}
                    </>
                  )}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: .4, transition: "transform .15s", transform: userMenuOpen ? "rotate(180deg)" : "none" }}>
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {userMenuOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 220, maxWidth: "calc(100vw - 32px)", backgroundColor: theme === "dark" ? "#1a1d22" : "#ffffff", border: `1px solid ${border(theme)}`, borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,.18)", padding: "6px", zIndex: 100, fontFamily: "inherit" }}>
                    {/* Account header */}
                    <div style={{ padding: "10px 12px 10px", borderBottom: `1px solid ${border(theme)}`, marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: pageText(theme), lineHeight: 1.2 }}>
                          {user?.firstName
                            ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
                            : "No name set"}
                        </div>
                        {isPlus && (
                          <span style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)", background: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "3px 9px", lineHeight: 1, flexShrink: 0 }}>
                            Plus
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: muted(theme) }}>
                        {user?.emailAddresses?.[0]?.emailAddress}
                      </div>
                    </div>
                    {/* Edit name */}
                    <button
                      onClick={() => { setUserMenuOpen(false); setNamePromptOpen(true); }}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "none", fontSize: 13, color: pageText(theme), cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Edit name
                    </button>
                    <div style={{ height: 1, backgroundColor: border(theme), margin: "4px 0" }} />
                    {/* Sign out */}
                    {confirmSignOut === "header" ? (
                      <div style={{ padding: "4px 2px", display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: 12, color: muted(theme), padding: "4px 12px" }}>Are you sure?</div>
                        <button onClick={() => { setConfirmSignOut(null); setUserMenuOpen(false); signOut({ redirectUrl: "/" }); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "none", fontSize: 13, fontWeight: 700, color: "#c03030", cursor: "pointer", fontFamily: "inherit" }}>Yes, sign out</button>
                        <button onClick={() => setConfirmSignOut(null)} style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "none", fontSize: 13, color: muted(theme), cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmSignOut("header")} style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "none", fontSize: 13, fontWeight: 600, color: pageText(theme), cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => openSignIn()} style={buttonStyle(theme, false)}>Sign in</button>
            )}
          </div>
        </header>
      </section>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{
        maxWidth: 560, margin: "0 auto", padding: isMobile ? (isSignedIn ? "16px 0 0" : isSignedIn === false ? `48px 20px 48px` : "0") : `80px 24px ${isSignedIn && !showSyncPill ? "16px" : "72px"}`,
        textAlign: "center",
        opacity: heroVisible ? 1 : 0,
        transform: heroVisible ? "none" : "translateY(20px)",
        transition: "opacity .75s ease, transform .75s ease, padding-bottom .5s ease .7s",
      }}>
        {!isSignedIn && (
          <>
            <h1 style={{ margin: "0 0 24px", fontSize: "clamp(34px,4.8vw,64px)", lineHeight: 1.0, fontWeight: 900, letterSpacing: "-.055em", color: pageText(theme) }}>
              The <span className="hue-rotate">Board</span> and the Produc<span className="hue-rotate">tivity</span><br/>in one.
            </h1>
            <p style={{ margin: "0 auto 40px", maxWidth: 460, fontSize: 17, color: muted(theme), lineHeight: 1.82, opacity: .7 }}>
              Boardtivity is a freeform visual board for your tasks, ideas, and focus. Drag tasks anywhere, let AI break them down into steps, link ideas, chain subtasks, and lock into focus mode — all in one place.
            </p>
          </>
        )}

        {/* Inline email capture */}
        {isSignedIn ? (
          <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center", overflow: "hidden", maxHeight: showSyncPill ? 80 : 0, paddingBottom: showSyncPill ? 4 : 0, marginBottom: showSyncPill ? 0 : 0, transition: showSyncPill ? "none" : "max-height .5s ease .7s, padding-bottom .5s ease .7s" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, color: muted(theme),
              backgroundColor: theme === "dark" ? "rgba(111,196,107,.08)" : "rgba(60,190,90,.07)",
              border: `1px solid ${theme === "dark" ? "rgba(111,196,107,.2)" : "rgba(60,190,90,.2)"}`,
              borderRadius: 999, padding: "10px 20px",
              opacity: showSyncPill ? .75 : 0,
              transition: "opacity .3s ease",
              pointerEvents: "none",
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3.5" stroke="#6fc46b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Signed in — your board saves automatically and syncs across devices
            </div>
          </div>
        ) : clerkLoaded ? (
          <div style={{ maxWidth: 400, margin: "0 auto" }}>
            <div style={{ marginBottom: 12, fontSize: 13, color: muted(theme), opacity: .6, letterSpacing: "-.01em" }}>
              Sign up to sync your board across devices and access Boardtivity anywhere.
            </div>
            <button
              onClick={() => openSignUp()}
              style={{ width: "100%", height: 48, borderRadius: 10, border: "none", backgroundColor: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em" }}
            >
              Sign up free
            </button>
            <div style={{ marginTop: 10, fontSize: 12, color: muted(theme), opacity: .4 }}>Free · No credit card needed</div>
          </div>
        ) : null}
        </section>

      {!isSignedIn && (
        <section style={{ maxWidth: 1440, margin: "0 auto", padding: "0 48px 16px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: muted(theme), opacity: .55 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="7" y1="2" x2="7" y2="12"/><polyline points="3,8 7,12 11,8"/></svg>
            {isMobile ? "See your work" : "Try the board"}
          </div>
        </section>
      )}

      <section id="boardtivity-board" style={{ maxWidth: 1440, margin: "0 auto", padding: isMobile ? "0 0 24px" : "0 48px 24px" }}>
        <MobileBoard />
        <div id="board-shell" ref={boardContainerRef} style={{ ...boardStyle, ...fullscreenOverride, ...nativeAppOverride, ...(isMobile && !isNativeApp ? { display: "none" } : {}) }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: paper(boardTheme),
              ...(boardGrid === "grid" ? { backgroundImage: `linear-gradient(${grid(boardTheme)} 1px, transparent 1px), linear-gradient(90deg, ${grid(boardTheme)} 1px, transparent 1px)`, backgroundSize: `${48 * scale}px ${48 * scale}px`, backgroundPosition: `${pan.x % (48 * scale)}px ${pan.y % (48 * scale)}px` } : boardGrid === "dots" ? { backgroundImage: `radial-gradient(circle, ${grid(boardTheme)} ${Math.max(0.6, 1.5 * scale)}px, transparent ${Math.max(0.6, 1.5 * scale)}px)`, backgroundSize: `${32 * scale}px ${32 * scale}px`, backgroundPosition: `${pan.x % (32 * scale)}px ${pan.y % (32 * scale)}px` } : {}),
              pointerEvents: "none",
            }}
          />

          {/* Board watermark */}
          <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", fontWeight: 700, color: boardTheme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.09)", pointerEvents: "none", zIndex: 0, userSelect: "none", whiteSpace: "nowrap" }}>
            Boardtivity
          </div>

          {/* Save your board prompt */}
          {!isSignedIn && activeNotes.length > 0 && (
            <div style={{
              position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 4,
              display: "flex", alignItems: "center", gap: 10,
              backgroundColor: boardTheme === "dark" ? "rgba(24,27,32,.92)" : "rgba(255,255,255,.95)",
              backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${border(boardTheme)}`,
              borderRadius: 14,
              padding: "10px 14px",
              boxShadow: boardTheme === "dark" ? "0 4px 24px rgba(0,0,0,.4)" : "0 4px 24px rgba(0,0,0,.1)",
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: pageText(boardTheme), lineHeight: 1.3 }}>Sync across devices</div>
                <div style={{ fontSize: 11, color: muted(boardTheme), opacity: .7, lineHeight: 1.3 }}>Sign up to access from anywhere</div>
              </div>
              <button
                onClick={() => openSignUp()}
                style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "none", backgroundColor: boardTheme === "dark" ? "#f7f8fb" : "#111315", color: boardTheme === "dark" ? "#111315" : "#f7f8fb", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Sign up
              </button>
            </div>
          )}

          <div
            ref={viewportRef}
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              touchAction: "none",
              userSelect: "none",
              cursor: boardDragRef.current ? "grabbing" : drawMode && drawTool.type === "sticker" ? "copy" : "grab",
            }}
            onPointerDown={onViewportPointerDown}
            onPointerMove={onViewportPointerMove}
            onPointerUp={onViewportPointerUp}
            onPointerCancel={onViewportPointerUp}
            onClick={(e) => {
              const wasDrag = draggedRef.current;
              draggedRef.current = false;
              if (wasDrag) return;
              // Click on empty board: place the active sticker, or clear the drawing selection.
              if (drawMode && drawTool.type === "sticker") placeSticker(drawTool.kind, e.clientX, e.clientY);
              else { setDrawSelection(null); setConnectFromId(null); }
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: BOARD_W,
                height: BOARD_H,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: "0 0",
                backgroundColor: "transparent",
                willChange: "transform",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <svg width={BOARD_W} height={BOARD_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {activeNotes
                  .filter((n) => n.type === "thought")
                  .flatMap((note) =>
                    note.linkedNoteIds
                      .map((linkedId) => {
                        const target = activeNotes.find((n) => n.id === linkedId);
                        if (!target) return null;
                        return (
                          <line
                            key={`thought-link-${note.id}-${linkedId}`}
                            x1={note.x + NOTE_W / 2}
                            y1={note.y + NOTE_H / 2}
                            x2={target.x + NOTE_W / 2}
                            y2={target.y + NOTE_H / 2}
                            stroke={boardTheme === "dark" ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)"}
                            strokeWidth="2"
                          />
                        );
                      })
                      .filter(Boolean) as React.ReactNode[]
                  )}

                {activeNotes
                  .filter((n) => n.showFlow && n.steps.length > 0)
                  .flatMap((note) => {
                    if (note.flowMode === "chain") {
                      return note.steps.map((step, index) => {
                        const prev =
                          index === 0
                            ? { x: note.x + NOTE_W / 2, y: note.y + NOTE_H / 2 }
                            : { x: note.steps[index - 1].x + STEP_W / 2, y: note.steps[index - 1].y + STEP_H / 2 };

                        return (
                          <line
                            key={`${note.id}-${step.id}-chain`}
                            x1={prev.x}
                            y1={prev.y}
                            x2={step.x + STEP_W / 2}
                            y2={step.y + STEP_H / 2}
                            stroke={boardTheme === "dark" ? "rgba(255,255,255,.18)" : "rgba(70,70,70,.18)"}
                            strokeWidth="2"
                          />
                        );
                      });
                    }

                    return note.steps.map((step) => (
                      <line
                        key={`${note.id}-${step.id}-web`}
                        x1={note.x + NOTE_W / 2}
                        y1={note.y + NOTE_H / 2}
                        x2={step.x + STEP_W / 2}
                        y2={step.y + STEP_H / 2}
                        stroke={boardTheme === "dark" ? "rgba(255,255,255,.18)" : "rgba(70,70,70,.18)"}
                        strokeWidth="2"
                      />
                    ));
                  })}
              </svg>

              <ArrowsLayer boardW={BOARD_W} boardH={BOARD_H} />

              {activeNotes
                .filter((n) => n.showFlow && n.steps.length > 0)
                .flatMap((note) =>
                  note.steps.map((step) => (
                    <button
                      key={`step-${note.id}-${step.id}`}
                      data-step="true"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (note.locked) { draggedRef.current = false; return; }
                        e.currentTarget.setPointerCapture(e.pointerId);
                        stepDragRef.current = {
                          pointerId: e.pointerId,
                          noteId: note.id,
                          stepId: step.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          stepX: step.x,
                          stepY: step.y,
                        };
                        draggedRef.current = false;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (draggedRef.current) {
                          draggedRef.current = false;
                          return;
                        }
                        setActiveStep({ noteId: note.id, stepId: step.id });
                      }}
                      style={{
                        position: "absolute",
                        left: step.x,
                        top: step.y,
                        width: STEP_W,
                        minHeight: STEP_H,
                        borderRadius: 9,
                        border: (step.done || note.completed) ? `1.5px solid ${boardTheme === "dark" ? "rgba(60,180,90,.30)" : "rgba(60,180,90,.45)"}` : getNoteBorder(note.importance),
                        backgroundColor: (step.done || note.completed) ? (boardTheme === "dark" ? "#0e2e18" : "#e6f9ee") : getBg(note.importance),
                        boxShadow: (step.done || note.completed)
                          ? `0 0 0 2px rgba(60,180,90,.2), 0 10px 18px rgba(0,0,0,.08)`
                          : `0 0 0 2px ${getHalo(note.importance)}, 0 10px 18px rgba(0,0,0,.08)`,
                        padding: "10px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              border: step.done ? "1px solid #3d8b40" : "1px solid rgba(0,0,0,.18)",
                              backgroundColor: step.done ? "#6fc46b" : boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#f1f1ef",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 700, fontSize: 13, color: noteText(boardTheme) }}>{step.title}</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}

              {activeNotes.map((note) => (
                <button
                  key={note.id}
                  data-note="true"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.button === 2) return; // right-click is handled by onContextMenu
                    e.currentTarget.setPointerCapture(e.pointerId);
                    draggedRef.current = false;
                    startLongPress(e, note.id, !!note.locked);
                    if (note.locked) return;
                    noteDragRef.current = {
                      pointerId: e.pointerId,
                      noteId: note.id,
                      noteType: note.type,
                      boardId: note.boardId,
                      startX: e.clientX,
                      startY: e.clientY,
                      noteX: note.x,
                      noteY: note.y,
                    };
                  }}
                  onPointerMove={trackLongPress}
                  onPointerCancel={cancelLongPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Touch browsers also fire contextmenu on long-press; the long-press timer handles those.
                    if (lastPointerTypeRef.current === "mouse") toggleNoteLock(note.id);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    cancelLongPress();
                    const drag = noteDragRef.current;
                    const linkTarget = thoughtDropTargetRef.current;
                    if (drag && drag.noteType === "thought" && linkTarget !== null && linkTarget !== drag.noteId) {
                      toggleThoughtLink(drag.noteId, linkTarget);
                    }
                    if (thoughtHoverTimerRef.current) { clearTimeout(thoughtHoverTimerRef.current); thoughtHoverTimerRef.current = null; }
                    thoughtDropTargetRef.current = null; setThoughtDropTarget(null);
                    thoughtUnlinkTargetRef.current = null; setThoughtUnlinkTarget(null);
                    noteDragRef.current = null;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (draggedRef.current) {
                      draggedRef.current = false;
                      return;
                    }
                    if (drawMode && drawTool.type === "connect") { connectCard(note.id); return; }
                    setDetailNoteId(note.id); setDetailEditing(false);
                  }}
                  style={{
                    position: "absolute",
                    left: note.x,
                    top: note.y,
                    width: noteCardWidth(note.title),
                    minHeight: NOTE_H,
                    padding: "6px 7px 6px",
                    borderRadius: 10,
                    border: thoughtDropTarget === note.id
                      ? `1.5px solid ${boardTheme === "dark" ? "rgba(160,170,240,.7)" : "rgba(100,110,200,.55)"}`
                      : thoughtUnlinkTarget === note.id
                        ? `1.5px solid rgba(220,60,60,.65)`
                        : note.completed
                          ? `1.5px solid ${boardTheme === "dark" ? "rgba(60,180,90,.30)" : "rgba(60,180,90,.45)"}`
                          : note.type === "task"
                            ? getNoteBorder(note.importance)
                            : note.colorIdx !== undefined
                              ? `1.5px solid ${NOTE_PALETTE[note.colorIdx % NOTE_PALETTE.length].halo.replace(/[\d.]+\)$/, boardTheme === "dark" ? "0.32)" : "0.48)")}`
                              : `1px solid ${boardTheme === "dark" ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.10)"}`,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: note.completed
                      ? (boardTheme === "dark" ? "#0e2e18" : "#e6f9ee")
                      : note.type === "task"
                        ? getBg(note.importance)
                        : note.colorIdx !== undefined
                          ? paletteBg(note.colorIdx, boardTheme)
                          : (boardTheme === "dark" ? "#2a2d32" : "#ebebeb"),
                    boxShadow: highlightedNoteIds.has(note.id) || connectFromId === note.id
                      ? `0 0 0 3px rgba(99,160,255,.7), 0 0 28px rgba(99,160,255,.45), 0 10px 18px rgba(0,0,0,.1)`
                      : thoughtDropTarget === note.id
                        ? `0 0 0 4px ${boardTheme === "dark" ? "rgba(140,150,230,.28)" : "rgba(100,110,200,.18)"}, 0 0 20px ${boardTheme === "dark" ? "rgba(140,150,230,.22)" : "rgba(100,110,200,.16)"}, 0 10px 18px rgba(59,43,16,.06)`
                        : thoughtUnlinkTarget === note.id
                          ? "0 0 0 4px rgba(220,60,60,.25), 0 0 20px rgba(220,60,60,.20), 0 10px 18px rgba(59,43,16,.06)"
                          : note.completed
                            ? `0 0 0 3px rgba(60,180,90,.25), 0 10px 18px rgba(0,0,0,.06)`
                            : note.type === "task"
                              ? `0 0 0 3px ${getHalo(note.importance)}, 0 10px 18px rgba(59,43,16,.06)`
                              : note.colorIdx !== undefined
                                ? `0 0 0 3px ${paletteHalo(note.colorIdx)}, 0 10px 18px rgba(59,43,16,.06)`
                                : `0 0 0 3px ${boardTheme === "dark" ? "rgba(140,140,140,.18)" : "rgba(0,0,0,.10)"}, 0 10px 18px rgba(59,43,16,.06)`,
                    textAlign: "left",
                    cursor: drawMode && drawTool.type === "connect" ? "crosshair" : "pointer",
                    transition: "box-shadow .22s ease, border-color .22s ease",
                    // No iOS callout or text selection while long-pressing to lock
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                  title={note.locked ? "Locked — right-click or long-press to unlock" : undefined}
                  className={thoughtUnlinkTarget === note.id ? "thought-vibrate" : undefined}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={pill(boardTheme)}>{note.type === "task" ? "Task" : "Idea"}</div>
                      {note.locked && (
                        <div style={{ ...pill(boardTheme), padding: "4px 6px", display: "grid", placeItems: "center" }} aria-label="Locked">
                          <LockIcon locked size={11} />
                        </div>
                      )}
                    </div>

                    {note.type === "task" && (note.dueDate || note.completed || note.steps.every(s => s.done && s.id)) && (() => {
                      const done = note.completed || (note.steps.length > 0 && note.steps.every(s => s.done));
                      if (done) return (
                        <div style={{ ...pill(boardTheme), fontWeight: 800, color: boardTheme === "dark" ? "rgba(100,220,120,.9)" : "rgba(30,120,60,.85)", border: "1px solid rgba(60,180,90,.3)", backgroundColor: "rgba(60,180,90,.1)" }}>Completed</div>
                      );
                      if (!note.dueDate) return null;
                      const today = todayStr();
                      const overdue = note.dueDate < today;
                      const dueToday = note.dueDate === today;
                      return (
                        <div style={{
                          ...pill(boardTheme),
                          fontWeight: 800,
                          ...(overdue ? {
                            color: "#ff3333",
                            border: "1px solid rgba(255,50,50,.5)",
                            backgroundColor: "rgba(255,50,50,.15)",
                            boxShadow: "0 0 10px rgba(255,50,50,.4)",
                            animation: "overduePulse 1.6s ease-in-out infinite",
                          } : dueToday ? {
                            color: boardTheme === "dark" ? "#ffb347" : "#b86800",
                            border: "1px solid rgba(200,130,20,.4)",
                            backgroundColor: "rgba(200,130,20,.1)",
                            boxShadow: "0 0 6px rgba(200,130,20,.3)",
                          } : {}),
                        }}>{overdue ? "Overdue" : dueToday ? `Due Today${fmtTime(note.dueTime)}` : `Due ${formatDateShort(note.dueDate)}${fmtTime(note.dueTime)}`}</div>
                      );
                    })()}
                  </div>

                  <div style={{ marginTop: 18, marginBottom: 6, fontSize: titleFontSize(note.title), lineHeight: 1.22, fontWeight: 700, color: noteText(boardTheme), display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {note.title}
                  </div>

                  {note.body && note.type === "thought" && (
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: noteSub(boardTheme), display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {note.body}
                    </div>
                  )}

                  {note.type === "task" && (
                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      {note.steps.length > 0 ? (
                        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                          {note.steps.map((step) => (
                            <span
                              key={step.id}
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                border: step.done ? "1px solid #3d8b40" : "1px solid rgba(0,0,0,.18)",
                                backgroundColor: step.done ? "#6fc46b" : boardTheme === "dark" ? "rgba(255,255,255,.12)" : "#f1f1ef",
                                display: "inline-block",
                              }}
                            />
                          ))}
                        </div>
                      ) : <div />}
                      <span style={pill(boardTheme)}>
                        {note.importance && note.importance !== "none" ? `${note.importance} priority` : "No priority"}
                      </span>
                    </div>
                  )}
                </button>
              ))}

              <StickersLayer />
            </div>
          </div>

          {/* Empty state — rendered outside the transformed canvas so clicks land correctly */}
          {activeNotes.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 1, pointerEvents: "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, textAlign: "center", maxWidth: 380, padding: "0 24px", pointerEvents: "auto" }}>
                <img src="/logo-icon.svg" alt="" style={{ width: 110, height: 90, opacity: boardTheme === "dark" ? 0.45 : 0.35, filter: boardTheme === "dark" ? "invert(1)" : "none", pointerEvents: "none", userSelect: "none" }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: boardTheme === "dark" ? "#e8e8e6" : "#2a2822", lineHeight: 1.2 }}>
                    {thoughtMode ? "Your idea board is empty" : "Your task board is empty"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14, color: boardTheme === "dark" ? "rgba(255,255,255,.38)" : "rgba(0,0,0,.38)" }}>
                    {thoughtMode ? "Start capturing and connecting your ideas" : "Start adding tasks and breaking them down"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", textAlign: "left" }}>
                  {(thoughtMode ? [
                    { icon: "✦", text: "Click + to add an idea card to the board" },
                    { icon: "⇄", text: "Drag one idea over another to link them together" },
                    { icon: "⊙", text: "Hold over a linked idea to unlink it" },
                    { icon: "✎", text: "Click an idea card to view, edit, or add a note" },
                  ] : [
                    { icon: "✦", text: "Click + to create a task — name it, set priority & due date" },
                    { icon: "≡", text: "Open a task to add subtasks and break down the work" },
                    { icon: "◎", text: "Hit Start Focus Mode to work through subtasks with a timer" },
                  ]).map(({ icon, text }) => (
                    <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10, backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)", borderRadius: 10, padding: "10px 14px" }}>
                      <span style={{ fontSize: 13, color: boardTheme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.3)", flexShrink: 0, marginTop: 1 }}>{icon}</span>
                      <span style={{ fontSize: 13, color: boardTheme === "dark" ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)", lineHeight: 1.5 }}>{text}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setComposerOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 999, border: "none", backgroundColor: boardTheme === "dark" ? "#f7f8fb" : "#111315", color: boardTheme === "dark" ? "#111315" : "#f7f8fb", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em" }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                  {thoughtMode ? "Add your first idea" : "Add your first task"}
                </button>
              </div>
            </div>
          )}

          <div style={{ position: "absolute", top: isNativeApp ? "env(safe-area-inset-top, 12px)" : 12, left: 16, right: 16, zIndex: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* BOB — visible to all, admin-gated features */}
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 0 }}>
              <BobAgent
                theme={boardTheme}
                notes={notes}
                activeBoardId={activeBoardId}
                onSweep={handleBobSweep}
                onAddNote={handleBobAddNote}
                onEditNote={handleBobEditNote}
                onDeleteNotes={handleBobDeleteNotes}
                onHighlightNotes={handleBobHighlightNotes}
                onLaunchFocus={handleBobLaunchFocus}
                onSaveUndo={handleBobSaveUndo}
                onUndo={handleBobUndo}
                onSetIdeaColor={handleBobSetIdeaColor}
                onConfigureTaskColors={handleBobConfigureTaskColors}
                onConfigureBoard={handleBobConfigureBoard}
                onUpgrade={() => setUpgradeOpen(true)}
                isAdmin={!!isAdmin}
                userInfo={bobUserInfo}
                autoSend={bobAutoSend}
                settings={{ taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, thoughtColorMode, thoughtFixedColorIdx, boardTheme, boardGrid, activeBoardType: activeBoard?.type as "task" | "thought" | undefined, activeBoardName: activeBoard?.name, boards: boards.map(b => ({ id: b.id, name: b.name, type: b.type as "task" | "thought" })) }}
                focusStats={focusStatsData ?? undefined}
              />
            </div>
            <div style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 14,
                fontWeight: 700,
                color: pageText(boardTheme),
                backgroundColor: boardTheme === "dark" ? "rgba(31,35,41,.85)" : "rgba(255,255,255,.90)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderRadius: 99,
                padding: "6px 14px 6px 8px",
                border: `1px solid ${border(boardTheme)}`,
                boxShadow: boardTheme === "dark" ? "0 2px 12px rgba(0,0,0,.28)" : "0 2px 12px rgba(0,0,0,.08)",
              }}>
              <BoardtivityLogo size={22} dark={boardTheme === "dark"} />
              {activeBoard.name}
            </div>

            <div style={{ position: "relative", display: "flex", gap: 5, alignItems: "center" }}>
              {/* Focus stats */}
              {isSignedIn && (
                <button onClick={() => setProfileOpen(true)} style={circleButton(boardTheme)} aria-label="Focus stats" title="Focus stats">
                  {(focusStatsData?.currentStreak ?? 0) > 0
                    ? <svg width="11" height="15" viewBox="0 0 11 15" fill="none" overflow="visible" style={{ display: "block", animation: "boltSpark 1.4s ease-in-out infinite" }}>
                        <path d="M7 1L1 8.5h4L3.5 14 10 6H6L7 1Z" fill="#facc15"/>
                      </svg>
                    : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  }
                </button>
              )}

              {/* Theme toggle — lightbulb */}
              <ThemeToggle theme={boardTheme} onToggle={() => setBoardTheme((t) => (t === "dark" ? "light" : "dark"))} />

              {/* Divider */}
              <div style={{ width: 1, height: 18, backgroundColor: border(boardTheme), margin: "0 2px" }} />

              {/* Center board */}
              <button onClick={centerBoard} style={circleButton(boardTheme)} aria-label="Center board" title="Center board">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>
              </button>

              {/* Cloud sync indicator — only when signed in */}
              {isSignedIn && (
                <div
                  title={cloudSyncState === "synced" ? "Synced" : cloudSyncState === "saving" ? "Saving…" : cloudSyncState === "error" ? "Sync error — click to retry" : "Connecting…"}
                  onClick={cloudSyncState === "error" ? () => { setCloudSyncState("loading"); pushToCloud(); } : undefined}
                  style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: cloudSyncState === "synced" ? "#3db83d" : cloudSyncState === "error" ? "#c03030" : "#c8960a", boxShadow: cloudSyncState === "saving" ? "0 0 0 3px rgba(200,150,10,.25)" : "none", transition: "background-color .3s", cursor: cloudSyncState === "error" ? "pointer" : "default" }}
                />
              )}

              {/* Draw mode — arrows between cards + stickers */}
              <button
                onClick={() => setDrawModeOn(!drawMode)}
                style={{ ...circleButton(boardTheme), ...(drawMode ? { backgroundColor: pageText(boardTheme), color: panel(boardTheme), border: "none" } : {}) }}
                aria-label={drawMode ? "Exit draw mode" : "Draw: connect cards and add stickers"}
                aria-pressed={drawMode}
                title={drawMode ? "Exit draw mode (Esc)" : "Draw: connect cards and add stickers"}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" />
                </svg>
              </button>

              {/* Settings button — gear */}
              <button ref={settingsButtonRef} onClick={() => { setSettingsOpen(v => !v); setBoardsOpen(false); }} style={{ ...circleButton(boardTheme), ...(settingsOpen ? { backgroundColor: boardTheme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.07)", border: `1px solid ${boardTheme === "dark" ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.15)"}` } : {}) }} aria-label="Settings" title="Settings">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>

              {/* Divider */}
              <div style={{ width: 1, height: 18, backgroundColor: border(boardTheme), margin: "0 2px" }} />

              {/* Boards button */}
              <button ref={boardButtonRef} onClick={() => { setBoardsOpen(v => !v); setSettingsOpen(false); }} style={{ ...buttonStyle(boardTheme, boardsOpen, true), minWidth: 80 }}>
                Boards
              </button>

              {/* Boards menu — compact dropdown */}
              <div ref={boardMenuRef} style={{
                position: "absolute", top: 44, right: 0, width: 248,
                maxHeight: 340, overflow: "auto",
                borderRadius: 12, border: `1px solid ${border(boardTheme)}`,
                backgroundColor: panel(boardTheme),
                boxShadow: boardTheme === "dark" ? "0 8px 32px rgba(0,0,0,.4)" : "0 8px 32px rgba(0,0,0,.12)",
                padding: "6px 0",
                opacity: boardsOpen ? 1 : 0,
                transform: boardsOpen ? "translateY(0)" : "translateY(-6px)",
                pointerEvents: boardsOpen ? "auto" : "none",
                transition: "opacity .13s ease, transform .13s ease",
                zIndex: 10,
              }}>
                <div style={{ padding: "6px 14px 4px", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme), fontWeight: 600 }}>Boards</div>
                {[...taskBoards, ...thoughtBoards].map((board) => (
                  <div key={board.id} style={{
                    display: "flex", alignItems: "center", gap: 0,
                    padding: "2px 6px",
                    backgroundColor: board.id === activeBoardId ? (boardTheme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)") : "transparent",
                    margin: "0 4px", borderRadius: 7,
                  }}>
                    <button onClick={() => { setActiveBoardId(board.id); setBoardsOpen(false); }} style={{
                      flex: 1, border: "none", background: "none", padding: "6px 8px",
                      textAlign: "left", fontSize: 13, fontWeight: board.id === activeBoardId ? 700 : 500,
                      color: pageText(boardTheme), cursor: "pointer",
                    }}>
                      {board.name}
                      <span style={{ marginLeft: 6, fontSize: 10, color: muted(boardTheme), fontWeight: 400 }}>{board.type === "task" ? "Task" : "Idea"}</span>
                    </button>
                    <button onClick={() => { setRenameBoardId(board.id); setRenameValue(board.name); }} style={{ background: "none", border: "none", padding: "4px 6px", cursor: "pointer", color: muted(boardTheme), fontSize: 11 }} title="Rename">✎</button>
                    {confirmDeleteId === board.id ? (
                      <>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ background: "none", border: "none", padding: "3px 5px", cursor: "pointer", color: muted(boardTheme), fontSize: 11, fontWeight: 600 }}>Cancel</button>
                        <button onClick={() => { deleteBoard(board.id); setConfirmDeleteId(null); }} style={{ background: "none", border: "none", padding: "3px 6px", cursor: "pointer", color: boardTheme === "dark" ? "rgba(255,100,100,.85)" : "rgba(160,30,30,.8)", fontSize: 11, fontWeight: 700 }}>Delete</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(board.id)} style={{ background: "none", border: "none", padding: "4px 6px", cursor: "pointer", color: boardTheme === "dark" ? "rgba(255,100,100,.6)" : "rgba(180,40,40,.5)", fontSize: 13 }} title="Delete">×</button>
                    )}
                  </div>
                ))}
                <div style={{ height: 1, backgroundColor: border(boardTheme), margin: "6px 10px" }} />
                <div style={{ display: "flex", gap: 6, padding: "4px 10px 6px" }}>
                  <button onClick={() => addBoard("task")} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 12 }}>+ Task Board</button>
                  <button onClick={() => addBoard("thought")} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 12 }}>+ Idea Board</button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Settings full-screen overlay ── */}
          {settingsOpen && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 30,
              backgroundColor: boardTheme === "dark" ? "rgba(5,7,10,.5)" : "rgba(0,0,0,.22)",
              backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            }} onClick={() => setSettingsOpen(false)} />
          )}
          <SettingsPanel />

          <DrawToolbar />

          {/* Lock / unlock confirmation */}
          {lockToast && (
            <div
              key={lockToast.key}
              role="status"
              className="lock-toast"
              style={{
                position: "absolute", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 4,
                display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999,
                backgroundColor: boardTheme === "dark" ? "#f5f5f2" : "#171613", color: boardTheme === "dark" ? "#171613" : "#f5f5f2",
                fontSize: 13, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,.18)", pointerEvents: "none",
              }}
            >
              <LockIcon locked={lockToast.locked} size={13} />
              {lockToast.text}
            </div>
          )}

          {/* Fullscreen button — bottom left */}
          <button
            onClick={toggleFullscreen}
            style={{ ...circleButton(boardTheme, 38), position: "absolute", left: 18, bottom: 18, zIndex: 3, boxShadow: "0 8px 16px rgba(89,72,48,.08)", display: isNativeApp ? "none" : undefined }}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
              </svg>
            )}
          </button>

          {/* Add note button — bottom right */}
          <button
            onClick={() => {
              // Plus: use their default color (fixed mode) or grey (undefined); Free: random
              setComposerColorIdx(thoughtColorMode === "fixed" ? thoughtFixedColorIdx : undefined);
              setComposerOpen(true);
            }}
            style={{
              position: "absolute", right: 18, bottom: 18, zIndex: 3,
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 16px 0 12px", height: 38, borderRadius: 999,
              backgroundColor: boardTheme === "dark" ? "#23262b" : "#ffffff",
              border: `1px solid ${border(boardTheme)}`,
              color: boardTheme === "dark" ? "#f5f5f2" : "#433d35",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              boxShadow: "0 8px 16px rgba(89,72,48,.08)",
            }}
            aria-label={thoughtMode ? "Add idea" : "Add task"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {thoughtMode ? "Add Idea" : "Add Task"}
          </button>
      <RenameBoardModal />

      <TaskComposer />

      <NoteDetailModal />

      <StepModal />

      <FocusOverlay />

      <DraftPromptModal />

      {/* ── Duration Picker (inside board-shell so it shows in fullscreen) ── */}
      {isFullscreen && focusPicker && (() => {
        const pickerNote = notes.find(n => n.id === focusPicker.noteId);
        if (!pickerNote) return null;
        return <DurationPicker note={pickerNote} onCancel={() => setFocusPicker(null)} onStart={mins => commitFocus(focusPicker.noteId, focusPicker.chain, mins)} />;
      })()}


      </div>
      </section>

      {/* ── Session Review Modal — outside board-shell so position:fixed works on mobile ── */}
      <SessionReviewModal />

      {/* ── Profile Panel — outside board-shell so position:fixed works on mobile ── */}
      <ProfilePanel />

      <MarketingSections theme={theme} isMobile={isMobile} isSignedIn={isSignedIn} isPlus={isPlus} checkoutLoading={checkoutLoading} onSignUp={() => openSignUp()} onCheckout={startCheckout} />

      {/* ── Feedback Board ── */}
      <FeedbackBoard theme={theme} isMobile={isMobile} isSignedIn={isSignedIn} onSignIn={() => openSignIn()} sectionRef={feedbackRef} />

      {/* ── Upgrade modal ── */}
      {upgradeOpen && <UpgradeModal theme={theme} onClose={() => setUpgradeOpen(false)} onCheckout={startCheckout} checkoutLoading={checkoutLoading} checkoutError={checkoutError} />}

      {/* ── Limit reached modal (Plus users at max) ── */}
      {limitReachedOpen && <LimitReachedModal theme={theme} onClose={() => setLimitReachedOpen(false)} />}

      {/* ── Post-purchase thank you modal ── */}
      {showSubscribedModal && <SubscribedModal theme={theme} onClose={() => setShowSubscribedModal(false)} />}

      {/* ── Sync overhaul update notice ── */}
      {showUpdateModal && <WhatsNewModal theme={theme} onClose={() => { setShowUpdateModal(false); try { localStorage.setItem("boardtivity_update_sync_v1_seen", "1"); } catch {} }} />}

      {/* ── Name prompt modal ── */}
      {namePromptOpen && (
        <NamePromptModal
          theme={theme}
          initialFirst={user?.firstName ?? ""}
          initialLast={user?.lastName ?? ""}
          onSave={async (first, last) => { if (user) await user.update({ firstName: first, lastName: last || undefined }); }}
          onDismiss={() => { setNamePromptOpen(false); try { localStorage.setItem("boardtivity_name_prompt_dismissed", "1"); } catch {} }}
        />
      )}


      {/* ── Duration Picker (main level — mobile + non-fullscreen desktop) ── */}
      {!isFullscreen && focusPicker && (() => {
        const pickerNote = notes.find(n => n.id === focusPicker.noteId);
        if (!pickerNote) return null;
        return <DurationPicker note={pickerNote} onCancel={() => setFocusPicker(null)} onStart={mins => commitFocus(focusPicker.noteId, focusPicker.chain, mins)} />;
      })()}

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px 16px", borderTop: `1px solid ${border(theme)}`, marginTop: 40 }}>
        <div style={{ fontSize: 12, color: muted(theme), display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" as const }}>
          <span>© {new Date().getFullYear()} Boardtivity</span>
          <a href="/privacy" style={{ color: muted(theme), textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a>
          <a href="/terms" style={{ color: muted(theme), textDecoration: "none", fontWeight: 600 }}>Terms of Service</a>
          <a href="mailto:contact@boardtivity.com" style={{ color: muted(theme), textDecoration: "none", fontWeight: 600 }}>Contact</a>
        </div>
      </footer>

    </main>
    </HomeContext.Provider>
  );
}
