import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

type NoteSnap = {
  id: number; type: string; title: string; body?: string;
  importance?: string; dueDate?: string; minutes?: number;
  completed: boolean;
  steps?: { title: string; minutes: number; done: boolean }[];
};

// ── Mock responses for local dev without an API key ──────────────────────────
const MOCK_BRAIN: Record<string, string> = {
  whatFirst: "Start with your highest-priority task first — the one marked High importance or with the closest due date. Knock it out while you're fresh, then work through the rest in order.",
  summary: "Your board looks active. You've got a mix of tasks and ideas spread across a few priority levels. Nothing looks critically overdue — but a few items are getting close. Worth a quick triage.",
  overdue: "Scanning your board… nothing is past due right now. Your closest deadline is coming up soon though — make sure you've got time blocked for it before it sneaks up on you.",
};

const MOCK_VOICE = {
  type: "task",
  title: "Follow up on project proposal",
  body: "Send updated draft to stakeholders",
  importance: "High",
  steps: [
    { title: "Revise the executive summary", minutes: 20 },
    { title: "Send to stakeholders", minutes: 5 },
  ],
};

export async function POST(req: NextRequest) {
  let body: { action: string; notes?: NoteSnap[]; query?: string; transcript?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, notes = [], query, transcript } = body;

  // ── Mock mode: no API key set ─────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    if (action === "brain") {
      const key = (query ?? "whatFirst") as keyof typeof MOCK_BRAIN;
      const text = MOCK_BRAIN[key] ?? MOCK_BRAIN.whatFirst;
      // Simulate ~0.6s latency so the loading state is visible
      await new Promise(r => setTimeout(r, 600));
      return NextResponse.json({ response: `[MOCK] ${text}` });
    }
    if (action === "voice") {
      if (!transcript?.trim()) return NextResponse.json({ error: "No transcript" }, { status: 400 });
      await new Promise(r => setTimeout(r, 500));
      return NextResponse.json({ task: { ...MOCK_VOICE, title: transcript.slice(0, 60) } });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // ── Real mode ────────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (action === "brain") {
    const active = notes.filter(n => !n.completed);
    if (!active.length) {
      return NextResponse.json({ response: "Your board is empty — add some tasks and I'll help you prioritize." });
    }

    const boardSummary = active.map(n => {
      const parts = [`[${n.type.toUpperCase()}] "${n.title}"`];
      if (n.importance && n.importance !== "none") parts.push(`priority:${n.importance}`);
      if (n.dueDate)  parts.push(`due:${n.dueDate}`);
      if (n.minutes)  parts.push(`~${n.minutes}min`);
      if (n.steps?.length) parts.push(`${n.steps.filter(s => !s.done).length}/${n.steps.length} subtasks left`);
      if (n.body)     parts.push(`note:"${n.body.slice(0, 80)}"`);
      return parts.join(" | ");
    }).join("\n");

    const prompts: Record<string, string> = {
      whatFirst: `You are BOB (Boardtivity Operating Brain). The user has these active items:\n\n${boardSummary}\n\nTell them what to tackle first and why. Be direct and human. 2-4 sentences. Reference actual task names.`,
      summary:   `You are BOB. Summarize this board:\n\n${boardSummary}\n\nGive a crisp 3-5 sentence overview: item count, types, priority landscape, patterns. Sound like a smart colleague.`,
      overdue:   `You are BOB. Today is ${new Date().toISOString().split("T")[0]}.\n\n${boardSummary}\n\nIdentify overdue or imminent items. Be specific. If nothing is overdue, note what's coming up next.`,
    };

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompts[query ?? "whatFirst"] ?? prompts.whatFirst }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    return NextResponse.json({ response: text });
  }

  if (action === "voice") {
    if (!transcript?.trim()) return NextResponse.json({ error: "No transcript" }, { status: 400 });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are BOB. The user said:\n\n"${transcript}"\n\nParse into a structured task. Return ONLY valid JSON:\n{\n  "type": "task" or "idea",\n  "title": "concise title (max 60 chars)",\n  "body": "context if any (max 120 chars, empty string if none)",\n  "importance": "High" or "Medium" or "Low" or "none",\n  "steps": [{ "title": "step", "minutes": 15 }]\n}\n\nOnly include steps if user mentioned multiple parts. Max 6 steps. Return ONLY the JSON.`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    try {
      return NextResponse.json({ task: JSON.parse(raw) });
    } catch {
      return NextResponse.json({ error: "Parse failed", raw }, { status: 422 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
