"use client";

import type { Importance} from "@/lib/board";
import { NOTE_PALETTE, paletteBg} from "@/lib/colors";
import { pageText, muted, border, panel, buttonStyle, fieldStyle, circleButton, pill } from "@/lib/ui";
import { formatDate} from "@/lib/dates";
import { estimateTime, buildBreakdown } from "@/lib/breakdown";
import { useHome } from "@/components/home/HomeContext";

// Add-task / add-idea dialog with drafts, priority, due date and BOB breakdown.
export default function TaskComposer() {
  const {
    boardTheme, composerOpen, title, setTitle, body, setBody, dueDate, setDueDate,
    dueTime, setDueTime, minutes, setMinutes, importance, setImportance, aiSteps, setAiSteps,
    breakdownVariant, setBreakdownVariant, composerError, setComposerError, drafts, composerColorIdx, setComposerColorIdx, dateInputRef,
    isMobile, activeBoard, getBg, thoughtMode, recentTasks, createNote, closeComposer, loadDraft,
    deleteDraft,
  } = useHome();
  if (!(composerOpen)) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30,
        backgroundColor: boardTheme === "dark" ? "rgba(6,8,12,.58)" : "rgba(10,10,12,.26)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeComposer();
      }}
    >
      <div
        style={{
          width: thoughtMode ? "min(760px, 100%)" : "min(960px, 100%)",
          backgroundColor: boardTheme === "dark" ? "#1f2329" : "#fbf8f1",
          color: pageText(boardTheme),
          borderRadius: 16,
          border: `1px solid ${border(boardTheme)}`,
          boxShadow: "0 30px 100px rgba(0,0,0,.28)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${border(boardTheme)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme) }}>
              Adding to {activeBoard.name}
            </div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
              {thoughtMode ? "Add an idea" : "Add a task"}
            </div>
          </div>
          <button onClick={closeComposer} style={circleButton(boardTheme, 42)}>✕</button>
        </div>

        {drafts.length > 0 && (
          <div style={{ borderBottom: `1px solid ${border(boardTheme)}`, padding: "8px 20px", display: "flex", gap: 8, overflowX: "auto", alignItems: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em", color: muted(boardTheme), flexShrink: 0, fontWeight: 700 }}>Drafts</div>
            {drafts.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, borderRadius: 99, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: "4px 4px 4px 10px" }}>
                <button onClick={() => loadDraft(d)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: pageText(boardTheme), padding: 0 }}>
                  {d.title || "Untitled"} <span style={{ color: muted(boardTheme), fontWeight: 400 }}>· {new Date(d.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </button>
                <button onClick={() => deleteDraft(d.id)} style={{ ...circleButton(boardTheme, 20), fontSize: 12, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: (thoughtMode || isMobile) ? "1fr" : "1fr 360px", gap: 16, padding: 18, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                borderRadius: 14,
                backgroundColor: thoughtMode
                  ? (composerColorIdx !== undefined ? paletteBg(composerColorIdx, boardTheme) : (boardTheme === "dark" ? "#2a2d32" : "#ebebeb"))
                  : getBg(importance === "none" ? undefined : importance),
                border: composerError.title ? "1px solid rgba(200,40,40,.5)" : "1px solid rgba(0,0,0,.05)",
                padding: 18,
                minHeight: thoughtMode ? 220 : 250,
                transition: "background-color .25s ease",
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: muted(boardTheme) }}>
                {thoughtMode ? "Idea" : "Task"}
              </div>
              <textarea
                autoFocus
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setComposerError((prev) => ({ ...prev, title: false }));
                  if (!thoughtMode && e.target.value.trim()) {
                    setMinutes(estimateTime(e.target.value));
                  }
                }}
                placeholder={thoughtMode ? "What’s your idea?" : "What do you need to do?"}
                style={{
                  width: "100%",
                  minHeight: thoughtMode ? 130 : 110,
                  marginTop: 10,
                  border: "none",
                  background: "transparent",
                  resize: "none",
                  outline: "none",
                  color: pageText(boardTheme),
                  fontSize: thoughtMode ? 28 : 26,
                  lineHeight: 1.12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={thoughtMode ? "Optional note" : "Optional details"}
                style={{
                  width: "100%",
                  minHeight: thoughtMode ? 28 : 44,
                  border: "none",
                  background: "transparent",
                  resize: "none",
                  outline: "none",
                  color: muted(boardTheme),
                  fontSize: thoughtMode ? 13 : 15,
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                }}
              />
            </div>

            {thoughtMode && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", padding: "4px 0" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: muted(boardTheme), opacity: .6, marginRight: 2 }}>Color</span>
                <button
                  onClick={() => setComposerColorIdx(undefined)}
                  style={{ width: 24, height: 24, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: boardTheme === "dark" ? "#555" : "#ccc", border: composerColorIdx === undefined ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent", outline: composerColorIdx === undefined ? `2px solid ${boardTheme === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)"}` : "none", outlineOffset: 2 }}
                  title="Grey"
                />
                {NOTE_PALETTE.map((col, i) => (
                  <button
                    key={i}
                    onClick={() => setComposerColorIdx(i)}
                    style={{ width: 24, height: 24, borderRadius: "50%", padding: 0, cursor: "pointer", backgroundColor: col.swatch, border: composerColorIdx === i ? `2.5px solid ${pageText(boardTheme)}` : "2.5px solid transparent", outline: composerColorIdx === i ? `2px solid ${col.swatch}` : "none", outlineOffset: 2 }}
                  />
                ))}
              </div>
            )}
            {!thoughtMode && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      ...fieldStyle(boardTheme),
                      position: "relative",
                      cursor: "pointer",
                      border: composerError.dueDate ? "1px solid rgba(200,40,40,.55)" : fieldStyle(boardTheme).border,
                      boxShadow: composerError.dueDate ? "0 0 0 3px rgba(200,40,40,.12)" : "none",
                    }}
                  >
                    <span style={{ color: dueDate ? pageText(boardTheme) : muted(boardTheme), pointerEvents: "none", position: "relative", zIndex: 0 }}>
                      {dueDate ? formatDate(dueDate) : "Due date"}
                    </span>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={dueDate}
                      onClick={() => { try { (dateInputRef.current as any).showPicker(); } catch {} }}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        setComposerError((prev) => ({ ...prev, dueDate: false }));
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        cursor: "pointer",
                        zIndex: 1,
                      }}
                    />
                  </div>
                  {dueDate && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="time"
                        value={dueTime}
                        onChange={e => setDueTime(e.target.value)}
                        style={{ flex: 1, height: 34, borderRadius: 8, border: `1px solid ${border(boardTheme)}`, background: boardTheme === "dark" ? "rgba(255,255,255,.06)" : "#fff", color: dueTime ? pageText(boardTheme) : muted(boardTheme), fontSize: 13, padding: "0 8px", fontFamily: "inherit", outline: "none", colorScheme: boardTheme === "dark" ? "dark" : "light" }}
                        placeholder="Time (optional)"
                      />
                      {dueTime && (
                        <button type="button" onClick={() => setDueTime("")} style={{ background: "none", border: "none", color: muted(boardTheme), fontSize: 14, opacity: .6, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                      )}
                    </div>
                  )}
                </div>

                <select
                  value={importance}
                  onChange={(e) => {
                    setImportance(e.target.value as Importance);
                    setComposerError((prev) => ({ ...prev, importance: false }));
                  }}
                  style={{
                    ...fieldStyle(boardTheme),
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                    cursor: "pointer",
                    color: pageText(boardTheme),
                    opacity: 0.92,
                    backgroundColor: getBg(importance === "none" ? undefined : importance),
                    border: composerError.importance ? "1px solid rgba(200,40,40,.55)" : fieldStyle(boardTheme).border,
                    boxShadow: composerError.importance ? "0 0 0 3px rgba(200,40,40,.12)" : "none",
                    transition: "background-color .2s ease",
                  }}
                >
                  <option value="none">Set priority</option>
                  <option value="Low">Low priority</option>
                  <option value="Medium">Medium priority</option>
                  <option value="High">High priority</option>
                </select>

              </div>
            )}
          </div>

          <div style={{ display: thoughtMode ? "none" : "grid", gap: 12, alignContent: "start" }}>
            {!thoughtMode && (
              <>
                <div style={{ borderRadius: 12, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: 16 }}>
                  <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme) }}>
                    Current tasks
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {recentTasks.length === 0 ? (
                      <div style={{ color: muted(boardTheme), fontSize: 14 }}>No current tasks yet.</div>
                    ) : (
                      recentTasks.map((task) => (
                        <div key={task.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <span style={{ fontSize: 14, color: pageText(boardTheme) }}>{task.title}</span>
                          {task.dueDate ? <span style={pill(boardTheme)}>{formatDate(task.dueDate)}</span> : <span style={pill(boardTheme)}>No due date</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ borderRadius: 12, border: `1px solid ${border(boardTheme)}`, backgroundColor: panel(boardTheme), padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: muted(boardTheme) }}>
                      BOB Planning
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {aiSteps.length > 0 && (
                        <button
                          onClick={() => {
                            const nextVariant = breakdownVariant + 1;
                            setBreakdownVariant(nextVariant);
                            const next = buildBreakdown(title, body, minutes, nextVariant);
                            setAiSteps(next);
                            setMinutes(next.reduce((s, st) => s + st.minutes, 0));
                          }}
                          style={{ ...buttonStyle(boardTheme, false, true), fontSize: 12, height: 28, padding: "0 10px" }}
                        >
                          Regenerate
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const next = buildBreakdown(title, body, minutes, breakdownVariant);
                          setAiSteps(next);
                          setMinutes(next.reduce((s, st) => s + st.minutes, 0));
                        }}
                        disabled={!title.trim()}
                        style={{ ...buttonStyle(boardTheme, true, true), fontSize: 12, height: 28, padding: "0 10px", opacity: !title.trim() ? 0.4 : 1, cursor: !title.trim() ? "not-allowed" : "pointer" }}
                      >
                        {aiSteps.length > 0 ? "Re-breakdown" : "BOB Breakdown"}
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                    {aiSteps.length === 0 ? (
                      <div style={{ color: muted(boardTheme), fontSize: 14 }}>
                        {title.trim() ? "Click BOB Breakdown to generate subtasks." : "Type a task first."}
                      </div>
                    ) : (
                      aiSteps.map((step) => (
                        <div key={step.id} style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${border(boardTheme)}`, paddingBottom: 8 }}>
                          <input
                            value={step.title}
                            onChange={(e) => setAiSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, title: e.target.value } : s))}
                            style={{ flex: 1, border: "none", background: "transparent", fontWeight: 600, fontSize: 14, color: pageText(boardTheme), outline: "none" }}
                          />
                          <button
                            onClick={() => {
                              setAiSteps((prev) => prev.filter((s) => s.id !== step.id));
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: muted(boardTheme), fontSize: 16, padding: "0 2px", lineHeight: 1 }}
                          >×</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {Object.values(composerError).some(Boolean) && (
                <div style={{ color: boardTheme === "dark" ? "#ffb4b4" : "#a32727", fontSize: 13, fontWeight: 600 }}>
                  Please fill out all required fields.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={closeComposer} style={buttonStyle(boardTheme)}>Cancel</button>
                <button onClick={createNote} style={buttonStyle(boardTheme, true)}>{thoughtMode ? "Create idea" : "Create task"}</button>
              </div>
            </div>
          </div>

          {thoughtMode && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={closeComposer} style={buttonStyle(boardTheme)}>Cancel</button>
                <button onClick={createNote} style={buttonStyle(boardTheme, true)}>Create idea</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
