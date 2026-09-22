import type { Step } from "@/lib/board";
import { genId } from "@/lib/boardLayout";

// Offline heuristics used when BOB is unavailable: time estimates and step breakdowns.

export function estimateTime(title: string) {
  const t = title.toLowerCase();
  if (t.includes("essay") || t.includes("paper") || t.includes("thesis")) return 120;
  if (t.includes("report") || t.includes("assignment") || t.includes("write")) return 90;
  if (t.includes("exam") || t.includes("final") || t.includes("midterm")) return 120;
  if (t.includes("study") || t.includes("chapter") || t.includes("review")) return 75;
  if (t.includes("quiz") || t.includes("test")) return 60;
  if (t.includes("presentation") || t.includes("slides") || t.includes("deck")) return 90;
  if (t.includes("project") || t.includes("build") || t.includes("develop")) return 120;
  if (t.includes("code") || t.includes("program") || t.includes("implement")) return 90;
  if (t.includes("debug") || t.includes("fix") || t.includes("refactor")) return 60;
  if (t.includes("resume") || t.includes("cover letter") || t.includes("apply")) return 75;
  if (t.includes("read") || t.includes("article") || t.includes("book")) return 60;
  if (t.includes("research") || t.includes("investigate") || t.includes("explore")) return 90;
  if (t.includes("design") || t.includes("mockup") || t.includes("wireframe")) return 90;
  if (t.includes("plan") || t.includes("outline") || t.includes("brainstorm")) return 45;
  if (t.includes("email") || t.includes("reply") || t.includes("message")) return 20;
  if (t.includes("meeting") || t.includes("call") || t.includes("interview")) return 60;
  if (t.includes("cook") || t.includes("meal") || t.includes("bake")) return 60;
  if (t.includes("clean") || t.includes("organize") || t.includes("tidy")) return 60;
  if (t.includes("workout") || t.includes("exercise") || t.includes("gym")) return 60;
  if (t.includes("shop") || t.includes("buy") || t.includes("order")) return 30;
  return 60;
}

