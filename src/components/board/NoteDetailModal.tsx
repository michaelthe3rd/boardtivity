"use client";

import type { CSSProperties } from "react";
import type { Importance } from "@/lib/board";
import { NOTE_PALETTE, paletteBg} from "@/lib/colors";
import { pageText, muted, border, panel, buttonStyle, circleButton, pill } from "@/lib/ui";
import { isoToMDY, formatDate, todayStr, fmtTime} from "@/lib/dates";
import { genId, layoutWeb, layoutChain } from "@/lib/boardLayout";
import { buildBreakdown } from "@/lib/breakdown";
import DateField from "@/components/ui/DateField";
import LockIcon from "@/components/ui/LockIcon";
import { useHome } from "@/components/home/HomeContext";

// Task/idea detail: view and edit fields, subtasks, focus launch and actions.
export default function NoteDetailModal() {
  const {
    toggleNoteLock,
    boardTheme, setNotes, setDetailNoteId, detailEditing, setDetailEditing, detailEditTitle, setDetailEditTitle, detailEditBody,
    setDetailEditBody, detailEditDueDate, setDetailEditDueDate, detailEditDueTime, setDetailEditDueTime, detailEditImportance, setDetailEditImportance, detailEditMinutes,
    setDetailEditMinutes, detailEditSteps, setDetailEditSteps, detailEditColorIdx, setDetailEditColorIdx, detailBreakdownVariant, setDetailBreakdownVariant, confirmDeleteId,
    setConfirmDeleteId, isMobile, activeNotes, getBg, detailNote, setFlowMode, toggleFlow, deleteTask,
    startFocus, scheduleDueDateReminder,
  } = useHome();
  if (!(detailNote)) return null;
  // Shared look for the editable due date, time and priority fields so they all read as inputs.
  const editField: CSSProperties = {
    width: "100%", minHeight: 34, background: panel(boardTheme), border: `1px solid ${border(boardTheme)}`, borderRadius: 8,
    padding: "6px 10px", fontSize: 13, color: pageText(boardTheme), fontFamily: "inherit", boxSizing: "border-box", outline: "none",
  };
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 32,
        backgroundColor: boardTheme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) { setDetailNoteId(null); setDetailEditing(false); }
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          backgroundColor: boardTheme === "dark" ? "#1f2329" : "#fbf8f1",
          color: pageText(boardTheme),
          borderRadius: 16,
          border: `1px solid ${border(boardTheme)}`,
          boxShadow: "0 30px 100px rgba(0,0,0,.28)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${border(boardTheme)}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme) }}>
                {detailEditing ? `Editing ${detailNote.type}` : detailNote.type === "task" ? "Task details" : "Idea"}
              </div>
              {detailNote.createdAt && !detailEditing && (
                <div style={{ fontSize: 11, color: muted(boardTheme), opacity: .5 }}>
                  · Created {new Date(detailNote.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{detailNote.title}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {!detailEditing && (
              <button
                onClick={() => {
                  setDetailEditTitle(detailNote.title);
                  setDetailEditBody(detailNote.body ?? "");
                  setDetailEditDueDate(detailNote.dueDate ?? "");
                  setDetailEditDueTime(detailNote.dueTime ?? "");
                  setDetailEditImportance(detailNote.importance ?? "none");
                  setDetailEditMinutes(detailNote.minutes ?? 60);
                  setDetailEditSteps(detailNote.steps.map(s => ({ ...s })));
                  setDetailEditColorIdx(detailNote.colorIdx);
                  setDetailEditing(true);
                }}
                style={{ ...circleButton(boardTheme, 36), fontSize: 14 }}
                title={detailNote.type === "task" ? "Edit task" : "Edit idea"}
              >✎</button>
            )}
            {!detailEditing && (
              <button
                onClick={() => toggleNoteLock(detailNote.id)}
                style={{
                  ...circleButton(boardTheme, 36),
                  ...(detailNote.locked ? { backgroundColor: pageText(boardTheme), color: panel(boardTheme), border: "none" } : {}),
                }}
                title={detailNote.locked ? "Unlock position (or right-click / long-press the card)" : "Lock position (or right-click / long-press the card)"}
                aria-pressed={!!detailNote.locked}
                aria-label={detailNote.locked ? "Unlock position" : "Lock position"}
              >
                <LockIcon locked={!!detailNote.locked} size={15} />
              </button>
            )}
            <button onClick={() => { setDetailNoteId(null); setDetailEditing(false); }} style={circleButton(boardTheme, 36)}>✕</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: (detailNote.type === "task" && !isMobile) ? "1fr 272px" : "1fr", gap: 14, padding: 18, maxHeight: "calc(90vh - 96px)", overflow: "hidden" }}>
          {/* Left: focus card + subtasks */}
          {/* Left panel — green when completed OR all steps done */}
          {(() => {
            const effectiveDone = detailNote.completed || (detailNote.steps.length > 0 && detailNote.steps.every(s => s.done));
            // Auto-mark complete if all steps done
            if (!detailNote.completed && effectiveDone) {
              setNotes(ns => ns.map(n => n.id === detailNote.id ? { ...n, completed: true } : n));
            }
            return null;
          })()}
          <div style={{ borderRadius: 13, backgroundColor: (detailNote.completed || (detailNote.steps.length > 0 && detailNote.steps.every(s => s.done))) ? (boardTheme === "dark" ? "#0e2e18" : "#e6f9ee") : detailNote.type === "task" ? getBg(detailEditing ? (detailEditImportance === "none" ? undefined : detailEditImportance) : (detailNote.importance === "none" ? undefined : detailNote.importance)) : (() => { const ci = detailEditing ? detailEditColorIdx : detailNote.colorIdx; return ci !== undefined ? paletteBg(ci, boardTheme) : (boardTheme === "dark" ? "#2a2d32" : "#ebebeb"); })(), border: (detailNote.completed || (detailNote.steps.length > 0 && detailNote.steps.every(s => s.done))) ? `1px solid ${boardTheme === "dark" ? "rgba(60,180,90,.2)" : "rgba(60,180,90,.15)"}` : "1px solid rgba(0,0,0,.05)", padding: 20, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto" }}>
            {/* Focus header */}
            <div style={{ paddingBottom: 16, borderBottom: `1px solid ${border(boardTheme)}`, marginBottom: 16 }}>
              {detailNote.type === "task" && detailEditing ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <input
                    autoFocus
                    value={detailEditTitle}
                    onChange={e => setDetailEditTitle(e.target.value)}
                    placeholder="Task title…"
                    style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 18, fontWeight: 700, color: pageText(boardTheme), fontFamily: "inherit", padding: 0, boxSizing: "border-box" }}
                  />
                  <textarea
                    value={detailEditBody}
                    onChange={e => setDetailEditBody(e.target.value)}
                    placeholder="Add a note…"
                    rows={3}
                    style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontSize: 14, color: pageText(boardTheme), fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box", padding: 0, opacity: 0.85 }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 1 }}>Due date</div>
                      <DateField
                        value={detailEditDueDate}
                        onChange={setDetailEditDueDate}
                        style={{ ...editField, display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <span style={{ fontSize: 13, color: detailEditDueDate ? pageText(boardTheme) : muted(boardTheme), flex: 1, pointerEvents: "none" }}>
                          {detailEditDueDate ? isoToMDY(detailEditDueDate) : "Pick a date"}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted(boardTheme)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, pointerEvents: "none" }}>
                          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
                        </svg>
                      </DateField>
                      {detailEditDueDate && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="time"
                            value={detailEditDueTime}
                            onChange={e => setDetailEditDueTime(e.target.value)}
                            onClick={e => { try { e.currentTarget.showPicker(); } catch { /* unsupported or already open */ } }}
                            aria-label="Due time (optional)"
                            style={{ ...editField, flex: 1, color: detailEditDueTime ? pageText(boardTheme) : muted(boardTheme), cursor: "pointer", colorScheme: boardTheme === "dark" ? "dark" : "light" }}
                          />
                          {detailEditDueTime && (
                            <button type="button" onClick={() => setDetailEditDueTime("")} style={{ background: "none", border: "none", color: muted(boardTheme), fontSize: 14, opacity: .6, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 5 }}>Priority</div>
                      <select
                        value={detailEditImportance}
                        onChange={e => setDetailEditImportance(e.target.value as Importance)}
                        style={{ ...editField, cursor: "pointer" }}
                      >
                        <option value="none">No priority</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {detailNote.dueDate && (
                    <div style={{
                      fontSize: 15,
                      fontWeight: 600,
                      marginBottom: 6,
                      color: (() => { const d = detailNote.dueDate; const done = detailNote.completed || detailNote.steps.every(s => s.done); if (!d || done) return pageText(boardTheme); if (d < todayStr()) return boardTheme === "dark" ? "#ff6666" : "#c03030"; if (d === todayStr()) return boardTheme === "dark" ? "#ffb347" : "#b86800"; return pageText(boardTheme); })(),
                    }}>
                      Due {formatDate(detailNote.dueDate)}{fmtTime(detailNote.dueTime)}
                    </div>
                  )}
                  {detailNote.type === "task" && detailNote.body && !detailEditing && (
                    <div style={{ fontSize: 14, color: muted(boardTheme), lineHeight: 1.7, marginTop: detailNote.dueDate ? 8 : 0, marginBottom: 6 }}>
                      {detailNote.body}
                    </div>
                  )}
                  {detailNote.type !== "task" && detailEditing ? (
                    <>
                      <input
                        autoFocus
                        value={detailEditTitle}
                        onChange={e => setDetailEditTitle(e.target.value)}
                        placeholder="Idea title…"
                        style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 18, fontWeight: 700, color: pageText(boardTheme), fontFamily: "inherit", padding: 0, marginBottom: 10, boxSizing: "border-box" }}
                      />
                      <textarea
                        value={detailEditBody}
                        onChange={e => setDetailEditBody(e.target.value)}
                        placeholder="Add a note…"
                        rows={4}
                        style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontSize: 14, color: pageText(boardTheme), fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box", padding: 0 }}
                      />
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                        <button
                          onClick={() => setDetailEditColorIdx(undefined)}
                          style={{ width: 20, height: 20, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: boardTheme === "dark" ? "#555" : "#ccc", border: detailEditColorIdx === undefined ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent", outline: detailEditColorIdx === undefined ? `2px solid ${boardTheme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)"}` : "none", outlineOffset: 2 }}
                          title="Grey"
                        />
                        {NOTE_PALETTE.map((col, i) => (
                          <button
                            key={i}
                            onClick={() => setDetailEditColorIdx(i)}
                            style={{ width: 20, height: 20, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: col.swatch, border: detailEditColorIdx === i ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent", outline: detailEditColorIdx === i ? `2px solid ${col.swatch}` : "none", outlineOffset: 2 }}
                          />
                        ))}
                      </div>
                    </>
                  ) : detailNote.body ? (
                    <div style={{ fontSize: 14, color: muted(boardTheme), lineHeight: 1.7 }}>
                      {detailNote.body}
                    </div>
                  ) : detailNote.type !== "task" ? (
                    <div style={{ fontSize: 14, color: muted(boardTheme), opacity: .4, lineHeight: 1.7, fontStyle: "italic" }}>No note added.</div>
                  ) : null}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                    {detailNote.importance && detailNote.importance !== "none" && (
                      <span style={pill(boardTheme)}>{detailNote.importance} priority</span>
                    )}
                    {detailNote.type === "task" && (() => {
                      const doneCount = detailNote.steps.filter(s => s.done).length;
                      const total = detailNote.steps.length;
                      const completed = detailNote.completed || (total > 0 && doneCount === total);
                      if (completed) return <span style={pill(boardTheme)}>Completed</span>;
                      if (total > 0 && doneCount > 0) return <span style={pill(boardTheme)}>{doneCount}/{total} done</span>;
                      if ((detailNote.totalTimeSpent ?? 0) > 0) return null;
                      return <span style={pill(boardTheme)}>Not started</span>;
                    })()}
                    {(detailNote.totalTimeSpent ?? 0) > 0 && (
                      <span style={pill(boardTheme)}>
                        {(detailNote.totalTimeSpent ?? 0) >= 60
                          ? `${Math.floor((detailNote.totalTimeSpent ?? 0) / 60)}h ${(detailNote.totalTimeSpent ?? 0) % 60 > 0 ? `${(detailNote.totalTimeSpent ?? 0) % 60}m` : ""} focused`
                          : `${detailNote.totalTimeSpent}m focused`}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {detailNote.type === "task" ? (
              <>
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 12 }}>
                  Subtasks
                </div>
                {detailEditing ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {detailNote.steps.length === 0 && detailEditSteps.length === 0 && (
                      <div style={{ borderRadius: 10, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: "12px 14px", display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme) }}>BOB Planning</div>
                          <button
                            onClick={() => {
                              const steps = buildBreakdown(detailEditTitle || detailNote.title, detailNote.body ?? "", detailNote.minutes ?? 60, detailBreakdownVariant);
                              setDetailEditSteps(steps);
                            }}
                            disabled={!detailEditTitle.trim() && !detailNote.title.trim()}
                            style={{ ...buttonStyle(boardTheme, true, true), fontSize: 12, height: 28, padding: "0 10px", opacity: (!detailEditTitle.trim() && !detailNote.title.trim()) ? 0.4 : 1 }}
                          >BOB Breakdown</button>
                        </div>
                        <div style={{ fontSize: 13, color: muted(boardTheme) }}>Let BOB break this task into subtasks, or add them manually below.</div>
                      </div>
                    )}
                    {detailEditSteps.map((step) => (
                      <div key={step.id} style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${border(boardTheme)}`, paddingBottom: 8 }}>
                        <input
                          value={step.title}
                          placeholder="Subtask title…"
                          onChange={e => setDetailEditSteps(prev => prev.map(s => s.id === step.id ? { ...s, title: e.target.value } : s))}
                          style={{ flex: 1, border: `1px solid ${border(boardTheme)}`, borderRadius: 6, background: boardTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", fontWeight: 600, fontSize: 14, color: pageText(boardTheme), outline: "none", fontFamily: "inherit", padding: "4px 8px" }}
                        />
                        <button
                          onClick={() => setDetailEditSteps(prev => prev.filter(s => s.id !== step.id))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: muted(boardTheme), fontSize: 14, padding: "0 4px", lineHeight: 1, opacity: .6 }}
                        >✕</button>
                      </div>
                    ))}
                    {detailEditSteps.length > 0 && (
                      <button
                        onClick={() => {
                          const nextVariant = detailBreakdownVariant + 1;
                          setDetailBreakdownVariant(nextVariant);
                          const steps = buildBreakdown(detailEditTitle || detailNote.title, detailNote.body ?? "", detailNote.minutes ?? 60, nextVariant);
                          setDetailEditSteps(steps);
                        }}
                        style={{ height: 28, borderRadius: 8, border: `1px solid ${border(boardTheme)}`, background: "none", color: muted(boardTheme), fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                      >BOB Breakdown again</button>
                    )}
                    <button
                      onClick={() => setDetailEditSteps(prev => [...prev, { id: genId(), title: "", minutes: 15, done: false, x: 0, y: 0 }])}
                      style={{ height: 36, borderRadius: 8, border: `1.5px dashed ${boardTheme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.22)"}`, background: boardTheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: muted(boardTheme), fontSize: 13, cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "left", paddingLeft: 12, display: "flex", alignItems: "center", gap: 6 }}
                    ><span style={{ fontSize: 16, lineHeight: 1, opacity: 0.7 }}>+</span> Type a subtask…</button>
                  </div>
                ) : detailNote.steps.length === 0 ? (
                  <div style={{ color: muted(boardTheme), fontSize: 14, lineHeight: 1.6 }}>
                    No subtasks for this task.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {detailNote.steps.map((step) => (
                      <button
                        key={step.id}
                        onClick={() => {}}
                        style={{
                          borderRadius: 9,
                          border: step.done
                            ? `1px solid ${boardTheme === "dark" ? "rgba(60,180,90,.3)" : "rgba(60,180,90,.25)"}`
                            : `1px solid ${border(boardTheme)}`,
                          backgroundColor: step.done
                            ? (boardTheme === "dark" ? "rgba(40,140,70,.18)" : "rgba(60,190,90,.10)")
                            : (boardTheme === "dark" ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.72)"),
                          padding: "13px 16px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background-color .15s ease, border-color .15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              flexShrink: 0,
                              border: step.done ? "1.5px solid #3d8b40" : `1.5px solid ${border(boardTheme)}`,
                              backgroundColor: step.done ? "#6fc46b" : "transparent",
                              display: "inline-block",
                            }}
                          />
                          <span style={{ fontWeight: 600, fontSize: 14, color: pageText(boardTheme) }}>{step.title}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {detailEditing && (
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={() => setDetailEditing(false)} style={buttonStyle(boardTheme)}>Cancel</button>
                    <button
                      onClick={() => {
                        if (!detailEditTitle.trim()) return;
                        const newSteps = detailEditSteps.filter(s => s.title.trim());
                        const newMinutes = newSteps.length > 0
                          ? newSteps.reduce((s, st) => s + st.minutes, 0)
                          : detailEditMinutes;
                        setNotes(ns => ns.map(n => n.id === detailNote.id ? {
                          ...n,
                          title: detailEditTitle.trim(),
                          body: detailEditBody.trim(),
                          dueDate: detailEditDueDate || undefined,
                          dueTime: detailEditDueTime || undefined,
                          importance: detailEditImportance,
                          minutes: newMinutes,
                          steps: (() => {
                            const laid = n.flowMode === "chain" ? layoutChain(n.x, n.y, newSteps) : layoutWeb(n.x, n.y, newSteps);
                            return newSteps.map((s, i) => (s.x === 0 && s.y === 0) ? laid[i] : s);
                          })(),
                        } : n));
                        scheduleDueDateReminder(detailNote.id, detailEditTitle.trim() || detailNote.title, detailEditDueDate || undefined, detailEditDueTime || undefined);
                        setDetailEditing(false);
                      }}
                      style={buttonStyle(boardTheme, true)}
                    >Save</button>
                  </div>
                )}
              </>
            ) : (
              <>
                {detailEditing ? (
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    <button
                      onClick={() => setDetailEditing(false)}
                      style={buttonStyle(boardTheme)}
                    >Cancel</button>
                    <button
                      onClick={() => {
                        if (!detailEditTitle.trim()) return;
                        setNotes(ns => ns.map(n => n.id === detailNote.id ? { ...n, title: detailEditTitle.trim(), body: detailEditBody.trim(), colorIdx: detailEditColorIdx } : n));
                        setDetailEditing(false);
                      }}
                      style={buttonStyle(boardTheme, true)}
                    >Save</button>
                  </div>
                ) : null}
                <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 10 }}>Connections</div>
                {detailNote.linkedNoteIds.length === 0 ? (
                  <div style={{ color: muted(boardTheme), fontSize: 14, lineHeight: 1.6 }}>
                    Drag this idea over another to connect them. Hold over a connected idea to unlink.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {detailNote.linkedNoteIds.map((linkedId) => {
                      const linked = activeNotes.find(n => n.id === linkedId);
                      return linked ? (
                        <span key={linkedId} style={{ ...pill(boardTheme), fontSize: 13 }}>{linked.title}</span>
                      ) : null;
                    })}
                  </div>
                )}
                {/* Delete idea */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${border(boardTheme)}` }}>
                  {confirmDeleteId === detailNote.id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 13 }}>Cancel</button>
                      <button onClick={() => { deleteTask(detailNote.id); setConfirmDeleteId(null); }} style={{ flex: 1, height: 38, borderRadius: 999, border: "1px solid rgba(200,50,50,.4)", backgroundColor: boardTheme === "dark" ? "rgba(200,50,50,.18)" : "rgba(200,50,50,.10)", color: boardTheme === "dark" ? "rgba(255,130,130,.9)" : "rgba(160,30,30,.85)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm delete</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(detailNote.id)} style={{ width: "100%", height: 38, background: "none", border: "none", color: boardTheme === "dark" ? "rgba(255,100,100,.65)" : "rgba(160,40,40,.55)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Delete idea
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: focus + flow + actions */}
          {detailNote.type === "task" && (() => {
            return (
              <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                {/* Focus card */}
                {(() => {
                  const incompleteSteps = detailNote.steps.filter(s => !s.done);
                  const nextStep = incompleteSteps[0] ?? null;
                  const allSubtasksDone = detailNote.steps.length > 0 && incompleteSteps.length === 0;
                  const taskDone = detailNote.completed;
                  return (
                    <div style={{ borderRadius: 13, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: 18 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".13em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 14 }}>
                        Focus
                      </div>
                      {taskDone || allSubtasksDone ? (
                        <div style={{
                          height: 50, borderRadius: 999,
                          backgroundColor: boardTheme === "dark" ? "rgba(60,180,90,.14)" : "rgba(60,180,90,.1)",
                          border: `1px solid ${boardTheme === "dark" ? "rgba(60,180,90,.3)" : "rgba(60,180,90,.22)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                          color: boardTheme === "dark" ? "rgba(100,220,120,.95)" : "rgba(30,120,60,.9)",
                          fontWeight: 700, fontSize: 14,
                        }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeOpacity="0.5"/>
                            <polyline points="4.5,8.5 7,11 11.5,5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Task complete
                        </div>
                      ) : (
                        <>
                          {nextStep ? (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 11, letterSpacing: ".11em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 6 }}>
                                Next up · {incompleteSteps.length} remaining
                              </div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: pageText(boardTheme) }}>{nextStep.title}</div>
                            </div>
                          ) : (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontWeight: 700, fontSize: 15, color: pageText(boardTheme) }}>{detailNote.title}</div>
                            </div>
                          )}
                          <button
                            onClick={() => startFocus(detailNote.id, detailNote.steps.length > 0)}
                            style={{
                              width: "100%", height: 50, borderRadius: 999, border: "none",
                              backgroundColor: boardTheme === "dark" ? "#f5f5f2" : "#111315",
                              color: boardTheme === "dark" ? "#111315" : "#f7f8fb",
                              fontWeight: 700, fontSize: 15, cursor: "pointer",
                              boxShadow: "0 3px 14px rgba(0,0,0,.16)",
                            }}
                          >
                            Start focus
                          </button>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Task flow */}
                {detailNote.steps.length > 0 && (
                  <div style={{ borderRadius: 12, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: 16 }}>
                    <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme), marginBottom: 12 }}>
                      Task flow
                    </div>
                    {/* Segmented Taskweb / Taskchain toggle */}
                    <div style={{ display: "flex", gap: 0, borderRadius: 8, border: `1px solid ${border(boardTheme)}`, overflow: "hidden" }}>
                      {(["web", "chain"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setFlowMode(detailNote, mode)}
                          style={{
                            flex: 1,
                            height: 38,
                            border: "none",
                            backgroundColor: detailNote.flowMode === mode
                              ? (boardTheme === "dark" ? "#f5f5f2" : "#111315")
                              : "transparent",
                            color: detailNote.flowMode === mode
                              ? (boardTheme === "dark" ? "#111315" : "#f7f8fb")
                              : muted(boardTheme),
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                            transition: "background-color .15s ease, color .15s ease",
                          }}
                        >
                          {mode === "web" ? "Taskweb" : "Taskchain"}
                        </button>
                      ))}
                    </div>
                    {/* Show / hide toggle */}
                    <button
                      onClick={() => { toggleFlow(detailNote.id); setDetailNoteId(null); }}
                      style={{
                        marginTop: 8, width: "100%", height: 34,
                        borderRadius: 8, border: `1px solid ${border(boardTheme)}`,
                        backgroundColor: "transparent",
                        color: muted(boardTheme), fontSize: 12, fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {detailNote.showFlow ? "Hide from board" : "Show on board"}
                    </button>
                  </div>
                )}

                {/* Delete action */}
                <div style={{ borderRadius: 12, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: "8px 12px" }}>
                  {confirmDeleteId === detailNote.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ ...buttonStyle(boardTheme, false, true), flex: 1, fontSize: 12 }}>Cancel</button>
                      <button onClick={() => { deleteTask(detailNote.id); setConfirmDeleteId(null); }} style={{ flex: 1, height: 36, borderRadius: 999, border: "1px solid rgba(200,50,50,.4)", backgroundColor: boardTheme === "dark" ? "rgba(200,50,50,.18)" : "rgba(200,50,50,.10)", color: boardTheme === "dark" ? "rgba(255,130,130,.9)" : "rgba(160,30,30,.85)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirm delete</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(detailNote.id)} style={{ width: "100%", height: 36, background: "none", border: "none", color: boardTheme === "dark" ? "rgba(255,100,100,.65)" : "rgba(160,40,40,.55)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Delete {detailNote.type === "task" ? "task" : "idea"}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
