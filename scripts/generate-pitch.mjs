import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33" x 7.5"

// ─── Brand ───────────────────────────────────────────────────────────────────
const INK       = "111315";
const CREAM     = "F3F1EB";
const WHITE     = "FFFFFF";
const MUTED     = "888880";
const BORDER    = "E0DDD6";
const GREEN     = "3A9E56";
const BLUE      = "4A7EF5";
const PURPLE    = "9B6FE8";
const ORANGE    = "E07B54";

const W = 13.33;
const H = 7.5;

function eyebrow(slide, text, y = 0.55) {
  slide.addText(text.toUpperCase(), {
    x: 0.7, y, w: W - 1.4, h: 0.22,
    fontSize: 9, bold: true, color: MUTED,
    charSpacing: 2, fontFace: "Arial",
  });
}

function heading(slide, text, y = 0.85, size = 38, color = INK) {
  slide.addText(text, {
    x: 0.7, y, w: W - 1.4, h: 1.6,
    fontSize: size, bold: true, color,
    fontFace: "Arial", lineSpacingMultiple: 1.1,
    breakLine: false,
  });
}

function subtext(slide, text, y = 1.85, color = MUTED) {
  slide.addText(text, {
    x: 0.7, y, w: 8.5, h: 0.8,
    fontSize: 14, color, fontFace: "Arial",
    lineSpacingMultiple: 1.5,
  });
}

function card(slide, x, y, w, h, bg = WHITE) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: bg },
    line: { color: BORDER, width: 0.75 },
    rectRadius: 0.12,
  });
}

function cardLabel(slide, text, x, y, color = MUTED) {
  slide.addText(text.toUpperCase(), {
    x: x + 0.22, y: y + 0.2, w: 3.5, h: 0.2,
    fontSize: 8, bold: true, color, charSpacing: 1.5, fontFace: "Arial",
  });
}

function cardTitle(slide, text, x, y, w = 3.2) {
  slide.addText(text, {
    x: x + 0.22, y: y + 0.48, w, h: 0.55,
    fontSize: 15, bold: true, color: INK, fontFace: "Arial",
  });
}

function cardBody(slide, text, x, y, w = 3.2) {
  slide.addText(text, {
    x: x + 0.22, y: y + 1.0, w, h: 1.0,
    fontSize: 11, color: MUTED, fontFace: "Arial",
    lineSpacingMultiple: 1.5,
  });
}

// ─── SLIDE 1: COVER ──────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: INK };

  // Big tag line
  s.addText("The visual board for\ntasks, ideas, and deep focus.", {
    x: 0.7, y: 1.6, w: 9, h: 2.4,
    fontSize: 46, bold: true, color: WHITE,
    fontFace: "Arial", lineSpacingMultiple: 1.1,
  });

  s.addText("Boardtivity turns scattered to-dos and half-formed thoughts into one visual workspace — with AI-powered breakdowns, a countdown focus timer, and real-time sync across all devices.", {
    x: 0.7, y: 4.2, w: 9.2, h: 1.2,
    fontSize: 14, color: "888888", fontFace: "Arial",
    lineSpacingMultiple: 1.6,
  });

  s.addText("BOARDTIVITY", {
    x: 0.7, y: 0.5, w: 4, h: 0.36,
    fontSize: 13, bold: true, color: "444444",
    fontFace: "Arial", charSpacing: 3,
  });

  // Launching pill
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.7, y: 5.7, w: 2.1, h: 0.38,
    fill: { color: "1E2228" },
    line: { color: "333333", width: 0.5 },
    rectRadius: 0.19,
  });
  s.addText("● Launching on Product Hunt", {
    x: 0.75, y: 5.72, w: 2.0, h: 0.34,
    fontSize: 9, color: "5A9A5A", fontFace: "Arial", bold: true,
  });

  // Slide number
  s.addText("01 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: "333333", fontFace: "Arial", align: "right" });
}

