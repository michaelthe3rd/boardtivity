import { GoogleGenerativeAI, type FunctionDeclaration } from "@google/generative-ai";
import { NextRequest } from "next/server";

type NoteSnap = {
  id: number; boardId?: string; type: string; title: string; body?: string;
  importance?: string; dueDate?: string; minutes?: number;
  completed: boolean; x: number; y: number; colorIdx?: number;
  steps?: { title: string; minutes: number; done: boolean }[];
  totalTimeSpent?: number; attemptCount?: number;
};
type Mode = "assistant" | "autopilot";
type HistoryMsg = { role: "user" | "assistant"; content: string };
type BoardInfo = { id: string; name: string; type: "task" | "thought" };
type FocusStats = {
  currentStreak: number;
  totalMinutes: number;
  totalTasksCompleted: number;
  days: { date: string; totalMinutes: number; tasksCompleted: number }[];
};
type Settings = {
  taskColorMode?: "priority" | "single";
  taskHighColorIdx?: number; taskMedColorIdx?: number; taskLowColorIdx?: number;
  taskSingleColorIdx?: number; thoughtColorMode?: "random" | "fixed";
  thoughtFixedColorIdx?: number; boardTheme?: string; boardGrid?: string;
  activeBoardType?: "task" | "thought";
  activeBoardName?: string;
  boards?: BoardInfo[];
};

// Color names for idea notes (NOTE_PALETTE indices 0-7)
const IDEA_COLOR_NAMES = ["pink","orchid","coral","peach","butter","lilac","blue","mint"] as const;
// Color names for task palette (first 3 = priority defaults, then idea colors)
const TASK_COLOR_NAMES = ["red","orange","yellow","pink","orchid","coral","peach","butter","lilac","blue","mint"] as const;

// ── Function declarations (Gemini format) ────────────────────────────────────
const FUNCTION_DECLARATIONS = [
  {
    name: "create_note",
    description: "Create a new note or task on the board. Place it at an optimal position.",
    parameters: {
      type: "object",
      properties: {
        type:       { type: "string", enum: ["task", "thought"] },
        title:      { type: "string", description: "Concise title, max 60 chars" },
        body:       { type: "string", description: "Additional context, optional" },
        importance: { type: "string", enum: ["High", "Medium", "Low", "none"] },
        dueDate:    { type: "string", description: "ISO date YYYY-MM-DD, optional" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title:   { type: "string" },
              minutes: { type: "number" },
            },
            required: ["title", "minutes"],
          },
          description: "Subtasks for tasks, optional",
        },
      },
      required: ["type", "title"],
    },
  },
  {
    name: "edit_note",
    description: "Edit an existing note. Only specify the fields to change.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The note ID to edit" },
        fields: {
          type: "object",
          description: "Fields to update. Allowed: title, body, importance, dueDate, minutes",
          properties: {
            title:      { type: "string" },
            body:       { type: "string" },
            importance: { type: "string", enum: ["High", "Medium", "Low", "none"] },
            dueDate:    { type: "string" },
            minutes:    { type: "number" },
          },
        },
      },
      required: ["id", "fields"],
    },
  },
  {
    name: "delete_notes",
    description: "Delete one or more notes from the board.",
    parameters: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "IDs of notes to delete" },
      },
      required: ["ids"],
    },
  },
  {
    name: "organize_board",
    description: "Move notes to new positions on the canvas. Use for sorting, grouping, or cleaning up the board.",
    parameters: {
      type: "object",
      properties: {
        positions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              x:  { type: "number" },
              y:  { type: "number" },
            },
            required: ["id", "x", "y"],
          },
        },
      },
      required: ["positions"],
    },
  },
  {
    name: "highlight_notes",
    description: "Highlight specific notes on the board to draw the user's attention — use for search results or references.",
    parameters: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "IDs of notes to highlight" },
      },
      required: ["ids"],
    },
  },
  {
    name: "launch_focus",
    description: "Launch focus mode for a task, starting its timer immediately.",
    parameters: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "ID of the note to focus on" },
        chain:  { type: "boolean", description: "If true, auto-chain through subtasks when each timer ends" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "set_idea_color",
    description: "Change the color of one or more idea cards. Use 'none' for grey/no color.",
    parameters: {
      type: "object",
      properties: {
        ids:   { type: "array", items: { type: "string" }, description: "Idea note IDs to recolor" },
        color: { type: "string", enum: ["none","pink","orchid","coral","peach","butter","lilac","blue","mint"], description: "Color name" },
      },
      required: ["ids", "color"],
    },
  },
  {
    name: "configure_task_colors",
    description: "Change how task colors work — switch mode or set colors per priority level.",
    parameters: {
      type: "object",
      properties: {
        mode:   { type: "string", enum: ["priority","single"], description: "priority = color per priority level; single = one color for all tasks" },
        high:   { type: "string", enum: ["red","orange","yellow","pink","orchid","coral","peach","butter","lilac","blue","mint"] },
        medium: { type: "string", enum: ["red","orange","yellow","pink","orchid","coral","peach","butter","lilac","blue","mint"] },
        low:    { type: "string", enum: ["red","orange","yellow","pink","orchid","coral","peach","butter","lilac","blue","mint"] },
        single: { type: "string", enum: ["red","orange","yellow","pink","orchid","coral","peach","butter","lilac","blue","mint"], description: "Used when mode=single" },
      },
    },
  },
  {
    name: "configure_board",
    description: "Change board visual settings: theme, grid style, or default idea color.",
    parameters: {
      type: "object",
      properties: {
        board_theme:        { type: "string", enum: ["light","dark"] },
        board_grid:         { type: "string", enum: ["grid","dots","blank"] },
        default_idea_color: { type: "string", enum: ["none","sky-blue","peach","sage","lavender","butter","teal","rose","periwinkle"], description: "Default color for new ideas. 'none' = grey." },
      },
    },
  },
];

