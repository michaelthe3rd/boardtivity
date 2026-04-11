import { GoogleGenerativeAI, type FunctionDeclaration } from "@google/generative-ai";
import { NextRequest } from "next/server";

type NoteSnap = {
  id: number; boardId?: string; type: string; title: string; body?: string;
  importance?: string; dueDate?: string; minutes?: number;
  completed: boolean; x: number; y: number; colorIdx?: number;
  steps?: { title: string; minutes: number; done: boolean }[];
};
type Mode = "advisor" | "assistant" | "autopilot";
type HistoryMsg = { role: "user" | "assistant"; content: string };
type Settings = {
  taskColorMode?: "priority" | "single";
  taskHighColorIdx?: number; taskMedColorIdx?: number; taskLowColorIdx?: number;
  taskSingleColorIdx?: number; thoughtColorMode?: "random" | "fixed";
  thoughtFixedColorIdx?: number; boardTheme?: string; boardGrid?: string;
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

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystem(notes: NoteSnap[], mode: Mode, userInfo?: string, settings?: Settings): string {
  const active    = notes.filter(n => !n.completed);
  const completed = notes.filter(n => n.completed);
  const today  = new Date().toISOString().split("T")[0];

  const modeText = {
    advisor:
      "ADVISOR MODE — analyze and suggest only. Do NOT call any action tools. If the user asks you to do something that requires a tool (create, edit, delete, organize, etc.), decline politely and say: \"Switch to Assistant or Autopilot mode to let me do that.\"",
    assistant:
      "ASSISTANT MODE — execute actions when clearly asked. For large or destructive changes, briefly say what you're about to do before calling tools.",
    autopilot:
      "AUTOPILOT MODE — act immediately, optimize on your own judgment, chain multiple tools if needed. Don't ask — just do. Narrate what you did afterwards in 1-2 sentences.",
  }[mode];

  function formatNote(n: NoteSnap, done = false) {
    const p = [`[id:${n.id}] [${done ? "DONE" : n.type.toUpperCase()}] "${n.title}"`];
    if (n.importance && n.importance !== "none") p.push(`priority:${n.importance}`);
    if (n.dueDate) p.push(`due:${n.dueDate}`);
    if (n.minutes) p.push(`~${n.minutes}min`);
    if (n.steps?.length) p.push(`${n.steps.filter(s => !s.done).length}/${n.steps.length} steps left`);
    if (n.body) p.push(`note:"${n.body.slice(0, 80)}"`);
    p.push(`pos:(${Math.round(n.x)},${Math.round(n.y)})`);
    return p.join(" | ");
  }

  const boardText = active.length || completed.length
    ? [
        ...active.map(n => formatNote(n, false)),
        ...completed.slice(0, 20).map(n => formatNote(n, true)),
      ].join("\n")
    : "Board is empty.";

  const userSection = userInfo?.trim()
    ? `\nAbout the user: ${userInfo.trim()}\n`
    : "";

  // Describe current color settings so BOB can reference/change them
  const taskColorNames = TASK_COLOR_NAMES;
  const ideaColorStr = settings?.thoughtColorMode === "fixed" && settings.thoughtFixedColorIdx !== undefined
    ? `default idea color: ${IDEA_COLOR_NAMES[settings.thoughtFixedColorIdx] ?? "unknown"}`
    : "default idea color: none (grey)";
  const taskColorStr = settings?.taskColorMode === "single"
    ? `task color mode: single (${taskColorNames[settings.taskSingleColorIdx ?? 0]})`
    : `task color mode: priority — High:${taskColorNames[settings?.taskHighColorIdx ?? 0]}, Medium:${taskColorNames[settings?.taskMedColorIdx ?? 1]}, Low:${taskColorNames[settings?.taskLowColorIdx ?? 2]}`;
  const boardSettingsStr = `board theme: ${settings?.boardTheme ?? "light"}, grid: ${settings?.boardGrid ?? "grid"}`;

  // Per-note color info for idea notes
  const ideaColorNoteInfo = active
    .filter(n => n.type === "thought" && n.colorIdx !== undefined)
    .map(n => `[id:${n.id}] color:${IDEA_COLOR_NAMES[n.colorIdx!] ?? "unknown"}`)
    .join(", ");

  return `You are BOB (Boardtivity Operating Brain) — a sharp, capable AI assistant embedded in a visual task and idea board. Think Jarvis: confident, efficient, direct. Never verbose.

${modeText}
${userSection}
Today: ${today}
Canvas: 6800×4200px. Origin top-left. Tasks ~252×162px, thoughts ~160–280×80px.
Board center: (3400, 2100).

════ BOARD STATE (ground truth — trust this exactly) ════
Active items: ${active.length} | Completed items: ${completed.length}
${boardText}
═══════════════════════════════════════════════════════

IMPORTANT: The board state above is injected directly from the user's live data. It is always accurate. NEVER say the board is empty or that tasks don't exist if items are listed above.

Current settings:
${ideaColorStr}
${taskColorStr}
${boardSettingsStr}
${ideaColorNoteInfo ? `Idea card colors: ${ideaColorNoteInfo}` : ""}

Idea color names: none (grey), pink, orchid, coral, peach, butter, lilac, blue, mint
Task color names: red, orange, yellow, pink, orchid, coral, peach, butter, lilac, blue, mint

Rules:
— ${mode === "advisor" ? "You have Google Search available. Use it freely for real-world info: places, hours, events, recommendations, current news, local spots, travel, or anything requiring up-to-date knowledge. Search first, then answer." : "You do NOT have web search in this mode. For real-world/location questions, suggest the user switch to Advisor mode."}
— Stream your thinking naturally, then call tools.
— After acting, narrate what you did in 1-2 sentences max.
— Reference actual note titles and IDs.
— Only ask for clarification if genuinely impossible to interpret.
— Never verbose. Be terse.
— NO OVERLAPS: when calling organize_board or placing multiple notes, space them at least 252px apart horizontally and 162px apart vertically. Arrange in a grid or row — never stack two notes at the same or near-same coordinates.
— When centering items, anchor the group around (3400, 2100). For N items, lay them out in a grid centered on that point: start from (3400 - cols/2 * 276, 2100 - rows/2 * 186) with 276px col stride and 186px row stride.`;
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

  let body: { message?: string; notes?: NoteSnap[]; activeBoardId?: string; mode?: Mode; history?: HistoryMsg[]; userInfo?: string; settings?: Settings };
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
  const mode: Mode = rawMode === "advisor" || rawMode === "autopilot" ? rawMode : "assistant";
  const userInfo = rawUserInfo.slice(0, 1000);
  // Filter to active board server-side — eliminates any client-side activeBoardId mismatch
  const notes = rawActiveBoardId
    ? rawNotes.filter(n => !n.boardId || n.boardId === rawActiveBoardId)
    : rawNotes;
  const history  = rawHistory.filter(
    h => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string"
  ).map(h => ({ role: h.role as "user" | "assistant", content: h.content.slice(0, 2000) }));
  const settings = body.settings;

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
    model: "gemini-2.5-flash",
    systemInstruction: buildSystem(notes, mode, userInfo, settings),
    // Gemini does not support mixing googleSearch + functionDeclarations.
    // Advisor mode: grounding only (no function calls). Action modes: function calls only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: mode === "advisor"
      ? [{ googleSearch: {} } as any]
      : [{ functionDeclarations: FUNCTION_DECLARATIONS as unknown as FunctionDeclaration[] }],
  });

  // Gemini uses "model" instead of "assistant" for role
  const geminiHistory = history.slice(-6).map(h => ({
    role: h.role === "assistant" ? "model" : "user" as "user" | "model",
    parts: [{ text: h.content }],
  }));

  const stream = makeSSE(async (push, signal) => {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessageStream(message);

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