export function buildBreakdown(title: string, body: string, total: number, variant = 0): Step[] {
  const t = (title + " " + body).toLowerCase().trim();
  let labels: string[];
  let weights: number[];
  const v = variant % 3;

  if (t.includes("essay") || t.includes("paper") || t.includes("thesis")) {
    const opts = [
      { l: total >= 90 ? ["Gather sources", "Outline", "Write intro", "Write body", "Write conclusion", "Revise & edit"] : total >= 60 ? ["Outline", "Research", "Draft", "Revise"] : ["Outline", "Draft", "Revise"], w: total >= 90 ? [0.1, 0.1, 0.15, 0.3, 0.15, 0.2] : total >= 60 ? [0.15, 0.2, 0.4, 0.25] : [0.2, 0.5, 0.3] },
      { l: total >= 60 ? ["Research & read", "Thesis & outline", "First draft", "Edit & polish"] : ["Outline", "Write", "Polish"], w: total >= 60 ? [0.25, 0.15, 0.4, 0.2] : [0.2, 0.5, 0.3] },
      { l: total >= 60 ? ["Brainstorm angle", "Outline structure", "Draft body", "Intro & conclusion", "Proofread"] : ["Outline", "Draft", "Proofread"], w: total >= 60 ? [0.1, 0.15, 0.4, 0.2, 0.15] : [0.2, 0.5, 0.3] },
    ];
    ({ l: labels, w: weights } = opts[v]); weights = (opts[v] as any).w;
  } else if (t.includes("exam") || t.includes("final") || t.includes("midterm")) {
    const opts = [
      { l: total >= 90 ? ["Review notes", "Study key concepts", "Practice problems", "Test yourself", "Review weak areas"] : ["Review notes", "Study concepts", "Practice & test"], w: total >= 90 ? [0.15, 0.25, 0.3, 0.2, 0.1] : [0.3, 0.45, 0.25] },
      { l: total >= 90 ? ["Skim all notes", "Deep dive topics", "Flashcard drill", "Mock test", "Fix gaps"] : ["Skim notes", "Deep study", "Self-test"], w: total >= 90 ? [0.1, 0.3, 0.25, 0.25, 0.1] : [0.25, 0.45, 0.3] },
      { l: total >= 90 ? ["Prioritize topics", "Review formulas", "Work examples", "Timed practice", "Weak spots"] : ["Prioritize", "Study", "Practice"], w: total >= 90 ? [0.1, 0.2, 0.3, 0.3, 0.1] : [0.2, 0.5, 0.3] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("study") || t.includes("chapter") || t.includes("review")) {
    const opts = [
      { l: total >= 60 ? ["Skim & preview", "Read actively", "Take notes", "Review & summarize"] : ["Read", "Take notes", "Review"], w: total >= 60 ? [0.1, 0.35, 0.3, 0.25] : [0.4, 0.35, 0.25] },
      { l: total >= 60 ? ["Preview headings", "Careful read", "Annotate key ideas", "Summarize"] : ["Read", "Annotate", "Summarize"], w: total >= 60 ? [0.1, 0.4, 0.25, 0.25] : [0.4, 0.35, 0.25] },
      { l: total >= 60 ? ["Set goals", "Active reading", "Note key points", "Quiz yourself"] : ["Read", "Note", "Quiz"], w: total >= 60 ? [0.05, 0.4, 0.3, 0.25] : [0.4, 0.35, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("presentation") || t.includes("slides") || t.includes("deck")) {
    const opts = [
      { l: total >= 75 ? ["Research topic", "Outline structure", "Build slides", "Add visuals", "Practice delivery"] : ["Outline", "Build slides", "Practice"], w: total >= 75 ? [0.2, 0.15, 0.3, 0.15, 0.2] : [0.2, 0.5, 0.3] },
      { l: total >= 75 ? ["Define message", "Draft outline", "Design slides", "Refine content", "Run through"] : ["Outline", "Design", "Practice"], w: total >= 75 ? [0.15, 0.15, 0.35, 0.15, 0.2] : [0.2, 0.5, 0.3] },
      { l: total >= 75 ? ["Gather content", "Story structure", "Build deck", "Visual polish", "Practice aloud"] : ["Plan", "Build", "Polish"], w: total >= 75 ? [0.2, 0.1, 0.3, 0.2, 0.2] : [0.2, 0.5, 0.3] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("code") || t.includes("program") || t.includes("implement") || t.includes("build") || t.includes("develop")) {
    const opts = [
      { l: total >= 90 ? ["Plan & design", "Set up", "Implement core", "Handle edge cases", "Test", "Review & clean up"] : total >= 60 ? ["Plan", "Implement", "Test", "Review"] : ["Plan", "Implement", "Test"], w: total >= 90 ? [0.12, 0.08, 0.35, 0.2, 0.15, 0.1] : total >= 60 ? [0.15, 0.45, 0.25, 0.15] : [0.2, 0.55, 0.25] },
      { l: total >= 90 ? ["Define requirements", "Architecture", "Core logic", "UI/integration", "Tests", "Cleanup"] : total >= 60 ? ["Design", "Build", "Test", "Polish"] : ["Design", "Build", "Test"], w: total >= 90 ? [0.1, 0.12, 0.35, 0.2, 0.13, 0.1] : total >= 60 ? [0.15, 0.45, 0.25, 0.15] : [0.2, 0.55, 0.25] },
      { l: total >= 90 ? ["Spec & pseudocode", "Scaffold", "Feature work", "Error handling", "Testing", "Review"] : total >= 60 ? ["Pseudocode", "Code", "Debug", "Refine"] : ["Spec", "Code", "Test"], w: total >= 90 ? [0.1, 0.1, 0.35, 0.18, 0.17, 0.1] : total >= 60 ? [0.1, 0.5, 0.25, 0.15] : [0.2, 0.55, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("debug") || t.includes("fix") || t.includes("refactor")) {
    const opts = [
      { l: ["Reproduce issue", "Identify root cause", "Fix", "Test fix"], w: [0.15, 0.3, 0.35, 0.2] },
      { l: ["Isolate bug", "Trace cause", "Patch", "Verify & test"], w: [0.2, 0.25, 0.35, 0.2] },
      { l: ["Read error logs", "Find source", "Apply fix", "Regression test"], w: [0.15, 0.3, 0.35, 0.2] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("research") || t.includes("investigate") || t.includes("explore")) {
    const opts = [
      { l: total >= 75 ? ["Define scope", "Find sources", "Read & annotate", "Synthesize findings", "Summarize"] : ["Find sources", "Read & note", "Synthesize"], w: total >= 75 ? [0.1, 0.2, 0.35, 0.25, 0.1] : [0.25, 0.45, 0.3] },
      { l: total >= 75 ? ["Frame question", "Search sources", "Deep read", "Extract insights", "Write up"] : ["Search", "Read & note", "Write up"], w: total >= 75 ? [0.1, 0.2, 0.35, 0.25, 0.1] : [0.2, 0.5, 0.3] },
      { l: total >= 75 ? ["Set objectives", "Collect data", "Analyze", "Draw conclusions", "Document"] : ["Collect", "Analyze", "Document"], w: total >= 75 ? [0.1, 0.25, 0.35, 0.2, 0.1] : [0.3, 0.4, 0.3] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("design") || t.includes("mockup") || t.includes("wireframe")) {
    const opts = [
      { l: ["Gather inspiration", "Wireframe", "Design", "Refine & review"], w: [0.15, 0.2, 0.45, 0.2] },
      { l: ["Moodboard", "Low-fi sketch", "High-fi design", "Iterate"], w: [0.15, 0.2, 0.45, 0.2] },
      { l: ["Define goals", "Rough layout", "Visual design", "Polish & export"], w: [0.1, 0.2, 0.5, 0.2] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("resume") || t.includes("cover letter") || t.includes("apply")) {
    const opts = [
      { l: total >= 60 ? ["Research role", "Update resume", "Write cover letter", "Review & submit"] : ["Update resume", "Write cover letter", "Submit"], w: total >= 60 ? [0.2, 0.3, 0.3, 0.2] : [0.35, 0.4, 0.25] },
      { l: total >= 60 ? ["Study job posting", "Tailor resume", "Draft cover letter", "Final review"] : ["Tailor resume", "Cover letter", "Submit"], w: total >= 60 ? [0.2, 0.3, 0.3, 0.2] : [0.35, 0.4, 0.25] },
      { l: total >= 60 ? ["List requirements", "Edit experience", "Personalize letter", "Proofread & send"] : ["Edit resume", "Write letter", "Submit"], w: total >= 60 ? [0.15, 0.3, 0.35, 0.2] : [0.35, 0.4, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("read") || t.includes("article") || t.includes("book")) {
    const opts = [
      { l: total >= 60 ? ["Skim headings", "Read section 1", "Read section 2", "Summarize key points"] : ["Read", "Take notes", "Summarize"], w: total >= 60 ? [0.1, 0.35, 0.35, 0.2] : [0.5, 0.3, 0.2] },
      { l: total >= 60 ? ["Preview structure", "Active reading", "Highlight & note", "Review takeaways"] : ["Read", "Highlight", "Review"], w: total >= 60 ? [0.1, 0.45, 0.25, 0.2] : [0.5, 0.3, 0.2] },
      { l: total >= 60 ? ["Set intention", "First read-through", "Re-read key parts", "Synthesize"] : ["Read", "Re-read", "Synthesize"], w: total >= 60 ? [0.05, 0.4, 0.3, 0.25] : [0.5, 0.3, 0.2] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("plan") || t.includes("outline") || t.includes("brainstorm")) {
    const opts = [
      { l: ["Brainstorm ideas", "Organize thoughts", "Draft plan", "Review & refine"], w: [0.25, 0.25, 0.3, 0.2] },
      { l: ["Dump all ideas", "Group themes", "Prioritize", "Write action plan"], w: [0.25, 0.2, 0.25, 0.3] },
      { l: ["Free-write", "Find patterns", "Structure plan", "Finalize"], w: [0.25, 0.2, 0.3, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (t.includes("email") || t.includes("reply") || t.includes("message")) {
    labels = ["Draft", "Review & send"]; weights = [0.65, 0.35];
  } else if (t.includes("clean") || t.includes("organize") || t.includes("tidy")) {
    const opts = [
      { l: total >= 60 ? ["Clear surface", "Sort & declutter", "Clean", "Organize & put away"] : ["Declutter", "Clean", "Organize"], w: total >= 60 ? [0.2, 0.25, 0.3, 0.25] : [0.3, 0.4, 0.3] },
      { l: total >= 60 ? ["Remove trash", "Category sort", "Wipe & clean", "Store neatly"] : ["Sort", "Clean", "Store"], w: total >= 60 ? [0.15, 0.25, 0.35, 0.25] : [0.3, 0.4, 0.3] },
      { l: total >= 60 ? ["Purge extras", "Group by type", "Deep clean", "Final organize"] : ["Purge", "Clean", "Arrange"], w: total >= 60 ? [0.2, 0.2, 0.35, 0.25] : [0.3, 0.4, 0.3] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else if (total <= 20) {
    labels = ["Start", "Finish"]; weights = [0.6, 0.4];
  } else if (total <= 45) {
    const opts = [
      { l: ["Prepare", "Do", "Wrap up"], w: [0.2, 0.6, 0.2] },
      { l: ["Set up", "Execute", "Finish"], w: [0.2, 0.6, 0.2] },
      { l: ["Gather", "Work", "Review"], w: [0.2, 0.6, 0.2] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  } else {
    const opts = [
      { l: total >= 90 ? ["Prepare", "Start", "Do", "Review & finish"] : ["Prepare", "Do", "Review"], w: total >= 90 ? [0.15, 0.25, 0.4, 0.2] : [0.2, 0.55, 0.25] },
      { l: total >= 90 ? ["Set up", "Build momentum", "Deep work", "Wrap up"] : ["Set up", "Execute", "Wrap up"], w: total >= 90 ? [0.1, 0.2, 0.5, 0.2] : [0.15, 0.6, 0.25] },
      { l: total >= 90 ? ["Clarify", "Get started", "Main work", "Polish & close"] : ["Clarify", "Do", "Close"], w: total >= 90 ? [0.1, 0.2, 0.5, 0.2] : [0.15, 0.6, 0.25] },
    ];
    labels = opts[v].l; weights = opts[v].w;
  }

  const steps = labels.map((label, i) => ({
    id: genId(),
    title: label,
    minutes: Math.max(5, Math.round((total * weights[i]) / 5) * 5),
    done: false,
    x: 0,
    y: 0,
  }));

  const assigned = steps.reduce((sum, s) => sum + s.minutes, 0);
  const diff = total - assigned;
  if (diff !== 0) steps[steps.length - 1].minutes = Math.max(5, steps[steps.length - 1].minutes + diff);

  return steps;
}
