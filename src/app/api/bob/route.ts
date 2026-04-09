import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

type NoteSnap = {
  id: number; type: string; title: string; body?: string;
  importance?: string; dueDate?: string; minutes?: number;
  completed: boolean; x: number; y: number;
  steps?: { title: string; minutes: number; done: boolean }[];
};
type Mode = "advisor" | "assistant" | "autopilot";
type HistoryMsg = { role: "user" | "assistant"; content: string };

// ── Tools ────────────────────────────────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_note",
    description: "Create a new note or task on the board. Place it at an optimal position.",
    input_schema: {
      type: "object" as const,
      properties: {
        type:       { type: "string", enum: ["task", "thought"] },
        title:      { type: "string", description: "Concise title, max 60 chars" },
        body:       { type: "string", description: "Additional context, optional" },
        importance: { type: "string", enum: ["High", "Medium", "Low", "none"] },
        dueDate:    { type: "string", description: "ISO date YYYY-MM-DD, optional" },
        steps: {
          type: "array",
          items: { type: "object", properties: { title: { type: "string" }, minutes: { type: "number" } }, required: ["title", "minutes"] },
          description: "Subtasks for tasks, optional"
        },
      },
      required: ["type", "title"],
    },
  },
  {
    name: "edit_note",
    description: "Edit an existing note. Only specify the fields to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:     { type: "number", description: "The note ID to edit" },
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
    input_schema: {
      type: "object" as const,
      properties: {
        ids: { type: "array", items: { type: "number" }, description: "IDs of notes to delete" },
      },
      required: ["ids"],
    },
  },
  {
    name: "organize_board",
    description: "Move notes to new positions on the canvas. Use for sorting, grouping, or cleaning up the board.",
    input_schema: {
      type: "object" as const,
      properties: {
        positions: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "number" }, x: { type: "number" }, y: { type: "number" } },
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
    input_schema: {
      type: "object" as const,
      properties: {
        ids: { type: "array", items: { type: "number" }, description: "IDs of notes to highlight" },
      },
      required: ["ids"],
    },
  },
  {
    name: "launch_focus",
    description: "Launch focus mode for a task, starting its timer immediately.",
    input_schema: {
      type: "object" as const,
      properties: {
        noteId: { type: "number", description: "ID of the note to focus on" },
        chain:  { type: "boolean", description: "If true, auto-chain through subtasks when each timer ends" },
      },
      required: ["noteId"],
    },
  },
];

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystem(notes: NoteSnap[], mode: Mode): string {
  const active = notes.filter(n => !n.completed);
  const today  = new Date().toISOString().split("T")[0];

  const modeText = {
    advisor:
      "ADVISOR MODE — analyze and suggest only. Do NOT call action tools unless the user explicitly tells you to make a change. Frame everything as recommendations.",
    assistant:
      "ASSISTANT MODE — execute actions when clearly asked. For large or destructive changes, briefly say what you're about to do before calling tools.",
    autopilot:
      "AUTOPILOT MODE — act immediately, optimize on your own judgment, chain multiple tools if needed. Don't ask — just do. Narrate what you did afterwards in 1-2 sentences.",
  }[mode];

  const boardText = active.length
    ? active.map(n => {
        const p = [`[id:${n.id}] [${n.type.toUpperCase()}] "${n.title}"`];
        if (n.importance && n.importance !== "none") p.push(`priority:${n.importance}`);
        if (n.dueDate) p.push(`due:${n.dueDate}`);
        if (n.minutes) p.push(`~${n.minutes}min`);
        if (n.steps?.length) p.push(`${n.steps.filter(s => !s.done).length}/${n.steps.length} steps left`);
        if (n.body) p.push(`note:"${n.body.slice(0, 80)}"`);
        p.push(`pos:(${Math.round(n.x)},${Math.round(n.y)})`);
        return p.join(" | ");
      }).join("\n")
    : "Board is empty.";

  return `You are BOB (Boardtivity Operating Brain) — a sharp, capable AI assistant embedded in a visual task and idea board. Think Jarvis: confident, efficient, direct. Never verbose.

${modeText}

Today: ${today}
Canvas: tasks are ~252×168px, thoughts are ~160–280×80px. Origin is top-left. Typical layout spans 0–2000px on each axis.
Active board items: ${active.length}

${boardText}

Rules:
— Stream your thinking naturally, then call tools.
— After acting, narrate what you did in 1-2 sentences max.
— Reference actual note titles and IDs.
— Only ask for clarification if genuinely impossible to interpret.
— Never verbose. Be terse.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
function makeSSE(fn: (push: (obj: object) => void) => Promise<void>) {
  return new ReadableStream({
    async start(ctrl) {
      const push = (obj: object) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try { await fn(push); }
      catch (e) { push({ type: "error", message: String(e) }); }
      finally { ctrl.close(); }
    },
  });
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

  let body: { message?: string; notes?: NoteSnap[]; mode?: Mode; history?: HistoryMsg[] };
  try { body = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const { message = "", notes = [], mode = "assistant", history = [] } = body;
  if (!message.trim()) return new Response("No message", { status: 400 });

  // ── Mock mode ─────────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    const stream = makeSSE(async (push) => {
      const words = `Running in mock mode — no API key set. In ${mode} mode I'd handle that request fully. Connect an Anthropic API key to unlock the real BOB.`.split(" ");
      for (const w of words) {
        await new Promise(r => setTimeout(r, 55));
        push({ type: "token", text: w + " " });
      }
      push({ type: "done" });
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // ── Real mode ─────────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = makeSSE(async (push) => {
    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })) as Anthropic.MessageParam[],
      { role: "user", content: message },
    ];

    // Advisor mode gets no action tools
    const tools = mode === "advisor" ? [] : TOOLS;

    const toolBuffers = new Map<number, { name: string; json: string }>();
    let inputTokens  = 0;
    let outputTokens = 0;

    const response = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: buildSystem(notes, mode),
      tools: tools.length ? tools : undefined,
      messages,
    });

    for await (const event of response) {
      if (event.type === "message_start") {
        inputTokens = event.message.usage.input_tokens;
      } else if (event.type === "message_delta" && event.usage) {
        outputTokens = event.usage.output_tokens;
      } else if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          toolBuffers.set(event.index, { name: event.content_block.name, json: "" });
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          push({ type: "token", text: event.delta.text });
        } else if (event.delta.type === "input_json_delta") {
          const buf = toolBuffers.get(event.index);
          if (buf) buf.json += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        const buf = toolBuffers.get(event.index);
        if (buf) {
          try { push({ type: "tool", name: buf.name, input: JSON.parse(buf.json || "{}") }); }
          catch { /* malformed — skip */ }
          toolBuffers.delete(event.index);
        }
      }
    }

    // Send token counts so the client can record usage in Convex
    if (inputTokens > 0 || outputTokens > 0) {
      push({ type: "usage", inputTokens, outputTokens });
    }

    push({ type: "done" });
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