// ─── SLIDE 2: PROBLEM ────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };

  eyebrow(s, "The problem");
  heading(s, "Productivity tools are\nbusy, not useful.", 0.75, 34);
  subtext(s, "Most apps demand more overhead than the work they're managing. You end up managing your tools instead of doing your work.", 1.95);

  const cards = [
    { icon: "🗂", title: "Tab overload", body: "Tasks here, notes there, ideas somewhere else. Context-switching kills flow before it starts." },
    { icon: "⏱", title: "No sense of time", body: "Lists have no urgency. You can add 50 tasks but still feel lost about what to work on now." },
    { icon: "💭", title: "Ideas get buried", body: "Fleeting thoughts belong somewhere visual and connected — not in a bullet-point graveyard." },
  ];
  const cw = 3.8, cx0 = 0.7, cy = 3.1;
  cards.forEach((c, i) => {
    const cx = cx0 + i * (cw + 0.25);
    card(s, cx, cy, cw, 3.5);
    s.addText(c.icon, { x: cx + 0.22, y: cy + 0.28, w: 0.6, h: 0.6, fontSize: 26, fontFace: "Arial" });
    cardTitle(s, c.title, cx, cy + 0.4, 3.3);
    cardBody(s, c.body, cx, cy + 0.4, 3.3);
  });

  s.addText("02 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial", align: "right" });
}

// ─── SLIDE 3: SOLUTION ───────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };

  eyebrow(s, "Our solution");
  heading(s, "One canvas.\nEverything in it.", 0.75, 34);
  subtext(s, "Boardtivity is a visual, draggable workspace where tasks and ideas live side-by-side — and where AI helps you break work down and lock in to get it done.", 1.95);

  const feats = [
    { emoji: "🗓", color: "E8F4FF", title: "Task boards", body: "Add tasks with due dates, priorities, and subtasks. Drag them around a free-form canvas." },
    { emoji: "💡", color: "F0EBFF", title: "Idea boards", body: "Capture thoughts as colorful cards and connect them visually. Build a map of your thinking." },
    { emoji: "⏳", color: "EAFFF0", title: "Focus mode", body: "A fullscreen countdown timer locks you into one task. No distractions. Just the work." },
    { emoji: "🔄", color: "FFF5E8", title: "Cross-device sync", body: "Your boards are automatically saved and synced in real time. Pick up on any device." },
  ];
  const fw = 5.85, fh = 1.5;
  feats.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const fx = 0.7 + col * (fw + 0.28);
    const fy = 3.1 + row * (fh + 0.18);
    card(s, fx, fy, fw, fh);
    s.addShape(pptx.ShapeType.roundRect, { x: fx + 0.2, y: fy + 0.28, w: 0.5, h: 0.5, fill: { color: f.color }, line: { color: BORDER, width: 0 }, rectRadius: 0.1 });
    s.addText(f.emoji, { x: fx + 0.21, y: fy + 0.28, w: 0.48, h: 0.48, fontSize: 20, fontFace: "Arial", align: "center", valign: "middle" });
    s.addText(f.title, { x: fx + 0.85, y: fy + 0.26, w: fw - 1.1, h: 0.3, fontSize: 13, bold: true, color: INK, fontFace: "Arial" });
    s.addText(f.body, { x: fx + 0.85, y: fy + 0.62, w: fw - 1.1, h: 0.7, fontSize: 11, color: MUTED, fontFace: "Arial", lineSpacingMultiple: 1.4 });
  });

  s.addText("03 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial", align: "right" });
}

// ─── SLIDE 4: PRODUCT ────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };

  eyebrow(s, "Product");
  heading(s, "Built around how\nyou actually think.", 0.75, 34);

  const modules = [
    { badge: "Task Board", bc: "E8F4FF", tc: "3060C0", title: "Structure your work", bullets: ["Due dates, priorities, subtask breakdown", "Drag-and-drop canvas layout", "Priority color coding (Low/Med/High)", "Progress tracking per task"] },
    { badge: "Idea Board", bc: "F0EBFF", tc: "6A3EC2", title: "Capture your thinking", bullets: ["Colorful sticky-style cards", "Drag-to-link visual connections", "Hover-to-unlink interactions", "Per-board color palettes"] },
    { badge: "Focus Mode", bc: "EAFFF0", tc: "256838", title: "Lock in and execute", bullets: ["Fullscreen countdown timer", "Taskchain (sequential) or Taskweb (visual)", "Auto-completes tasks on finish", "Immersive, distraction-free UI"] },
    { badge: "Sync & Boards", bc: "FFF5E8", tc: "B05020", title: "Your workspace, everywhere", bullets: ["Instant cloud save on every change", "Multiple named boards per type", "Dark mode + light mode", "Grid, dots, or blank canvas"] },
  ];
  const mw = 5.85, mh = 2.55;
  modules.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const mx = 0.7 + col * (mw + 0.28);
    const my = 2.0 + row * (mh + 0.18);
    card(s, mx, my, mw, mh);
    // Badge
    s.addShape(pptx.ShapeType.roundRect, { x: mx + 0.2, y: my + 0.2, w: 1.2, h: 0.26, fill: { color: m.bc }, line: { color: BORDER, width: 0 }, rectRadius: 0.13 });
    s.addText(m.badge, { x: mx + 0.2, y: my + 0.2, w: 1.2, h: 0.26, fontSize: 8, bold: true, color: m.tc, fontFace: "Arial", align: "center", valign: "middle" });
    s.addText(m.title, { x: mx + 0.2, y: my + 0.54, w: mw - 0.4, h: 0.3, fontSize: 13, bold: true, color: INK, fontFace: "Arial" });
    m.bullets.forEach((b, bi) => {
      s.addText("→  " + b, { x: mx + 0.2, y: my + 0.94 + bi * 0.36, w: mw - 0.4, h: 0.3, fontSize: 10.5, color: MUTED, fontFace: "Arial" });
    });
  });

  s.addText("04 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial", align: "right" });
}

