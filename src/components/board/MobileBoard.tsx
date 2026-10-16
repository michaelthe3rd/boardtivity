"use client";

import { Fragment, useState } from "react";
import type { CSSProperties } from "react";
import type { Importance, Note } from "@/lib/board";
import BobAgent from "@/components/BobAgent";
import ThemeToggle from "@/components/ThemeToggle";
import { NOTE_PALETTE, TASK_PALETTE, TASK_DEFAULT_COUNT, hexToRgba, blendHex, clampCardBg, PRIORITY_COLORS, priorityColor } from "@/lib/colors";
import { pageText, muted, surface, border, paper, swatchStyle, RAINBOW } from "@/lib/ui";
import { isoToMDY, todayStr, tomorrowStr, fmtTime, fmtFocusTime } from "@/lib/dates";
import { BOARD_W, BOARD_H, NOTE_W, NOTE_H, genId, layoutWeb, layoutChain } from "@/lib/boardLayout";
import { buildBreakdown } from "@/lib/breakdown";
import DateField from "@/components/ui/DateField";
import { useHome } from "@/components/home/HomeContext";
import EmailSettings from "@/components/board/EmailSettings";
import ReminderPicker, { BellIcon, formatReminder } from "@/components/board/ReminderPicker";
import FadeScroll from "@/components/ui/FadeScroll";
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon } from "@/components/ui/Icons";
import { SyncCloud, syncLabel } from "@/components/ui/SyncStatus";
import InstallAppGuide from "@/components/board/InstallAppGuide";