// ── Focus stats context ───────────────────────────────────────────────────────
function buildFocusContext(focusStats?: FocusStats): string {
  if (!focusStats) return "";
  const { currentStreak, totalMinutes, totalTasksCompleted, days } = focusStats;
  const totalH = totalMinutes < 60 ? `${totalMinutes}m` : `${Math.round(totalMinutes / 60 * 10) / 10}h`;
  const weekMin = days.reduce((s, d) => s + d.totalMinutes, 0);
  const activeDays = days.filter(d => d.totalMinutes > 0).length;
  const recentDays = days.slice(-7).map(d => `${d.date}:${d.totalMinutes}m`).join(", ");
  return `\n<focus_stats>
streak: ${currentStreak} day${currentStreak !== 1 ? "s" : ""} in a row
total focused: ${totalH} all time | ${weekMin}m this week (${activeDays} active days)
tasks completed: ${totalTasksCompleted} all time
last 7 days: ${recentDays}
</focus_stats>`;
}

// ── Compact board context injected into every user message ───────────────────
// Gemini's systemInstruction is not always reliably read in chat mode.
// Embedding the board state directly in the user turn guarantees the model sees it.
function buildBoardContext(notes: NoteSnap[], activeBoardId?: string, settings?: Settings, focusStats?: FocusStats): string {
  // Strict filter: match boardId exactly, or include legacy notes (no boardId) only on the
  // default task board ("my-board") since that's where they were created before boardId existed.
  const boardNotes = activeBoardId
    ? notes.filter(n => n.boardId === activeBoardId || (!n.boardId && activeBoardId === "my-board"))
    : notes;
  const active    = boardNotes.filter(n => !n.completed);
  const completed = boardNotes.filter(n => n.completed);

  const boardType = settings?.activeBoardType === "thought" ? "idea" : (settings?.activeBoardType ?? "task");
  const boardName = settings?.activeBoardName ?? "Current Board";
  const header = `<board name="${boardName}" type="${boardType}">`;

  if (active.length === 0 && completed.length === 0) return `${header}\nempty\n</board>`;

  const tasks = active.filter(n => n.type === "task");
  const ideas = active.filter(n => n.type === "thought");

  function noteLine(n: NoteSnap) {
    let s = `  ID:${n.id} | "${n.title}"`;
    if (n.importance && n.importance !== "none") s += ` | ${n.importance}`;
    if (n.dueDate) s += ` | due:${n.dueDate}`;
    if (n.steps?.length) s += ` | steps:${n.steps.filter(s => !s.done).length}/${n.steps.length}`;
    if ((n.totalTimeSpent ?? 0) > 0) s += ` | focused:${n.totalTimeSpent}m`;
    if ((n.attemptCount ?? 0) > 0) s += ` | sessions:${n.attemptCount}`;
    s += ` | pos:(${Math.round(n.x)},${Math.round(n.y)})`;
    return s;
  }

  const lines: string[] = [header];
  if (tasks.length) {
    lines.push(`TASKS (${tasks.length}):`);
    tasks.forEach(n => lines.push(noteLine(n)));
  } else {
    lines.push("TASKS: none");
  }
  if (ideas.length) {
    lines.push(`IDEAS (${ideas.length}):`);
    ideas.forEach(n => lines.push(noteLine(n)));
  } else {
    lines.push("IDEAS: none");
  }
  if (completed.length) {
    lines.push(`COMPLETED (${completed.length} total, showing up to 5):`);
    completed.slice(0, 5).forEach(n => lines.push(`  ID:${n.id} | "${n.title}"`));
  }
  lines.push("</board>");
  if (focusStats) lines.push(buildFocusContext(focusStats));
  return lines.join("\n");
}