// ─── SLIDE 5: AI ─────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };

  eyebrow(s, "AI-powered");
  heading(s, "From vague goal\nto actionable plan.", 0.75, 34);
  subtext(s, "Describe a task — Boardtivity breaks it into timed subtasks with realistic estimates for each step. Editable, re-generatable, and immediately actionable.", 1.95);

  const steps = [
    { n: "01", title: "Breakdown Task", body: '"Ship the landing page" → Write copy (20 min), Design mockup (45 min), Build in code (60 min), QA + deploy (20 min). Total: 145 min.' },
    { n: "02", title: "Time is linked", body: "Adjust any subtask's time and the total updates automatically. Build time estimates from the bottom up, not from guesswork." },
    { n: "03", title: "Focus flow", body: "Hit Start Focus. The timer walks through each subtask in sequence — one at a time, locked in, until the whole task is done." },
    { n: "04", title: "No AI overhead", body: "AI features are opt-in. Skip breakdown entirely and Boardtivity works as a fast, clean board with no AI clutter in the way." },
  ];
  const sw = 2.85, sh = 2.6;
  steps.forEach((step, i) => {
    const sx = 0.7 + i * (sw + 0.18);
    card(s, sx, 3.05, sw, sh);
    s.addText(step.n, { x: sx + 0.2, y: 3.25, w: 1, h: 0.22, fontSize: 9, bold: true, color: MUTED, charSpacing: 1.5, fontFace: "Arial" });
    s.addText(step.title, { x: sx + 0.2, y: 3.54, w: sw - 0.3, h: 0.4, fontSize: 14, bold: true, color: INK, fontFace: "Arial" });
    s.addText(step.body, { x: sx + 0.2, y: 4.05, w: sw - 0.3, h: 1.4, fontSize: 10.5, color: MUTED, fontFace: "Arial", lineSpacingMultiple: 1.5 });
  });

  s.addText("05 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial", align: "right" });
}

// ─── SLIDE 6: MARKET ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };

  eyebrow(s, "Market opportunity");
  heading(s, "A massive market\nstill looking for better.", 0.75, 34);

  const stats = [
    { val: "$131B", label: "Global productivity software market (2024)", color: BLUE },
    { val: "14.4%", label: "Projected CAGR through 2030", color: PURPLE },
    { val: "1.25B", label: "Knowledge workers globally — our core audience", color: GREEN },
  ];
  const sw = 3.8;
  stats.forEach((st, i) => {
    const sx = 0.7 + i * (sw + 0.25);
    card(s, sx, 2.05, sw, 2.1);
    s.addText(st.val, { x: sx + 0.25, y: 2.25, w: sw - 0.4, h: 0.9, fontSize: 38, bold: true, color: st.color, fontFace: "Arial" });
    s.addText(st.label, { x: sx + 0.25, y: 3.05, w: sw - 0.4, h: 0.7, fontSize: 11, color: MUTED, fontFace: "Arial", lineSpacingMultiple: 1.4 });
  });

  // Wedge note
  card(s, 0.7, 4.4, W - 1.4, 1.7);
  s.addText("Our wedge:", { x: 0.95, y: 4.6, w: 1.2, h: 0.3, fontSize: 12, bold: true, color: INK, fontFace: "Arial" });
  s.addText("Boardtivity targets individuals and small teams who find Notion too heavy, Trello too simple, and Obsidian too nerdy. We sit at the intersection of visual task management, idea capture, and AI-assisted focus — a combination no one else owns.", {
    x: 0.95, y: 4.96, w: W - 1.9, h: 0.9,
    fontSize: 11.5, color: MUTED, fontFace: "Arial", lineSpacingMultiple: 1.5,
  });

  s.addText("06 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial", align: "right" });
}