// Phone layout: list-style board with bottom bar, sheets for add/edit/settings, and BOB.
export default function MobileBoard() {
  const {
    openTutorial,
    boardStateWith, theme, setTheme, boards, setBoards, activeBoardId,
    setActiveBoardId, notes, setNotes, focusOpen, setFocusOpen, focusNoteId, setFocusNoteId, focusStepId,
    setFocusStepId, focusSecondsLeft, setFocusSecondsLeft, focusCompleted, setFocusCompleted, focusPaused, setFocusPaused, breakSecondsLeft,
    setBreakSecondsLeft, focusChainMode, setFocusChainMode, focusNextStep, focusExitConfirm, setFocusExitConfirm, setProfileOpen, setUpgradeOpen,
    mobileExpandedIds, setMobileExpandedIds, mobileAddMode, setMobileAddMode, mobileAddTitle, setMobileAddTitle, mobileAddBody, setMobileAddBody,
    mobileAddImportance, setMobileAddImportance, mobileAddDueDate, setMobileAddDueDate, mobileAddDueTime, setMobileAddDueTime, mobileActionNoteId, setMobileActionNoteId,
    mobileEditTitle, setMobileEditTitle, mobileEditDueDate, setMobileEditDueDate, mobileEditDueTime, setMobileEditDueTime, mobileEditImportance, setMobileEditImportance,
    mobileEditMinutes, setMobileEditMinutes, mobileAddColorIdx, setMobileAddColorIdx, mobileEditColorIdx, setMobileEditColorIdx, mobileAddRemindAt, setMobileAddRemindAt,
    mobileEditSteps, setMobileEditSteps, mobileDeleteConfirm, setMobileDeleteConfirm, mobileBoardTypePicker, setMobileBoardTypePicker, mobileBoardActionId, setMobileBoardActionId,
    mobileBoardRename, setMobileBoardRename, mobileBoardRenaming, setMobileBoardRenaming, mobileFilterPriority, setMobileFilterPriority, mobileSortDate, setMobileSortDate,
    bobAutoSend, setBobAutoSend, mobileSettingsOpen, setMobileSettingsOpen, boardGrid, thoughtColorMode, setThoughtColorMode,
    thoughtFixedColorIdx, setThoughtFixedColorIdx, taskColorMode, setTaskColorMode, taskHighColorIdx, setTaskHighColorIdx, taskMedColorIdx, setTaskMedColorIdx,
    taskLowColorIdx, setTaskLowColorIdx, taskSingleColorIdx, setTaskSingleColorIdx, taskSingleCustom, setTaskSingleCustom, taskHighCustom, setTaskHighCustom,
    taskMedCustom, setTaskMedCustom, taskLowCustom, setTaskLowCustom, cloudSyncState, setCloudSyncState, confirmSignOut, setConfirmSignOut, openSignIn, openSignUp, scale, pan, focusSessionStartRef,
    focusStartedAtRef, focusTotalSecsRef, focusPausedSecsRef, viewportRef, isMobile, subscription, isPlus, isAdmin,
    isNativeApp, focusStatsData, setReminderMut, latestBoardStateRef, setBobUserInfoFn, bobUserInfo, activeBoard,
    taskPaletteEntry, startPortal, findFreeSpot, exportToIcs, pushToCloud, advanceToNext, addBoard, deleteBoard,
    deleteTask, handleBobSweep, handleBobEditNote, handleBobDeleteNotes, handleBobHighlightNotes, handleBobLaunchFocus, handleBobSaveUndo, handleBobUndo,
    handleBobSetIdeaColor, handleBobConfigureTaskColors, handleBobConfigureBoard, handleBobAddNote, startFocus, closeFocusWithReview, setTaskDone, scheduleReminder, emailPrefs, user,
    isSignedIn, clerkLoaded, signOut,
  } = useHome();
  // Edit-sheet fields that only this component uses.
  const [editBody, setEditBody] = useState("");
  const [editRemindAt, setEditRemindAt] = useState<number | null>(null);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);

  if (!(isMobile && !isNativeApp)) return null;
  const mobileBoardNotes = notes.filter(n => n.boardId === activeBoardId);
  const tasks = mobileBoardNotes.filter(n => n.type === "task");
  const thoughts = mobileBoardNotes.filter(n => n.type === "thought");
  const mobileActiveBoard = boards.find(b => b.id === activeBoardId);
  const isThoughtBoard = mobileActiveBoard?.type === "thought";

  const pendingTasks = tasks.filter(t => !(t.completed || (t.steps.length > 0 && t.steps.every(s => s.done))));
  const doneTasks = tasks.filter(t => t.completed || (t.steps.length > 0 && t.steps.every(s => s.done)));

  // Color helpers using page theme (not boardTheme)
  function mobileGetBg(importance: Importance | undefined) {
    if (!importance || importance === "none") return theme === "dark" ? "#1e2126" : "#f4f4f1";
    const entry = taskPaletteEntry(importance as "High"|"Medium"|"Low");
    const c = entry ? entry.swatch : PRIORITY_COLORS[importance as "High"|"Medium"|"Low"];
    return clampCardBg(blendHex(c, theme === "dark" ? "#12141a" : "#ffffff", theme === "dark" ? 0.26 : 0.30), theme === "dark" ? "#13151a" : "#f4f4f1", 28);
  }
  function mobileGetBorder(importance: Importance | undefined, done: boolean) {
    if (done) return `1.5px solid ${theme === "dark" ? "rgba(60,180,90,.30)" : "rgba(60,180,90,.45)"}`;
    if (!importance || importance === "none") return `1px solid ${border(theme)}`;
    const entry = taskPaletteEntry(importance as "High"|"Medium"|"Low");
    const c = entry ? entry.swatch : PRIORITY_COLORS[importance as "High"|"Medium"|"Low"];
    return `1.5px solid ${hexToRgba(c, theme === "dark" ? 0.28 : 0.42)}`;
  }

  function dueLabelAndColor(dueDate: string | undefined, dueTime?: string): [string, string] {
    if (!dueDate) return ["", muted(theme)];
    const today = todayStr();
    const tomorrow = tomorrowStr();
    const timeStr = fmtTime(dueTime);
    if (dueDate < today) return ["Overdue",  theme === "dark" ? "#ff6666" : "#c03030"];
    if (dueDate === today) return [`Due Today${timeStr}`, theme === "dark" ? "#ffb347" : "#b86800"];
    if (dueDate === tomorrow) return [`Tomorrow${timeStr}`, muted(theme)];
    const [y, m, d] = dueDate.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    return [`${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}${timeStr}`, muted(theme)];
  }

  function mobileCreateNote() {
    if (!mobileAddTitle.trim()) return;
    if (mobileAddMode === "task" && !mobileAddDueDate) return;
    const id = genId();
    const now = new Date().toISOString();
    // Spawn at viewport center (or board center if no viewport), non-overlapping
    const viewport = viewportRef.current;
    const vpCx = viewport ? (viewport.clientWidth  / 2 - pan.x) / scale - NOTE_W / 2 : BOARD_W / 2;
    const vpCy = viewport ? (viewport.clientHeight / 2 - pan.y) / scale - NOTE_H / 2 : BOARD_H / 2;
    const boardNotes = notes.filter(n => n.boardId === activeBoardId);
    const { x: spawnX, y: spawnY } = findFreeSpot(boardNotes, vpCx, vpCy);
    const newNote = {
      id, boardId: activeBoardId,
      type: mobileAddMode === "thought" ? "thought" : "task",
      title: mobileAddTitle.trim(), body: mobileAddBody.trim(),
      importance: mobileAddMode === "task" ? mobileAddImportance : "none",
      dueDate: (mobileAddMode === "task" && mobileAddDueDate) ? mobileAddDueDate : undefined,
      dueTime: (mobileAddMode === "task" && mobileAddDueTime) ? mobileAddDueTime : undefined,
      createdAt: now, completed: false,
      x: spawnX, y: spawnY,
      steps: [], showFlow: false, flowMode: "web", linkedNoteIds: [],
      colorIdx: mobileAddMode === "thought"
        ? (mobileAddColorIdx !== undefined ? mobileAddColorIdx : (thoughtColorMode === "random" ? Math.floor(Math.random() * NOTE_PALETTE.length) : thoughtFixedColorIdx))
        : undefined,
      remindAt: mobileAddRemindAt && mobileAddRemindAt > Date.now() ? mobileAddRemindAt : undefined,
    } as Note;
    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    if (newNote.remindAt) scheduleReminder(id, newNote.title, newNote.remindAt);
    setMobileAddTitle(""); setMobileAddBody(""); setMobileAddImportance("Low"); setMobileAddDueDate(""); setMobileAddDueTime(""); setMobileAddMode(null);
    setMobileAddColorIdx(undefined); setMobileAddRemindAt(null);
    // Build state with new note immediately and push — don't wait for debounce or effect timing
    if (isSignedIn) {
      latestBoardStateRef.current = boardStateWith(updatedNotes);
      pushToCloud();
    }
  }

  // Plain render functions (not React components) so focus state updates work correctly
  const dotBtn: CSSProperties = { flexShrink: 0, width: 28, height: 28, borderRadius: 8, backgroundColor: "transparent", border: `1px solid ${border(theme)}`, color: muted(theme), fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: ".05em" };

  function openEdit(note: Note) {
    setMobileActionNoteId(note.id);
    setMobileEditTitle(note.title);
    setMobileEditDueDate(note.dueDate ?? "");
    setMobileEditDueTime(note.dueTime ?? "");
    setMobileEditImportance(note.importance ?? "none");
    setMobileEditMinutes(note.minutes != null ? String(note.minutes) : "");
    setMobileEditSteps(note.steps.map(s => ({ id: s.id, title: s.title, minutes: s.minutes ?? 25 })));
    setMobileEditColorIdx(note.colorIdx);
    setEditBody(note.body ?? "");
    setEditRemindAt(note.remindAt && note.remindAt > Date.now() ? note.remindAt : null);
  }

  // The tour points at the most recently created card on this board (ids are timestamps).
  const newestNoteId = notes.filter(n => n.boardId === activeBoardId).reduce<number | null>((max, n) => (max === null || n.id > max ? n.id : max), null);

  function renderTaskCard(note: Note) {
    const isDone = note.completed || (note.steps.length > 0 && note.steps.every(s => s.done));
    const imp = note.importance === "none" ? undefined : note.importance;
    const bg = isDone ? (theme === "dark" ? "#0d2218" : "#eef9f2") : mobileGetBg(imp);
    const today = todayStr();
    const isOverdue = !isDone && !!note.dueDate && note.dueDate < today;
    const dueToday = !isDone && note.dueDate === today;
    const bord = isOverdue
      ? "1.5px solid rgba(210,50,50,.65)"
      : dueToday
      ? "1.5px solid rgba(200,130,20,.6)"
      : mobileGetBorder(imp, isDone);
    const [dueLabel, dueColor] = dueLabelAndColor(note.dueDate, note.dueTime);
    const isExpanded = mobileExpandedIds.has(note.id);
    const impEntry = imp ? taskPaletteEntry(imp) : null;
    const impColor = impEntry ? impEntry.swatch : priorityColor(imp, theme);
    const doneDots = note.steps.filter(s => s.done).length;
    const hasSteps = note.steps.length > 0;

    return (
      <div key={note.id} data-tour={note.id === newestNoteId ? "newest-card" : undefined} style={{ borderRadius: 14, backgroundColor: bg, border: bord, marginBottom: 9, ...(isOverdue ? { boxShadow: "0 0 0 3px rgba(210,50,50,.13)", animation: "overduePulse 1.6s ease-in-out infinite" } : dueToday ? { boxShadow: "0 0 0 3px rgba(200,130,20,.12)" } : {}) }}>
        {/* Top meta row */}
        <div style={{ padding: "10px 12px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1, fontSize: 10, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: isDone ? (theme === "dark" ? "rgba(100,220,120,.8)" : "rgba(30,120,60,.7)") : (imp ? impColor : muted(theme)), opacity: isDone ? 1 : 0.75 }}>
            {isDone ? "Completed" : (imp ? `${imp} priority` : "Task")}
          </span>
          {!isDone && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {note.remindAt && note.remindAt > Date.now() && (
                <span title={`Email reminder ${formatReminder(note.remindAt)}`} aria-label={`Email reminder ${formatReminder(note.remindAt)}`} style={{ display: "inline-flex", color: muted(theme), opacity: .8 }}><BellIcon size={11} /></span>
              )}
              {dueLabel && <span style={{ fontSize: 10, fontWeight: 600, color: dueColor, backgroundColor: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", border: `1px solid ${dueColor}44`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" }}>{dueLabel}</span>}
            </div>
          )}
          <button type="button" onClick={() => openEdit(note)} style={{ ...dotBtn, marginLeft: 2 }}>···</button>
        </div>
        {/* Title + Focus */}
        <div style={{ padding: "4px 14px 13px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: isDone ? muted(theme) : pageText(theme), textDecoration: isDone ? "line-through" : "none", lineHeight: 1.3, wordBreak: "break-word", opacity: isDone ? .5 : 1 }}>{note.title}</div>
            {(note.totalTimeSpent ?? 0) > 0 && <div style={{ fontSize: 11, color: muted(theme), opacity: .7, marginTop: 3 }}>{fmtFocusTime(note.totalTimeSpent ?? 0)} focused</div>}
            {hasSteps && (
              <button
                type="button"
                onClick={() => setMobileExpandedIds(prev => { const n = new Set(prev); n.has(note.id) ? n.delete(note.id) : n.add(note.id); return n; })}
                style={{ background: "none", border: "none", padding: "6px 0 0", cursor: "pointer", display: "flex", gap: 5, alignItems: "center" }}
              >
                {note.steps.map(s => (
                  <span key={s.id} style={{ width: 8, height: 8, borderRadius: "50%", border: s.done ? "1px solid #3d8b40" : `1px solid ${theme === "dark" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.18)"}`, backgroundColor: s.done ? "#6fc46b" : "transparent", display: "inline-block", flexShrink: 0 }} />
                ))}
                <span style={{ fontSize: 11, color: muted(theme), opacity: .6, marginLeft: 2 }}>{doneDots}/{note.steps.length}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .18s", opacity: .45 }}>
                  <polyline points="2,3.5 5,6.5 8,3.5" stroke={pageText(theme)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
          {!isDone && (
            <button
              type="button"
              data-tour={note.id === newestNoteId ? "focus-button" : undefined}
              onClick={() => startFocus(note.id, note.steps.length > 0)}
              style={{ flexShrink: 0, height: 34, borderRadius: 999, backgroundColor: theme === "dark" ? "#111315" : "#171613", color: "#f7f8fb", border: "none", padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginTop: 2 }}
            >
              Focus
            </button>
          )}
        </div>
        {/* Expanded subtasks */}
        {isExpanded && hasSteps && (
          <div style={{ borderTop: `1px solid ${border(theme)}`, padding: "10px 14px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
            {note.steps.map(step => (
              <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", border: step.done ? "1px solid #3d8b40" : `1px solid ${theme === "dark" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.22)"}`, backgroundColor: step.done ? "#6fc46b" : "transparent", display: "inline-block", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: step.done ? muted(theme) : pageText(theme), opacity: step.done ? .5 : 1, textDecoration: step.done ? "line-through" : "none" }}>{step.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderIdeaCard(note: Note) {
    const idx = note.colorIdx ?? 0;
    const palette = NOTE_PALETTE[idx % NOTE_PALETTE.length];
    const bg = theme === "dark" ? palette.dark : palette.light;
    const bord = palette.halo.replace(/[\d.]+\)$/, theme === "dark" ? "0.45)" : "0.55)");
    const createdStr = note.createdAt ? new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    return (
      <div key={note.id} data-tour={note.id === newestNoteId ? "newest-card" : undefined} style={{ borderRadius: 14, backgroundColor: bg, border: `1.5px solid ${bord}`, marginBottom: 9, padding: "11px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: palette.swatch, opacity: .75 }}>Idea</div>
              {createdStr && <div style={{ fontSize: 10, color: muted(theme), opacity: .45 }}>· {createdStr}</div>}
              {note.remindAt && note.remindAt > Date.now() && (
                <button type="button" onClick={() => openEdit(note)} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: pageText(theme), opacity: .75, background: theme === "dark" ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.7)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                  <BellIcon size={10} />{formatReminder(note.remindAt)}
                </button>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: pageText(theme), lineHeight: 1.35, wordBreak: "break-word" }}>{note.title}</div>
            {note.body && <div style={{ fontSize: 13, color: muted(theme), marginTop: 5, lineHeight: 1.5, opacity: .7 }}>{note.body}</div>}
          </div>
          <button onClick={() => openEdit(note)} style={{ ...dotBtn, marginTop: 2 }}>···</button>
        </div>
      </div>
    );
  }

  // Edit action sheet for currently open note
  const actionNote = mobileActionNoteId !== null ? notes.find(n => n.id === mobileActionNoteId) : null;

  return (
    <div style={{ padding: "0 0 100px" }}>
      {/* BOB — above board switcher */}
      <div data-tour="bob" style={{ padding: "8px 16px 4px" }}>
        <BobAgent
          theme={theme}
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
          settings={{ taskColorMode, taskHighColorIdx, taskMedColorIdx, taskLowColorIdx, taskSingleColorIdx, thoughtColorMode, thoughtFixedColorIdx, boardTheme: theme, boardGrid, activeBoardType: activeBoard?.type as "task" | "thought" | undefined, activeBoardName: activeBoard?.name, boards: boards.map(b => ({ id: b.id, name: b.name, type: b.type as "task" | "thought" })) }}
          focusStats={focusStatsData ?? undefined}
          mobile
        />
      </div>

      {/* Board switcher */}
      {/* Board picker on the left; stats, theme and settings on the right */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 10, paddingTop: 8, paddingLeft: 16, paddingRight: 16 }}>
      {/* One pill for the current board; it opens a dropdown with every board, so the row never overflows */}
      <div style={{ position: "relative", flex: 1, minWidth: 140 }}>
        <button
          data-tour="boards"
          aria-haspopup="menu"
          aria-expanded={boardMenuOpen}
          onClick={() => setBoardMenuOpen(o => !o)}
          style={{ width: "100%", height: 38, borderRadius: 999, border: "none", backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", display: "flex", alignItems: "center", gap: 8, padding: "0 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          <span style={{ flex: 1, minWidth: 0, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeBoard?.name ?? "Boards"}</span>
          <span aria-label={`${boards.length} ${boards.length === 1 ? "board" : "boards"}`} style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, lineHeight: 1, borderRadius: 999, padding: "3px 7px", backgroundColor: theme === "dark" ? "rgba(0,0,0,.1)" : "rgba(255,255,255,.16)" }}>{boards.length}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transform: boardMenuOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
            <polyline points="2,3.5 5,6.5 8,3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {boardMenuOpen && (
          <>
            {/* Tap anywhere else to close */}
            <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setBoardMenuOpen(false)} />
            <div role="menu" style={{ position: "absolute", top: 44, left: 0, zIndex: 41, width: "min(260px, calc(100vw - 32px))", maxHeight: "60vh", overflowY: "auto", backgroundColor: theme === "dark" ? "#1e2126" : "#ffffff", borderRadius: 16, padding: 6, boxShadow: theme === "dark" ? "0 18px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08)" : "0 18px 40px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06)" }}>
              {boards.map(b => {
                const isActive = b.id === activeBoardId;
                return (
                  <button
                    key={b.id}
                    role="menuitem"
                    onClick={() => { setActiveBoardId(b.id); setBoardMenuOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, height: 44, borderRadius: 10, border: "none", padding: "0 10px", backgroundColor: isActive ? (theme === "dark" ? "rgba(255,255,255,.08)" : "#f1efe9") : "transparent", color: pageText(theme), fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                  >
                    <span style={{ width: 16, flexShrink: 0, display: "flex", justifyContent: "center" }}>{isActive && <CheckIcon size={14} strokeWidth={2.4} />}</span>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: muted(theme), opacity: .8 }}>{b.type === "task" ? "Tasks" : "Ideas"}</span>
                  </button>
                );
              })}
              <div style={{ height: 1, backgroundColor: border(theme), margin: "4px 6px" }} />
              <button
                role="menuitem"
                onClick={() => { setBoardMenuOpen(false); setMobileBoardTypePicker(true); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, height: 44, borderRadius: 10, border: "none", padding: "0 10px", background: "transparent", color: muted(theme), fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              ><span style={{ width: 16, display: "flex", justifyContent: "center" }}><PlusIcon size={14} /></span>New board</button>
              <button
                role="menuitem"
                onClick={() => { setBoardMenuOpen(false); setMobileBoardActionId(activeBoardId); setMobileBoardRename(activeBoard?.name ?? ""); setMobileBoardRenaming(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, height: 44, borderRadius: 10, border: "none", padding: "0 10px", background: "transparent", color: muted(theme), fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              ><span style={{ width: 16, display: "flex", justifyContent: "center" }}><PencilIcon size={14} /></span>Rename or delete “{activeBoard?.name}”</button>
            </div>
          </>
        )}
      </div>
        {/* Soft fade divider, then the stats/theme/settings strip, which scrolls (with a fade) if the screen is too narrow */}
        <div aria-hidden style={{ flexShrink: 0, width: 1, height: 26, margin: "0 3px", background: `linear-gradient(180deg, transparent, ${theme === "dark" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.18)"}, transparent)` }} />
        <FadeScroll style={{ flex: "0 1 auto" }}>
          <button
            type="button"
            data-tour="sync"
            aria-label={syncLabel(isSignedIn ? cloudSyncState : "signedOut", "tap")}
            onClick={!isSignedIn ? () => openSignIn() : cloudSyncState === "error" ? () => { setCloudSyncState("loading"); pushToCloud(); } : undefined}
            style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 999, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#1e2126" : "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: !isSignedIn || cloudSyncState === "error" ? "pointer" : "default" }}
          >
            <SyncCloud state={isSignedIn ? cloudSyncState : "signedOut"} size={17} />
          </button>
          <button
            data-tour="focus-stats"
            onClick={() => setProfileOpen(true)}
            style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 999, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#1e2126" : "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            aria-label="Focus stats"
          >
            {(focusStatsData?.currentStreak ?? 0) > 0
              ? <svg width="10" height="13" viewBox="0 0 11 15" fill="none" overflow="visible" style={{ animation: "boltSpark 1.4s ease-in-out infinite" }}><path d="M7 1L1 8.5h4L3.5 14 10 6H6L7 1Z" fill="#facc15"/></svg>
              : <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={muted(theme)} strokeWidth="1.4"/><path d="M7 4v3l2 1.5" stroke={muted(theme)} strokeWidth="1.3" strokeLinecap="round"/></svg>
            }
          </button>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} size={38} hoverTip={false} />
          <button
              data-tour="settings"
              aria-label="Settings"
              onClick={() => setMobileSettingsOpen(true)}
              style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 999, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#1e2126" : "#ffffff", color: muted(theme), cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
        </FadeScroll>
      </div>

      {/* Board type picker sheet */}
      {mobileBoardTypePicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end" }} onClick={() => setMobileBoardTypePicker(false)}>
          <div style={{ width: "100%", backgroundColor: theme === "dark" ? "#1a1d22" : "#ffffff", borderRadius: "20px 20px 0 0", padding: "20px 16px 36px", display: "flex", flexDirection: "column", gap: 10 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 700, color: muted(theme), marginBottom: 4, textAlign: "center" }}>New Board</div>
            <button onClick={() => { addBoard("task"); setMobileBoardTypePicker(false); }} style={{ height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#23262b" : "#f4f4f1", color: pageText(theme), fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Task Board</button>
            <button onClick={() => { addBoard("thought"); setMobileBoardTypePicker(false); }} style={{ height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#23262b" : "#f4f4f1", color: pageText(theme), fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Idea Board</button>
            <button onClick={() => setMobileBoardTypePicker(false)} style={{ height: 44, borderRadius: 12, border: "none", background: "none", color: muted(theme), fontSize: 14, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Board action sheet (rename / delete) */}
      {mobileBoardActionId && (() => {
        const actionBoard = boards.find(b => b.id === mobileBoardActionId);
        if (!actionBoard) return null;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, backgroundColor: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end" }} onClick={() => { setMobileBoardActionId(null); setMobileBoardRenaming(false); }}>
            <div style={{ width: "100%", backgroundColor: theme === "dark" ? "#1a1d22" : "#ffffff", borderRadius: "20px 20px 0 0", padding: "20px 16px 36px", display: "flex", flexDirection: "column", gap: 10 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: muted(theme), marginBottom: 4, textAlign: "center" }}>{actionBoard.name}</div>
              {mobileBoardRenaming ? (
                <>
                  <input
                    autoFocus
                    value={mobileBoardRename}
                    onChange={e => setMobileBoardRename(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && mobileBoardRename.trim()) { setBoards(bs => bs.map(b => b.id === mobileBoardActionId ? { ...b, name: mobileBoardRename.trim() } : b)); setMobileBoardActionId(null); setMobileBoardRenaming(false); } if (e.key === "Escape") { setMobileBoardActionId(null); setMobileBoardRenaming(false); } }}
                    style={{ height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#23262b" : "#f4f4f1", color: pageText(theme), fontSize: 15, padding: "0 16px", outline: "none" }}
                    placeholder="Board name"
                  />
                  <button
                    onClick={() => { if (mobileBoardRename.trim()) { setBoards(bs => bs.map(b => b.id === mobileBoardActionId ? { ...b, name: mobileBoardRename.trim() } : b)); setMobileBoardActionId(null); setMobileBoardRenaming(false); } }}
                    disabled={!mobileBoardRename.trim()}
                    style={{ height: 48, borderRadius: 12, border: "none", backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: mobileBoardRename.trim() ? 1 : 0.4 }}
                  >Save</button>
                </>
              ) : (
                <>
                  <button onClick={() => setMobileBoardRenaming(true)} style={{ height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "#23262b" : "#f4f4f1", color: pageText(theme), fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Rename</button>
                  {boards.length > 1 && (
                    <button onClick={() => { deleteBoard(mobileBoardActionId); setMobileBoardActionId(null); }} style={{ height: 48, borderRadius: 12, border: `1px solid rgba(200,50,50,.35)`, backgroundColor: theme === "dark" ? "rgba(200,50,50,.12)" : "rgba(200,50,50,.07)", color: theme === "dark" ? "#ff8080" : "#c03030", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Delete Board</button>
                  )}
                </>
              )}
              <button onClick={() => { setMobileBoardActionId(null); setMobileBoardRenaming(false); }} style={{ height: 44, borderRadius: 12, border: "none", background: "none", color: muted(theme), fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* Not signed in hint — only show once Clerk has confirmed the session state */}
      {clerkLoaded && !isSignedIn && (
        <div style={{ marginBottom: 20, marginLeft: 16, marginRight: 16, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: paper(theme), padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, backgroundColor: theme === "dark" ? "#23262b" : "#f0f0ee", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={muted(theme)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".7">
              <rect x="1.5" y="3" width="15" height="10" rx="1.5"/>
              <line x1="5.5" y1="16" x2="12.5" y2="16"/>
              <line x1="9" y1="13" x2="9" y2="16"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: pageText(theme), marginBottom: 2 }}>See the full board on iPad or Mac</div>
            <div style={{ fontSize: 12, color: muted(theme), opacity: .7, lineHeight: 1.4 }}>Sign in on a larger screen for the interactive board.</div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isSignedIn && cloudSyncState === "loading" && (
        <div style={{ textAlign: "center", padding: "52px 0", color: muted(theme), fontSize: 13, opacity: .5 }}>Loading your boards…</div>
      )}

      {/* Filter + sort bar (task boards only) */}
      {!isThoughtBoard && !(isSignedIn && cloudSyncState === "loading") && (
        <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", alignItems: "center", overflowX: "auto", scrollbarWidth: "none" }}>
          {(["all", "High", "Medium", "Low"] as const).map(f => {
            const active = mobileFilterPriority === f;
            const col = f === "all" ? muted(theme) : PRIORITY_COLORS[f as "High"|"Medium"|"Low"];
            return (
              <button type="button" key={f} onClick={() => setMobileFilterPriority(f)}
                style={{ flexShrink: 0, height: 28, borderRadius: 999, border: active ? `1.5px solid ${col}` : `1px solid ${border(theme)}`, backgroundColor: active && f !== "all" ? hexToRgba(PRIORITY_COLORS[f as "High"|"Medium"|"Low"], 0.12) : "transparent", color: active ? col : muted(theme), fontSize: 11, fontWeight: 700, padding: "0 11px", cursor: "pointer" }}
              >{f === "all" ? "All" : f}</button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setMobileSortDate(s => !s)}
            style={{ flexShrink: 0, height: 28, borderRadius: 999, border: mobileSortDate ? `1.5px solid ${muted(theme)}` : `1px solid ${border(theme)}`, backgroundColor: "transparent", color: muted(theme), fontSize: 11, fontWeight: 700, padding: "0 11px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="3" x2="9" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="2.5" y1="5.5" x2="7.5" y2="5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="4" y1="8" x2="6" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {mobileSortDate ? "By date" : "Default"}
          </button>
        </div>
      )}

      <div style={{ padding: "0 16px", display: isSignedIn && cloudSyncState === "loading" ? "none" : undefined }}>
        {!isThoughtBoard && (() => {
          let filtered = pendingTasks.filter(t =>
            mobileFilterPriority === "all" || (t.importance === mobileFilterPriority)
          );
          if (mobileSortDate) {
            filtered = [...filtered].sort((a, b) => {
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return a.dueDate < b.dueDate ? -1 : 1;
            });
          }
          return (
            <>
              {filtered.length === 0 && doneTasks.length === 0 && (
                <div style={{ textAlign: "center", padding: "52px 0 20px", color: muted(theme), fontSize: 14, opacity: .45 }}>
                  {pendingTasks.length === 0 ? "No tasks yet — tap + to add one" : "No tasks match this filter"}
                </div>
              )}
              {filtered.map(note => renderTaskCard(note))}
              {doneTasks.length > 0 && mobileFilterPriority === "all" && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: muted(theme), opacity: .4, marginTop: filtered.length > 0 ? 20 : 0, marginBottom: 10 }}>Completed</div>
                  {doneTasks.map(note => renderTaskCard(note))}
                </>
              )}
            </>
          );
        })()}
        {isThoughtBoard && (
          <>
            {thoughts.length === 0 && (
              <div style={{ textAlign: "center", padding: "52px 0 20px", color: muted(theme), fontSize: 14, opacity: .45 }}>No ideas yet — tap + to add one</div>
            )}
            {thoughts.map(note => renderIdeaCard(note))}
          </>
        )}
      </div>

      {/* Quick-add bottom sheet */}
      {/* Mobile settings sheet */}
      {mobileSettingsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", flexDirection: "column" }} onClick={() => setMobileSettingsOpen(false)}>
          <div style={{ position: "relative", flex: 1, backgroundColor: theme === "dark" ? "#13151a" : "#f4f4f1", overflowY: "auto", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: `1px solid ${border(theme)}`, position: "sticky", top: 0, backgroundColor: theme === "dark" ? "#13151a" : "#f4f4f1", zIndex: 1 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: pageText(theme) }}>Settings</span>
              <button onClick={() => setMobileSettingsOpen(false)} style={{ width: 32, height: 32, borderRadius: 999, border: `1px solid ${border(theme)}`, background: "transparent", color: pageText(theme), fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><CloseIcon size={14} /></button>
            </div>

            <div style={{ padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 28 }}>

              {/* Only the colors for the board you're on */}
              {/* Idea colors */}
              {isThoughtBoard && (
              <div data-tour="settings-colors">
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Idea Colors</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", padding: 6, margin: -6, maxWidth: 352 }}>
                  {/* Rainbow / randomize */}
                  <button onClick={() => setThoughtColorMode("random")} style={swatchStyle(theme, RAINBOW, thoughtColorMode === "random", 22, true)} title="Randomize color" />
                  {NOTE_PALETTE.map((p, i) => (
                    <button key={i} onClick={() => { setThoughtColorMode("fixed"); setThoughtFixedColorIdx(i); }} style={swatchStyle(theme, p.swatch, (thoughtColorMode === "fixed" && thoughtFixedColorIdx === i), 22)} title={p.name} />
                  ))}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: muted(theme), lineHeight: 1.5 }}>
                  {thoughtColorMode === "random" ? "New ideas get a random color each time." : `New ideas default to ${NOTE_PALETTE[thoughtFixedColorIdx]?.name}.`}
                </p>
              </div>

              )}

              {/* Task colors */}
              {!isThoughtBoard && (
              <div data-tour="settings-colors">
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Task Colors</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 6, padding: 3, backgroundColor: theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)", borderRadius: 10, border: `1px solid ${border(theme)}` }}>
                    {(["priority", "single"] as const).map(m => (
                      <button key={m} onClick={() => setTaskColorMode(m)} style={{ flex: 1, height: 34, borderRadius: 8, border: "none", backgroundColor: taskColorMode === m ? (theme === "dark" ? "rgba(255,255,255,.12)" : "#ffffff") : "transparent", boxShadow: taskColorMode === m ? "0 1px 4px rgba(0,0,0,.12)" : "none", color: taskColorMode === m ? pageText(theme) : muted(theme), fontSize: 13, fontWeight: taskColorMode === m ? 700 : 500, cursor: "pointer", transition: "background-color .12s" }}>
                        {m === "priority" ? "By Priority" : "One Color"}
                      </button>
                    ))}
                  </div>
                  {taskColorMode === "priority" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(["High", "Medium", "Low"] as const).map(lvl => {
                        const currentIdx = lvl === "High" ? taskHighColorIdx : lvl === "Medium" ? taskMedColorIdx : taskLowColorIdx;
                        const setter = lvl === "High" ? setTaskHighColorIdx : lvl === "Medium" ? setTaskMedColorIdx : setTaskLowColorIdx;
                        const customVal = lvl === "High" ? taskHighCustom : lvl === "Medium" ? taskMedCustom : taskLowCustom;
                        const setCustom = lvl === "High" ? setTaskHighCustom : lvl === "Medium" ? setTaskMedCustom : setTaskLowCustom;
                        return (
                          <div key={lvl}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: pageText(theme), marginBottom: 6 }}>{lvl} priority</div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", justifyContent: "space-between", alignItems: "center", padding: 6, margin: -6, maxWidth: 352 }}>
                              {TASK_PALETTE.map((p, i) => (
                                <Fragment key={i}>
                                {i === TASK_DEFAULT_COUNT && <span aria-hidden style={{ width: 1, height: 16, margin: "0 3px", flexShrink: 0, backgroundColor: border(theme) }} />}
                                <button onClick={() => setter(i)} style={swatchStyle(theme, p.swatch, (currentIdx === i && currentIdx < TASK_PALETTE.length), 20)} /></Fragment>
                              ))}
                              <label style={{ position: "relative", width: 20, height: 20, flexShrink: 0, cursor: "pointer", display: "flex" }}>
                                <span style={{ ...swatchStyle(theme, customVal || RAINBOW, currentIdx >= TASK_PALETTE.length, 20, true), pointerEvents: "none" }} />
                                <input type="color"
                                  value={customVal || "#ff6600"}
                                  onClick={() => setter(TASK_PALETTE.length)}
                                  onChange={e => { setCustom(e.target.value); setter(TASK_PALETTE.length); }}
                                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: muted(theme), marginBottom: 8 }}>One color for all tasks.</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", justifyContent: "space-between", alignItems: "center", padding: 6, margin: -6, maxWidth: 352 }}>
                        {TASK_PALETTE.map((p, i) => (
                          <Fragment key={i}>
                          {i === TASK_DEFAULT_COUNT && <span aria-hidden style={{ width: 1, height: 16, margin: "0 3px", flexShrink: 0, backgroundColor: border(theme) }} />}
                          <button onClick={() => setTaskSingleColorIdx(i)} style={swatchStyle(theme, p.swatch, (taskSingleColorIdx === i && taskSingleColorIdx < TASK_PALETTE.length), 20)} /></Fragment>
                        ))}
                        <label style={{ position: "relative", width: 20, height: 20, flexShrink: 0, cursor: "pointer", display: "flex" }}>
                          <span style={{ ...swatchStyle(theme, taskSingleCustom || RAINBOW, taskSingleColorIdx >= TASK_PALETTE.length, 20, true), pointerEvents: "none" }} />
                          <input type="color"
                            value={taskSingleCustom || "#ff6600"}
                            onClick={() => setTaskSingleColorIdx(TASK_PALETTE.length)}
                            onChange={e => { setTaskSingleCustom(e.target.value); setTaskSingleColorIdx(TASK_PALETTE.length); }}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* BOB */}
              <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700 }}>BOB</div>
                  {!isPlus && <span style={{ fontSize: 10, fontWeight: 700, color: muted(theme), opacity: .6 }}>Plus</span>}
                </div>
                {isPlus ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ background: theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", border: `1px solid ${border(theme)}`, borderRadius: 12, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: pageText(theme) }}>About You</div>
                      <textarea
                        value={bobUserInfo}
                        onChange={e => setBobUserInfoFn({ userInfo: e.target.value })}
                        placeholder="Tell BOB about yourself — name, role, goals…"
                        rows={3}
                        style={{ width: "100%", boxSizing: "border-box", background: theme === "dark" ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${border(theme)}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: pageText(theme), outline: "none", lineHeight: 1.6, resize: "vertical" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: pageText(theme) }}>Auto-send voice messages</div>
                        <div style={{ fontSize: 11.5, color: muted(theme), marginTop: 2 }}>When you talk to BOB with the mic, your message sends once you stop speaking. Off: review it, then press send.</div>
                      </div>
                      <button onClick={() => { const v = !bobAutoSend; setBobAutoSend(v); try { localStorage.setItem("bob_auto_send", String(v)); } catch {} }} style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", backgroundColor: bobAutoSend ? (theme === "dark" ? "#4a9eff" : "#2563eb") : (theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"), position: "relative", transition: "background-color .18s" }}>
                        <span style={{ position: "absolute", top: 4, left: bobAutoSend ? 23 : 4, width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff", transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", border: `1px solid ${border(theme)}`, borderRadius: 12, padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: pageText(theme) }}>BOB is a Plus feature</div>
                    <p style={{ margin: 0, fontSize: 12, color: muted(theme), lineHeight: 1.55 }}>An AI helper that plans your day and adds tasks for you.</p>
                    <button onClick={() => { setMobileSettingsOpen(false); setUpgradeOpen(true); }} style={{ padding: "7px 18px", borderRadius: 99, border: "none", cursor: "pointer", background: theme === "dark" ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)", color: pageText(theme), fontSize: 12, fontWeight: 700 }}>Upgrade to Plus →</button>
                  </div>
                )}
              </div>

              {/* Email */}
              <EmailSettings theme={theme} large />

              {/* Calendar */}
              <div data-tour="settings-calendar" style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Calendar</div>
                <button onClick={() => { exportToIcs(); setMobileSettingsOpen(false); }} disabled={!notes.some(n => n.dueDate && !n.completed)} style={{ width: "100%", height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", color: pageText(theme), fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: notes.some(n => n.dueDate && !n.completed) ? 1 : 0.4 }}>Export tasks to calendar (.ics)</button>
                <p style={{ fontSize: 12, color: muted(theme), margin: "10px 0 0", lineHeight: 1.5 }}>Exports tasks with due dates. Opens in Apple Calendar or import into Google Calendar.</p>
              </div>

              {/* Billing */}
              {isSignedIn && (
                <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                  <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 12 }}>Billing</div>
                  <div style={{ background: theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", border: `1px solid ${border(theme)}`, borderRadius: 12, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: pageText(theme) }}>{isPlus ? "Boardtivity Plus" : "Free Plan"}</div>
                        {isPlus && subscription?.currentPeriodEnd && <div style={{ fontSize: 11.5, color: muted(theme), marginTop: 2 }}>Renews {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                        {isPlus && subscription?.status === "past_due" && <div style={{ fontSize: 11.5, color: "#e05555", marginTop: 2 }}>Payment past due</div>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 999, background: isPlus ? (theme === "dark" ? "rgba(74,158,255,.15)" : "rgba(37,99,235,.1)") : (theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)"), color: isPlus ? (theme === "dark" ? "#4a9eff" : "#2563eb") : muted(theme), border: `1px solid ${isPlus ? (theme === "dark" ? "rgba(74,158,255,.2)" : "rgba(37,99,235,.15)") : border(theme)}` }}>{isPlus ? "Active" : "Free"}</span>
                    </div>
                    {isPlus ? (
                      <button onClick={startPortal} style={{ height: 44, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", color: pageText(theme), fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Manage subscription</button>
                    ) : (
                      <button onClick={() => { setMobileSettingsOpen(false); setUpgradeOpen(true); }} style={{ height: 44, borderRadius: 10, border: "none", backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Upgrade to Plus</button>
                    )}
                  </div>
                </div>
              )}

              {/* Help */}
              <div>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Help</div>
                <button onClick={openTutorial} style={{ width: "100%", height: 48, borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", color: pageText(theme), fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9v.3" /><circle cx="12" cy="16.9" r=".6" fill="currentColor" />
                  </svg>
                  Replay the tutorial
                </button>
              </div>

              {/* Get the app */}
              <div data-tour="settings-app">
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10 }}>Get the app</div>
                <InstallAppGuide theme={theme} mobile />
              </div>

              {/* Account */}
              <div style={{ borderTop: `1px solid ${border(theme)}`, paddingTop: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 12 }}>Account</div>
                {isSignedIn ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, overflow: "hidden" }}>
                      <span style={{ fontSize: 13, color: muted(theme), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user?.emailAddresses?.[0]?.emailAddress}</span>
                      {isPlus && <span style={{ flexShrink: 0, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, color: theme === "dark" ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)", background: theme === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", border: `1px solid ${border(theme)}`, borderRadius: 999, padding: "2px 7px" }}>Plus</span>}
                    </div>
                    {/* Sync status, tap to retry on error (same as desktop) */}
                    <button
                      type="button"
                      onClick={cloudSyncState === "error" ? () => { setCloudSyncState("loading"); pushToCloud(); } : undefined}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: muted(theme), background: "none", border: "none", padding: "0 0 12px", cursor: cloudSyncState === "error" ? "pointer" : "default", fontFamily: "inherit" }}
                    >
                      <SyncCloud state={cloudSyncState} />
                      {syncLabel(cloudSyncState, "tap")}
                    </button>
                    {confirmSignOut === "settings" ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setConfirmSignOut(null); setMobileSettingsOpen(false); signOut({ redirectUrl: "/" }); }} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${theme === "dark" ? "rgba(220,60,60,.4)" : "rgba(180,40,40,.3)"}`, backgroundColor: "transparent", color: theme === "dark" ? "#ff8080" : "#c03030", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes, sign out</button>
                        <button onClick={() => setConfirmSignOut(null)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: "transparent", color: pageText(theme), fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmSignOut("settings")} style={{ width: "100%", height: 44, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: "transparent", color: theme === "dark" ? "#ff8080" : "#c03030", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
                    )}
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: muted(theme), paddingBottom: 4 }}>
                      <SyncCloud state="signedOut" />
                      Not synced. Sign in to save your board across devices
                    </div>
                    <button onClick={() => { setMobileSettingsOpen(false); openSignUp(); }} style={{ height: 44, borderRadius: 10, border: "none", backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Sign up</button>
                    <button onClick={() => { setMobileSettingsOpen(false); openSignIn(); }} style={{ height: 44, borderRadius: 10, border: `1px solid ${border(theme)}`, backgroundColor: "transparent", color: pageText(theme), fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Sign in</button>
                  </div>
                )}
              </div>
              <div style={{ textAlign: "center", fontSize: 12, color: muted(theme) }}>
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: muted(theme), textDecoration: "none" }}>Terms</a>
                <span style={{ margin: "0 8px" }}>·</span>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: muted(theme), textDecoration: "none" }}>Privacy</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {mobileAddMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 800, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,.4)" }} onClick={() => { setMobileAddMode(null); setMobileAddTitle(""); setMobileAddBody(""); setMobileAddColorIdx(undefined); setMobileAddRemindAt(null); }} />
          <div style={{ position: "relative", backgroundColor: surface(theme), borderRadius: "20px 20px 0 0", padding: "20px 20px 36px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: muted(theme), opacity: .6, marginBottom: 2 }}>
              {mobileAddMode === "task" ? "New Task" : "New Idea"}
            </div>
            <textarea
              data-tour="composer-title"
              autoFocus
              rows={1}
              value={mobileAddTitle}
              onChange={e => { setMobileAddTitle(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && mobileAddMode === "task") { e.preventDefault(); mobileCreateNote(); } if (e.key === "Escape") { setMobileAddMode(null); setMobileAddTitle(""); setMobileAddBody(""); setMobileAddColorIdx(undefined); setMobileAddRemindAt(null); } }}
              placeholder={mobileAddMode === "task" ? "What needs to be done?" : "What's your idea?"}
              style={{ fontSize: 16, fontWeight: 600, color: pageText(theme), backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "13px 14px", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.4 }}
            />
            {mobileAddMode === "task" && (
              <>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["Low", "Medium", "High"] as Importance[]).map(imp => {
                    const active = mobileAddImportance === imp;
                    const col = PRIORITY_COLORS[imp as "High"|"Medium"|"Low"];
                    return (
                      <button key={imp} onClick={() => setMobileAddImportance(imp)}
                        style={{ flex: 1, height: 34, borderRadius: 999, border: active ? `1.5px solid ${col}` : `1px solid ${border(theme)}`, backgroundColor: active ? hexToRgba(PRIORITY_COLORS[imp as "High"|"Medium"|"Low"], 0.12) : "transparent", color: active ? col : muted(theme), fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {imp}
                      </button>
                    );
                  })}
                </div>
                <div data-tour="composer-details" style={{ display: "flex", alignItems: "center", height: 44, backgroundColor: paper(theme), border: `1.5px solid ${mobileAddDueDate ? border(theme) : (theme === "dark" ? "#8b3a3a" : "#d06060")}`, borderRadius: 12, padding: "0 14px", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: muted(theme), flex: 1 }}>Due date</span>
                  <DateField value={mobileAddDueDate} onChange={setMobileAddDueDate} style={{ display: "inline-flex", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: mobileAddDueDate ? pageText(theme) : (theme === "dark" ? "#ff8080" : "#c05050"), pointerEvents: "none" }}>
                      {mobileAddDueDate ? isoToMDY(mobileAddDueDate) : "Required"}
                    </span>
                  </DateField>
                </div>
                {mobileAddDueDate && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <input
                      type="time"
                      value={mobileAddDueTime}
                      onChange={e => setMobileAddDueTime(e.target.value)}
                      placeholder="Time (optional)"
                      style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${border(theme)}`, background: theme === "dark" ? "rgba(255,255,255,.06)" : "#fff", color: mobileAddDueTime ? pageText(theme) : muted(theme), fontSize: 14, padding: "0 10px", fontFamily: "inherit", outline: "none", colorScheme: theme === "dark" ? "dark" : "light" }}
                    />
                    {mobileAddDueTime && (
                      <button type="button" onClick={() => setMobileAddDueTime("")} style={{ background: "none", border: "none", color: muted(theme), fontSize: 16, opacity: .6, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}><CloseIcon size={14} /></button>
                    )}
                  </div>
                )}
                <div data-tour="composer-remind" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: muted(theme), letterSpacing: ".04em" }}>Remind me</span>
                  <ReminderPicker theme={theme} value={mobileAddRemindAt} onChange={setMobileAddRemindAt} morningTime={emailPrefs?.reminderTime} signedIn={!!isSignedIn} large />
                </div>
              </>
            )}
            {mobileAddMode === "thought" && (
              <>
                <textarea
                  rows={2}
                  value={mobileAddBody}
                  onChange={e => { setMobileAddBody(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  placeholder="Add notes… (optional)"
                  style={{ fontSize: 14, color: pageText(theme), backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "12px 14px", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.5 }}
                />
              </>
            )}
            {mobileAddMode === "thought" && (
              <div data-tour="composer-idea-options" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Color picker */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: muted(theme), letterSpacing: ".04em" }}>Color</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", maxWidth: 340 }}>
                    <button onClick={() => setMobileAddColorIdx(undefined)} style={swatchStyle(theme, theme === "dark" ? "#555" : "#ccc", mobileAddColorIdx === undefined, 24)} title="Grey" />
                    {NOTE_PALETTE.map((p, i) => (
                      <button key={i} onClick={() => setMobileAddColorIdx(i)} style={swatchStyle(theme, p.swatch, mobileAddColorIdx === i, 24)} />
                    ))}
                  </div>
                </div>
                {/* Remind me */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: muted(theme), letterSpacing: ".04em" }}>Remind me</span>
                  <ReminderPicker theme={theme} value={mobileAddRemindAt} onChange={setMobileAddRemindAt} morningTime={emailPrefs?.reminderTime} signedIn={!!isSignedIn} large />
                </div>
              </div>
            )}
            <button
              data-tour="composer-create"
              onClick={mobileCreateNote}
              style={{ height: 44, borderRadius: 12, backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              Add {mobileAddMode === "task" ? "Task" : "Idea"}
            </button>
          </div>
        </div>
      )}

      {/* Edit / delete action sheet */}
      {actionNote && (
        <div style={{ position: "fixed", inset: 0, zIndex: 810, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,.4)" }} onClick={() => { setMobileActionNoteId(null); setMobileDeleteConfirm(false); }} />
          <div style={{ position: "relative", backgroundColor: surface(theme), borderRadius: "20px 20px 0 0", padding: "20px 20px 36px", display: "flex", flexDirection: "column", gap: 12, maxHeight: "88vh", overflowY: "auto", overscrollBehavior: "contain" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: muted(theme), opacity: .5, marginBottom: 2 }}>Edit {actionNote.type === "task" ? "task" : "idea"}</div>
            {actionNote.type === "task" && (() => {
              const done = actionNote.completed || (actionNote.steps.length > 0 && actionNote.steps.every(s => s.done));
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 12, border: `1px solid ${border(theme)}`, backgroundColor: paper(theme) }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: done ? (theme === "dark" ? "rgba(100,220,120,.95)" : "rgba(30,120,60,.9)") : pageText(theme) }}>{done ? "Completed" : "Not done yet"}</div>
                    <div style={{ fontSize: 12, color: muted(theme), marginTop: 1 }}>{(actionNote.totalTimeSpent ?? 0) > 0 ? `${fmtFocusTime(actionNote.totalTimeSpent ?? 0)} focused so far` : "No focus time yet"}</div>
                  </div>
                  <button type="button" onClick={() => setTaskDone(actionNote.id, !done)} style={{ flexShrink: 0, height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${border(theme)}`, background: "transparent", color: pageText(theme), fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{done ? "Mark not done" : "Mark done"}</button>
                </div>
              );
            })()}
            <textarea
              rows={1}
              value={mobileEditTitle}
              onChange={e => { setMobileEditTitle(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              placeholder="Title"
              style={{ fontSize: 16, fontWeight: 600, color: pageText(theme), backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "13px 14px", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.4 }}
            />
            <textarea
              rows={2}
              value={editBody}
              onChange={e => { setEditBody(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              placeholder={actionNote.type === "task" ? "Notes… (optional)" : "Add a note… (optional)"}
              style={{ fontSize: 14, color: pageText(theme), backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "12px 14px", outline: "none", width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", lineHeight: 1.5, fontFamily: "inherit" }}
            />
            {actionNote.type === "thought" && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button
                  onClick={() => setMobileEditColorIdx(undefined)}
                  style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: theme === "dark" ? "#3a3a3a" : "#d0d0cc", border: mobileEditColorIdx === undefined ? `2.5px solid ${pageText(theme)}` : `1.5px solid transparent`, cursor: "pointer", flexShrink: 0 }}
                />
                {NOTE_PALETTE.map((col, i) => (
                  <button
                    key={i}
                    onClick={() => setMobileEditColorIdx(i)}
                    style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: col.swatch, border: mobileEditColorIdx === i ? `2.5px solid ${pageText(theme)}` : `1.5px solid transparent`, cursor: "pointer", flexShrink: 0 }}
                  />
                ))}
              </div>
            )}
            {actionNote.type === "task" && (
              <>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["none", "Low", "Medium", "High"] as Importance[]).map(imp => {
                    const active = mobileEditImportance === imp;
                    const col = imp === "none" ? muted(theme) : PRIORITY_COLORS[imp as "High"|"Medium"|"Low"];
                    return (
                      <button key={imp} onClick={() => setMobileEditImportance(imp)}
                        style={{ flex: 1, height: 34, borderRadius: 999, border: active ? `1.5px solid ${col}` : `1px solid ${border(theme)}`, backgroundColor: (active && imp !== "none") ? hexToRgba(PRIORITY_COLORS[imp as "High"|"Medium"|"Low"], 0.12) : "transparent", color: active ? col : muted(theme), fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >{imp === "none" ? "None" : imp}</button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", height: 44, backgroundColor: paper(theme), border: `1.5px solid ${border(theme)}`, borderRadius: 12, padding: "0 14px", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: muted(theme), flex: 1 }}>Due date</span>
                  {mobileEditDueDate && (
                    <button type="button" onClick={() => setMobileEditDueDate("")} style={{ background: "none", border: "none", color: muted(theme), fontSize: 13, opacity: .5, cursor: "pointer", padding: "0 2px" }}><CloseIcon size={14} /></button>
                  )}
                  <DateField value={mobileEditDueDate} onChange={setMobileEditDueDate} style={{ display: "inline-flex", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: mobileEditDueDate ? pageText(theme) : muted(theme), pointerEvents: "none" }}>
                      {mobileEditDueDate ? isoToMDY(mobileEditDueDate) : "mm-dd-yyyy"}
                    </span>
                  </DateField>
                </div>
                {mobileEditDueDate && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <input
                      type="time"
                      value={mobileEditDueTime}
                      onChange={e => setMobileEditDueTime(e.target.value)}
                      placeholder="Time (optional)"
                      style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${border(theme)}`, background: theme === "dark" ? "rgba(255,255,255,.06)" : "#fff", color: mobileEditDueTime ? pageText(theme) : muted(theme), fontSize: 14, padding: "0 10px", fontFamily: "inherit", outline: "none", colorScheme: theme === "dark" ? "dark" : "light" }}
                    />
                    {mobileEditDueTime && (
                      <button type="button" onClick={() => setMobileEditDueTime("")} style={{ background: "none", border: "none", color: muted(theme), fontSize: 16, opacity: .6, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}><CloseIcon size={14} /></button>
                    )}
                  </div>
                )}
                {/* Steps */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: muted(theme), letterSpacing: ".04em" }}>Steps</span>
                  {mobileEditSteps.map(step => {
                    const done = actionNote.steps.find(s => s.id === step.id)?.done;
                    return (
                      <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, border: done ? "1px solid #3d8b40" : `1px solid ${theme === "dark" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.22)"}`, backgroundColor: done ? "#6fc46b" : "transparent" }} />
                        <input
                          value={step.title}
                          placeholder="Step name"
                          onChange={e => setMobileEditSteps(prev => prev.map(s => s.id === step.id ? { ...s, title: e.target.value } : s))}
                          style={{ flex: 1, minWidth: 0, height: 38, fontSize: 15, fontWeight: 600, color: pageText(theme), backgroundColor: paper(theme), border: `1px solid ${border(theme)}`, borderRadius: 10, padding: "0 12px", outline: "none", fontFamily: "inherit" }}
                        />
                        <button type="button" aria-label="Remove step" onClick={() => setMobileEditSteps(prev => prev.filter(s => s.id !== step.id))} style={{ width: 34, height: 34, flexShrink: 0, background: "none", border: "none", color: muted(theme), cursor: "pointer", opacity: .6, display: "flex", alignItems: "center", justifyContent: "center" }}><CloseIcon size={15} /></button>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setMobileEditSteps(prev => [...prev, { id: genId(), title: "", minutes: 15 }])} style={{ flex: 1, height: 38, borderRadius: 10, border: `1.5px dashed ${theme === "dark" ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.22)"}`, background: "transparent", color: muted(theme), fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PlusIcon size={14} />Add step</span></button>
                    {mobileEditSteps.length === 0 && (
                      <button type="button" onClick={() => setMobileEditSteps(buildBreakdown(mobileEditTitle || actionNote.title, editBody, actionNote.minutes ?? 60, 0).map(s => ({ id: s.id, title: s.title, minutes: s.minutes ?? 15 })))} disabled={!mobileEditTitle.trim()} style={{ height: 38, borderRadius: 10, border: `1px solid ${border(theme)}`, background: "transparent", color: pageText(theme), fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "0 14px", fontFamily: "inherit", opacity: mobileEditTitle.trim() ? 1 : .4 }}>Suggest steps</button>
                    )}
                  </div>
                </div>
              </>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: muted(theme), letterSpacing: ".04em" }}>Remind me</span>
              <ReminderPicker theme={theme} value={editRemindAt} onChange={setEditRemindAt} morningTime={emailPrefs?.reminderTime} signedIn={!!isSignedIn} large
                hint={editRemindAt !== (actionNote.remindAt && actionNote.remindAt > Date.now() ? actionNote.remindAt : null) ? "Press Save to confirm this change." : undefined} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => {
                  if (!mobileEditTitle.trim()) return;
                  const parsedMins = mobileEditMinutes ? parseInt(mobileEditMinutes) : undefined;
                  const updatedNotes = notes.map(n => n.id === actionNote.id ? {
                    ...n,
                    title: mobileEditTitle.trim(),
                    importance: mobileEditImportance,
                    dueDate: mobileEditDueDate || undefined,
                    dueTime: mobileEditDueTime || undefined,
                    minutes: parsedMins && parsedMins > 0 ? parsedMins : undefined,
                    body: editBody.trim(),
                    remindAt: editRemindAt ?? undefined,
                    ...(actionNote.type === "thought" ? { colorIdx: mobileEditColorIdx } : {}),
                    steps: (() => {
                      // Keep existing steps' progress and board position; lay out new ones like the desktop editor does.
                      const kept = mobileEditSteps.filter(e => e.title.trim()).map(e => {
                        const old = n.steps.find(s => s.id === e.id);
                        return old ? { ...old, title: e.title.trim(), minutes: e.minutes } : { id: e.id, title: e.title.trim(), minutes: e.minutes, done: false, x: 0, y: 0 };
                      });
                      const laid = n.flowMode === "chain" ? layoutChain(n.x, n.y, kept) : layoutWeb(n.x, n.y, kept);
                      return kept.map((s, i) => (s.x === 0 && s.y === 0) ? laid[i] : s);
                    })(),
                  } : n);
                  setNotes(updatedNotes);
                  if ((actionNote.remindAt && actionNote.remindAt > Date.now() ? actionNote.remindAt : null) !== editRemindAt) scheduleReminder(actionNote.id, mobileEditTitle.trim() || actionNote.title, editRemindAt);
                  setMobileActionNoteId(null);
                  setMobileDeleteConfirm(false);
                  if (isSignedIn) {
                    latestBoardStateRef.current = boardStateWith(updatedNotes);
                    pushToCloud();
                  }
                }}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: theme === "dark" ? "#f5f5f2" : "#171613", color: theme === "dark" ? "#171613" : "#f7f8fb", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >Save</button>
              {mobileDeleteConfirm ? (
                <button
                  onClick={() => {
                    deleteTask(actionNote.id);
                    setMobileActionNoteId(null);
                    setMobileDeleteConfirm(false);
                    if (isSignedIn) {
                      // Push immediately with the tombstone so another device can't resurrect the task.
                      const updatedNotes = notes.filter(n => n.id !== actionNote.id).map(n => ({ ...n, linkedNoteIds: n.linkedNoteIds.filter(id => id !== actionNote.id) }));
                      latestBoardStateRef.current = boardStateWith(updatedNotes);
                      pushToCloud();
                    }
                  }}
                  style={{ height: 44, borderRadius: 12, backgroundColor: theme === "dark" ? "rgba(220,60,60,.18)" : "rgba(180,40,40,.1)", color: theme === "dark" ? "#ff8080" : "#c03030", border: `1.5px solid ${theme === "dark" ? "rgba(220,60,60,.5)" : "rgba(180,40,40,.4)"}`, padding: "0 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
                >Confirm</button>
              ) : (
                <button
                  onClick={() => setMobileDeleteConfirm(true)}
                  style={{ height: 44, borderRadius: 12, backgroundColor: "transparent", color: theme === "dark" ? "#ff8080" : "#c03030", border: `1.5px solid ${theme === "dark" ? "rgba(220,60,60,.35)" : "rgba(180,40,40,.25)"}`, padding: "0 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                >Delete</button>
              )}
            </div>
            {mobileDeleteConfirm && (
              <div style={{ fontSize: 12, color: theme === "dark" ? "#ff8080" : "#c03030", textAlign: "center", opacity: .75, marginTop: -4 }}>Tap Confirm to permanently delete</div>
            )}
          </div>
        </div>
      )}

      {/* Mobile focus overlay — rendered inside mobile section so it reliably shows on iOS */}
      {focusOpen && (() => {
        const fn = notes.find(n => n.id === focusNoteId);
        if (!fn) return null;
        const step = focusStepId ? fn.steps.find(s => s.id === focusStepId) : null;
        const totalMins = Math.floor(focusSecondsLeft / 60);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const secs = focusSecondsLeft % 60;
        const allSteps = fn.steps;
        const hasChain = focusChainMode && allSteps.length > 1;
        const currentIdx = step ? allSteps.findIndex(s => s.id === focusStepId) : -1;

        const btn: CSSProperties = { height: 48, padding: "0 24px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", backgroundColor: "rgba(255,255,255,.09)", color: "rgba(247,248,251,.85)", fontSize: 15, fontWeight: 700, cursor: "pointer" };
        const btnRed: CSSProperties = { ...btn, border: "1px solid rgba(220,60,60,.3)", backgroundColor: "rgba(220,60,60,.12)", color: "rgba(255,160,160,.8)" };
        const btnGreen: CSSProperties = { ...btn, border: "1px solid rgba(100,210,120,.3)", backgroundColor: "rgba(80,180,100,.12)", color: "rgba(120,220,130,.9)", padding: "0 36px", height: 52, fontSize: 16 };


        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 950, backgroundColor: focusCompleted ? "rgb(6,20,9)" : focusPaused ? "rgb(7,8,18)" : "rgb(6,7,10)", color: "#f7f8fb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", overflowY: "hidden", overscrollBehavior: "none" }}>
            {focusExitConfirm ? (
              <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Save your progress?</div>
                <div style={{ fontSize: 14, color: "rgba(247,248,251,.45)", marginBottom: 32, lineHeight: 1.65 }}>
                  {fmtFocusTime(Math.floor((Date.now() - focusSessionStartRef.current) / 60000))} focused — log it before you go.
                </div>
                <div style={{ display: "flex", gap: 10, width: "100%", marginBottom: 10 }}>
                  <button type="button" onClick={() => { if (focusNoteId) closeFocusWithReview(focusNoteId); }} style={{ ...btn, flex: 1 }}>Save progress</button>
                  <button type="button" onClick={() => setFocusExitConfirm(false)} style={{ ...btn, flex: 1 }}>Keep going</button>
                </div>
                <button type="button" onClick={() => { setFocusOpen(false); setFocusExitConfirm(false); setFocusPaused(false); setFocusCompleted(false); setFocusNoteId(null); setFocusStepId(null); setFocusSecondsLeft(0); setBreakSecondsLeft(0); setFocusChainMode(false); }} style={{ ...btnRed, width: "100%" }}>Exit without saving</button>
              </div>
            ) : focusCompleted ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "rgba(80,180,100,.15)", border: "1.5px solid rgba(100,210,120,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6fc46b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5" /></svg>
                </div>
                <div style={{ marginTop: 20, fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(247,248,251,.35)", fontWeight: 500 }}>Time&apos;s up</div>
                <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.25, maxWidth: 280 }}>{step ? step.title : fn.title}</div>
                <div style={{ marginTop: 10, fontSize: 14, color: "rgba(120,210,130,.7)" }}>{focusNextStep ? "Nice session." : "Nice session. Next, tell us if it's finished."}</div>
                {focusNextStep && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(247,248,251,.4)" }}>Up next — <span style={{ color: "rgba(247,248,251,.7)", fontWeight: 600 }}>{focusNextStep.title}</span></div>
                )}
                <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
                  {focusNextStep ? (
                    <>
                      <button type="button" onClick={advanceToNext} style={btnGreen}>Start next</button>
                      <button type="button" onClick={() => { if (focusNoteId) closeFocusWithReview(focusNoteId); }} style={btn}>Done</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { if (focusNoteId) closeFocusWithReview(focusNoteId); }} style={btnGreen}>Continue</button>
                  )}
                </div>
              </div>
            ) : focusPaused ? (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                <div style={{ fontSize: 13, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(247,248,251,.5)", fontWeight: 600 }}>Break</div>
                <div style={{ marginTop: 32, fontSize: 88, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {String(Math.floor(breakSecondsLeft / 60)).padStart(2,"0")}:{String(breakSecondsLeft % 60).padStart(2,"0")}
                </div>
                <div style={{ marginTop: 10, fontSize: 14, color: "rgba(247,248,251,.4)" }}>Resumes automatically</div>
                <div style={{ marginTop: 36, display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => { focusTotalSecsRef.current = focusPausedSecsRef.current; focusStartedAtRef.current = Date.now(); setFocusPaused(false); setBreakSecondsLeft(0); }} style={btn}>Resume now</button>
                  <button type="button" onClick={() => setFocusExitConfirm(true)} style={btnRed}>Exit</button>
                </div>
              </div>
            ) : (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                {hasChain && step && (
                  <div style={{ fontSize: 13, letterSpacing: ".16em", color: "rgba(247,248,251,.45)", fontWeight: 600, marginBottom: 10 }}>
                    {currentIdx + 1} / {allSteps.length}
                  </div>
                )}
                <div style={{ fontSize: 17, fontWeight: 600, color: "rgba(247,248,251,.75)", lineHeight: 1.4, maxWidth: 300, marginBottom: 28 }}>{step ? step.title : fn.title}</div>
                <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {hrs > 0 ? `${hrs}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}` : `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`}
                </div>
                <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                  {focusTotalSecsRef.current >= 30 * 60 && (
                    <button type="button" onClick={() => { focusPausedSecsRef.current = focusSecondsLeft; setFocusPaused(true); setBreakSecondsLeft(300); }} style={btn}>5 min break</button>
                  )}
                  <button type="button" onClick={() => setFocusExitConfirm(true)} style={btnRed}>Exit</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* FAB */}
      <button
        data-tour="add-task"
        onClick={() => { setMobileAddMode(isThoughtBoard ? "thought" : "task"); setMobileAddTitle(""); setMobileAddBody(""); setMobileAddImportance("Low"); setMobileAddDueDate(""); setMobileAddColorIdx(undefined); setMobileAddRemindAt(null); }}
        style={{ position: "fixed", bottom: 24, right: 20, height: 42, borderRadius: 999, backgroundColor: theme === "dark" ? "#23262b" : "#ffffff", color: theme === "dark" ? "#f5f5f2" : "#433d35", border: `1px solid ${border(theme)}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "0 18px 0 14px", boxShadow: "0 4px 20px rgba(0,0,0,.22)", zIndex: 100, fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        {isThoughtBoard ? "Add Idea" : "Add Task"}
      </button>
    </div>
  );
}