// ── System prompt ─────────────────────────────────────────────────────────────
// Board contents are NOT repeated here — they are injected into every user message
// via buildBoardContext(). Keeping them out of the system prompt halves input tokens.
function buildSystem(mode: Mode, userInfo?: string, settings?: Settings): string {
  const today  = new Date().toISOString().split("T")[0];
  const activeBoardType = settings?.activeBoardType === "thought" ? "idea" : (settings?.activeBoardType ?? "task");
  const boards = settings?.boards ?? [];
  const taskBoards  = boards.filter(b => b.type === "task");
  const ideaBoards  = boards.filter(b => b.type === "thought");

  const modeText = {
    assistant:
      "ASSISTANT MODE — you can search the web, answer questions, give advice, and execute actions when clearly asked. Use Google Search for real-world info: places, hours, events, recommendations, news, anything outside the board. For board actions (create, edit, delete, organize), briefly confirm what you're about to do before calling tools.",
    autopilot:
      "AUTOPILOT MODE — act immediately, optimize on your own judgment, chain multiple tools if needed. Don't ask — just do. Narrate what you did afterwards in 1-2 sentences.",
  }[mode];

  const userSection = userInfo?.trim() ? `\nAbout the user: ${userInfo.trim()}\n` : "";

  const taskColorNames = TASK_COLOR_NAMES;
  const ideaColorStr = settings?.thoughtColorMode === "fixed" && settings.thoughtFixedColorIdx !== undefined
    ? `default idea color: ${IDEA_COLOR_NAMES[settings.thoughtFixedColorIdx] ?? "unknown"}`
    : "default idea color: none (grey)";
  const taskColorStr = settings?.taskColorMode === "single"
    ? `task color mode: single (${taskColorNames[settings.taskSingleColorIdx ?? 0]})`
    : `task color mode: priority — High:${taskColorNames[settings?.taskHighColorIdx ?? 0]}, Medium:${taskColorNames[settings?.taskMedColorIdx ?? 1]}, Low:${taskColorNames[settings?.taskLowColorIdx ?? 2]}`;

  const crossBoardRule = activeBoardType === "task"
    ? `— This is a TASK board. If the user asks to create an idea, do NOT create it here. Instead say: "This is a task board — should I add that to your idea board${ideaBoards.length === 1 ? ` (${ideaBoards[0].name})` : ideaBoards.length > 1 ? ` (${ideaBoards.map(b => b.name).join(" or ")})` : ""}?" and wait for confirmation before acting.`
    : `— This is an IDEA board. If the user asks to create a task, do NOT create it here. Instead say: "This is an idea board — should I add that to your task board${taskBoards.length === 1 ? ` (${taskBoards[0].name})` : taskBoards.length > 1 ? ` (${taskBoards.map(b => b.name).join(" or ")})` : ""}?" and wait for confirmation before acting.`;

  return `You are BOB (Boardtivity Operating Brain) — a sharp AI assistant inside a visual task and idea board app. Be concise, confident, direct. Do not use markdown formatting like **bold** or *italic* in your responses — plain text only.

${modeText}
${userSection}
Today: ${today}
Active board: "${settings?.activeBoardName ?? "Current Board"}" (${activeBoardType} board)
All boards: ${boards.map(b => `${b.name} [${b.type === "thought" ? "idea" : b.type}]`).join(", ") || "none"}

The user's live board contents are provided in a <board> block at the start of every message. Each note shows its current position as pos:(x,y). Use that data to answer questions and to calculate new positions when organizing.

Settings: ${ideaColorStr} | ${taskColorStr} | theme:${settings?.boardTheme ?? "light"}

Rules:
${crossBoardRule}
— No live web search. For real-world info (places, hours, news), draw on your training knowledge and say so.
— After acting, say what you did in 1–2 sentences.
— NEVER overlap notes: space at least 252px horizontally, 162px vertically.
— When centering, use board center (3400, 2100). Layout grid: 276px col stride, 186px row stride.
— When the user asks to line up, sort, arrange, or organize notes: call organize_board using ALL the IDs listed in the <board> block for the relevant type. Never say there are no notes if any are listed.
— Reference notes by their title and ID.
— CRITICAL: The <board> block is the ground truth. Never contradict it, even if prior conversation history said otherwise. If the board shows tasks, there ARE tasks.
— Focus mode: users can start a timed focus session on any task. Each task tracks totalTimeSpent (minutes focused all-time) and attemptCount (sessions started). These appear in the board context as "focused:Xm" and "sessions:N". Use this to give personalized advice — e.g. notice if a task has many sessions but low completion, or suggest what to focus on next based on urgency and prior effort.
— Focus stats: the <focus_stats> block shows the user's streak, weekly focus time, and daily breakdown. Reference this when coaching or summarizing productivity. A streak of 0 means they haven't focused today.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
function makeSSE(fn: (push: (obj: object) => void, signal: AbortSignal) => Promise<void>) {
  const ac = new AbortController();
  const stream = new ReadableStream({
    async start(ctrl) {
      const push = (obj: object) => {
        if (ac.signal.aborted) return;
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try { await fn(push, ac.signal); }
      catch (e) {
        if (!ac.signal.aborted) push({ type: "error", message: String(e) });
      }
      finally { if (!ac.signal.aborted) ctrl.close(); }
    },
    cancel() { ac.abort(); },
  });
  return stream;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
};

// ── Per-user rate limit (20 req / 60s) ───────────────────────────────────────
const RL = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = RL.get(userId);
  if (!entry || now > entry.resetAt) {
    RL.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  if (!checkRateLimit(userId)) {
    return new Response("Rate limit exceeded — try again in a minute", { status: 429 });
  }

  let body: { message?: string; notes?: NoteSnap[]; activeBoardId?: string; mode?: Mode; history?: HistoryMsg[]; userInfo?: string; settings?: Settings; focusStats?: FocusStats };
  try { body = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  // ── Runtime input validation ──────────────────────────────────────────────
  const rawMessage     = typeof body.message       === "string" ? body.message       : "";
  const rawMode        = body.mode;
  const rawUserInfo    = typeof body.userInfo      === "string" ? body.userInfo      : "";
  const rawActiveBoardId = typeof body.activeBoardId === "string" ? body.activeBoardId : "";
  const rawNotes       = Array.isArray(body.notes)   ? body.notes.slice(0, 500)   : [];
  const rawHistory     = Array.isArray(body.history) ? body.history.slice(0, 12)  : [];

  const message  = rawMessage.trim().slice(0, 4000);
  const mode: Mode = rawMode === "autopilot" ? rawMode : "assistant";
  const userInfo = rawUserInfo.slice(0, 1000);
  const notes = rawNotes;
  const history  = rawHistory.filter(
    h => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string"
  ).map(h => ({ role: h.role as "user" | "assistant", content: h.content.slice(0, 2000) }));
  const settings = body.settings;
  const focusStats = body.focusStats;

  if (!message) return new Response("No message", { status: 400 });

  // ── Mock mode ─────────────────────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    const stream = makeSSE(async (push, signal) => {
      const words = `Running in mock mode — no API key set. In ${mode} mode I'd handle that request fully. Connect a Gemini API key to unlock the real BOB.`.split(" ");
      for (const w of words) {
        if (signal.aborted) return;
        await new Promise(r => setTimeout(r, 55));
        push({ type: "token", text: w + " " });
      }
      push({ type: "done" });
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // ── Real mode ─────────────────────────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    systemInstruction: buildSystem(mode, userInfo, settings),
    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS as unknown as FunctionDeclaration[] }],
  });

  // Gemini uses "model" instead of "assistant" for role
  const geminiHistory = history.slice(-6).map(h => ({
    role: h.role === "assistant" ? "model" : "user" as "user" | "model",
    parts: [{ text: h.content }],
  }));

  const activeTasks = notes.filter(n => !n.completed && n.type === "task");
  const activeIdeas = notes.filter(n => !n.completed && n.type === "thought");
  console.log(`[BOB] userId=${userId} mode=${mode} rawNotes=${rawNotes.length} filteredNotes=${notes.length} tasks=${activeTasks.length} ideas=${activeIdeas.length} activeBoardId=${rawActiveBoardId}`);

  const stream = makeSSE(async (push, signal) => {
    push({ type: "debug", rawNotes: rawNotes.length, filteredNotes: notes.length, tasks: activeTasks.length, ideas: activeIdeas.length, activeBoardId: rawActiveBoardId, noteTitles: notes.slice(0,5).map(n => n.title) });
    const chat = model.startChat({ history: geminiHistory });
    // Inject board context directly into the user message — systemInstruction alone
    // is not reliably surfaced on every chat turn in the Gemini API.
    const boardContext = buildBoardContext(notes, rawActiveBoardId, settings, focusStats);
    const fullMessage = `${boardContext}\n\nUser: ${message}`;
    const result = await chat.sendMessageStream(fullMessage);

    // Stream text tokens as they arrive
    for await (const chunk of result.stream) {
      if (signal.aborted) return;
      try {
        const text = chunk.text();
        if (text) push({ type: "token", text });
      } catch { /* blocked or non-text chunk */ }
    }

    // Function calls arrive complete in the aggregated response
    const response = await result.response;
    const functionCalls = response.functionCalls();
    if (functionCalls?.length) {
      for (const fc of functionCalls) {
        push({ type: "tool", name: fc.name, input: fc.args });
      }
    }

    // Usage metadata
    const usage = response.usageMetadata;
    if (usage) {
      push({
        type: "usage",
        inputTokens:  usage.promptTokenCount     ?? 0,
        outputTokens: usage.candidatesTokenCount ?? 0,
      });
    }

    push({ type: "done" });
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