// ─── SLIDE 7: BUSINESS MODEL ─────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };

  eyebrow(s, "Business model");
  heading(s, "Free to start.\nPlus for power users.", 0.75, 34);
  subtext(s, "A freemium model that gets users hooked on the core experience, then converts naturally when they need more boards.", 1.95);

  const tw = 5.85;

  // Free tier
  card(s, 0.7, 2.85, tw, 4.1);
  s.addText("FREE", { x: 0.95, y: 3.05, w: 2, h: 0.22, fontSize: 9, bold: true, color: MUTED, charSpacing: 2, fontFace: "Arial" });
  s.addText("$0", { x: 0.95, y: 3.32, w: 2, h: 0.72, fontSize: 40, bold: true, color: INK, fontFace: "Arial" });
  s.addText("Forever free, no credit card", { x: 0.95, y: 3.95, w: tw - 0.5, h: 0.28, fontSize: 11, color: MUTED, fontFace: "Arial" });
  ["1 task board + 1 idea board", "AI task breakdown", "Focus mode", "Cross-device sync", "Dark mode"].forEach((p, i) => {
    s.addText("✓  " + p, { x: 0.95, y: 4.34 + i * 0.35, w: tw - 0.5, h: 0.28, fontSize: 11.5, color: INK, fontFace: "Arial" });
  });

  // Plus tier (dark)
  s.addShape(pptx.ShapeType.roundRect, { x: 0.7 + tw + 0.28, y: 2.85, w: tw, h: 4.1, fill: { color: INK }, line: { color: INK, width: 0 }, rectRadius: 0.12 });
  const px = 0.7 + tw + 0.28;
  s.addText("PLUS", { x: px + 0.25, y: 3.05, w: 2, h: 0.22, fontSize: 9, bold: true, color: "444444", charSpacing: 2, fontFace: "Arial" });
  s.addText("$8", { x: px + 0.25, y: 3.32, w: 1.2, h: 0.72, fontSize: 40, bold: true, color: WHITE, fontFace: "Arial" });
  s.addText("/mo", { x: px + 1.3, y: 3.75, w: 1, h: 0.3, fontSize: 16, bold: true, color: "666666", fontFace: "Arial" });
  s.addText("Everything in Free, plus:", { x: px + 0.25, y: 3.95, w: tw - 0.5, h: 0.28, fontSize: 11, color: "666666", fontFace: "Arial" });
  ["Unlimited task & idea boards", "Priority support", "Early access to new features", "Export & integrations (roadmap)", "Lock in launch pricing"].forEach((p, i) => {
    s.addText("✓  " + p, { x: px + 0.25, y: 4.34 + i * 0.35, w: tw - 0.5, h: 0.28, fontSize: 11.5, color: WHITE, fontFace: "Arial" });
  });

  s.addText("07 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial", align: "right" });
}

