import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

type NoteSnap = {
  id: number;
  type: string;
  title: string;
  body?: string;
  importance?: string;
  dueDate?: string;
  minutes?: number;
  completed: boolean;
  steps?: { title: string; minutes: number; done: boolean }[];
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  let body: { action: string; notes?: NoteSnap[]; query?: string; transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, notes = [], query, transcript } = body;

  // ── Brain queries ──────────────────────────────────────────────────────────
  if (action === "brain") {
    const active = notes.filter((n) => !n.completed);
    const boardSummary = active.map((n) => {
      const parts = [`[${n.type.toUpperCase()}] "${n.title}"`];
      if (n.importance && n.importance !== "none") parts.push(`priority:${n.importance}`);
      if (n.dueDate) parts.push(`due:${n.dueDate}`);
      if (n.minutes) parts.push(`~${n.minutes}min`);
      if (n.steps?.length) parts.push(`${n.steps.filter(s => !s.done).length}/${n.steps.length} subtasks left`);
      if (n.body) parts.push(`note:"${n.body.slice(0, 80)}"`);
      return parts.join(" | ");
    }).join("\n");

    if (!active.length) {
      return NextResponse.json({ response: "Your board is empty — add some tasks and I'll help you prioritize." });
    }

    const prompts: Record<string, string> = {
      whatFirst: `You are Luma, a smart board agent. The user has these active items:\n\n${boardSummary}\n\nTell them what to tackle first and why. Be direct and human. 2-4 sentences. Reference actual task names. Pick the 2-3 most urgent and explain briefly.`,
      summary: `You are Luma. Summarize this board:\n\n${boardSummary}\n\nGive a crisp 3-5 sentence overview: item count, types, priority landscape, any patterns. Sound like a smart colleague.`,
      overdue: `You are Luma. Today is ${new Date().toISOString().split("T")[0]}. Review:\n\n${boardSummary}\n\nIdentify overdue or imminent items. Be specific about dates. If nothing is overdue, note what's coming up next.`,
    };

    const { text } = await generateText({
      model: anthropic("claude-haiku-4.5"),
      prompt: prompts[query ?? "whatFirst"] ?? prompts.whatFirst,
      maxOutputTokens: 300,
    });

    return NextResponse.json({ response: text });
  }

  // ── Voice → task parsing ───────────────────────────────────────────────────
  if (action === "voice") {
    if (!transcript?.trim()) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const { text } = await generateText({
      model: anthropic("claude-haiku-4.5"),
      prompt: `You are Luma. The user said:\n\n"${transcript}"\n\nParse into a structured task. Return ONLY valid JSON:\n{\n  "type": "task" or "idea",\n  "title": "concise title (max 60 chars)",\n  "body": "context if any (max 120 chars, empty string if none)",\n  "importance": "High" or "Medium" or "Low" or "none",\n  "steps": [{ "title": "step", "minutes": 15 }]\n}\n\nOnly include steps if the user mentioned multiple parts or asked to break it down. Max 6 steps. Return ONLY the JSON object.`,
      maxOutputTokens: 400,
    });

    try {
      const parsed = JSON.parse(text.trim());
      return NextResponse.json({ task: parsed });
    } catch {
      return NextResponse.json({ error: "Parse failed", raw: text }, { status: 422 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