// ─── SLIDE 8: TRACTION & ROADMAP ─────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: CREAM };

  eyebrow(s, "Traction & roadmap");
  heading(s, "Live, growing,\njust getting started.", 0.75, 34);

  const tCards = [
    { val: "Day 1", label: "Launching publicly on Product Hunt today — built in stealth, now open.", color: BLUE },
    { val: "Full", label: "Working product: AI breakdown, focus mode, sync, idea boards, admin.", color: GREEN },
    { val: "Solo", label: "Built end-to-end by a solo founder. Fast iteration, high conviction.", color: PURPLE },
  ];
  const tw = 3.8;
  tCards.forEach((t, i) => {
    const tx = 0.7 + i * (tw + 0.25);
    card(s, tx, 2.05, tw, 1.7);
    s.addText(t.val, { x: tx + 0.25, y: 2.22, w: tw - 0.4, h: 0.56, fontSize: 32, bold: true, color: t.color, fontFace: "Arial" });
    s.addText(t.label, { x: tx + 0.25, y: 2.78, w: tw - 0.4, h: 0.7, fontSize: 10.5, color: MUTED, fontFace: "Arial", lineSpacingMultiple: 1.4 });
  });

  // Roadmap
  card(s, 0.7, 4.0, W - 1.4, 3.05);
  s.addText("ROADMAP", { x: 0.95, y: 4.2, w: 3, h: 0.22, fontSize: 9, bold: true, color: MUTED, charSpacing: 2, fontFace: "Arial" });
  const roadmap = [
    { q: "Q2 '25", text: "Mobile-responsive + PWA", sub: "Full touch support, installable on iOS/Android" },
    { q: "Q3 '25", text: "Team boards & shared workspaces", sub: "Invite collaborators, comments, role permissions" },
    { q: "Q4 '25", text: "Integrations: Calendar, GitHub, Linear", sub: "Pull tasks from external tools into Boardtivity" },
    { q: "2026", text: "AI goal coaching + weekly review", sub: "Proactive suggestions based on your history and patterns" },
  ];
  roadmap.forEach((r, i) => {
    const ry = 4.55 + i * 0.58;
    s.addText(r.q, { x: 0.95, y: ry, w: 0.9, h: 0.26, fontSize: 10, bold: true, color: MUTED, fontFace: "Arial" });
    s.addText(r.text, { x: 2.0, y: ry, w: 5, h: 0.26, fontSize: 12, bold: true, color: INK, fontFace: "Arial" });
    s.addText(r.sub, { x: 2.0, y: ry + 0.28, w: 10, h: 0.24, fontSize: 10.5, color: MUTED, fontFace: "Arial" });
  });

  s.addText("08 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial", align: "right" });
}

// ─── SLIDE 9: CLOSING ────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.background = { color: INK };

  s.addText("BOARDTIVITY", { x: 0.7, y: 0.5, w: 4, h: 0.36, fontSize: 13, bold: true, color: "444444", fontFace: "Arial", charSpacing: 3 });

  s.addText("LET'S BUILD TOGETHER", { x: 0.7, y: 1.4, w: 6, h: 0.24, fontSize: 9, bold: true, color: "444444", charSpacing: 2, fontFace: "Arial" });

  s.addText("Ready to back\nthe future of focus?", {
    x: 0.7, y: 1.75, w: 10, h: 1.8,
    fontSize: 46, bold: true, color: WHITE,
    fontFace: "Arial", lineSpacingMultiple: 1.1,
  });

  s.addText("Boardtivity is looking for early believers — advisors, angels, and power users who want to shape what productivity looks like for the next generation of builders.", {
    x: 0.7, y: 3.75, w: 9.2, h: 1.1,
    fontSize: 14, color: "888888", fontFace: "Arial", lineSpacingMultiple: 1.6,
  });

  // CTA buttons
  s.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 5.05, w: 2.5, h: 0.52, fill: { color: WHITE }, line: { color: WHITE, width: 0 }, rectRadius: 0.1 });
  s.addText("Try Boardtivity free", { x: 0.7, y: 5.05, w: 2.5, h: 0.52, fontSize: 13, bold: true, color: INK, fontFace: "Arial", align: "center", valign: "middle" });

  s.addShape(pptx.ShapeType.roundRect, { x: 3.4, y: 5.05, w: 2.2, h: 0.52, fill: { color: "1E2228" }, line: { color: "333333", width: 0.75 }, rectRadius: 0.1 });
  s.addText("hello@boardtivity.com", { x: 3.4, y: 5.05, w: 2.2, h: 0.52, fontSize: 13, bold: true, color: "888888", fontFace: "Arial", align: "center", valign: "middle" });

  s.addText("boardtivity.com", { x: 0.7, y: 6.8, w: 4, h: 0.3, fontSize: 11, color: "444444", fontFace: "Arial" });
  s.addText("09 / 09", { x: W - 1.3, y: H - 0.45, w: 1, h: 0.3, fontSize: 9, color: "333333", fontFace: "Arial", align: "right" });
}

// ─── Write file ──────────────────────────────────────────────────────────────
await pptx.writeFile({ fileName: "boardtivity-pitch-deck.pptx" });
console.log("✓ boardtivity-pitch-deck.pptx generated");
