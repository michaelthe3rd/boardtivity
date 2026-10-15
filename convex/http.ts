import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";
import { buildIcs, googleCalendarUrl, icsUrl, outlookCalendarUrl, parseCalendarTask } from "./calendarLinks";
import { formatDate, formatTime } from "./emailTemplates";

const http = httpRouter();

http.route({
  path: "/stripe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!stripeKey || !webhookSecret) {
      console.error("Stripe env vars not configured");
      return new Response("Service misconfigured", { status: 503 });
    }
    const stripe = new Stripe(stripeKey);

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("Missing signature", { status: 400 });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret, 300);
    } catch (err) {
      console.error("Webhook signature error:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.metadata?.tokenIdentifier) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const item = subscription.items.data[0];
          await ctx.runMutation(internal.subscriptions.upsert, {
            tokenIdentifier: session.metadata.tokenIdentifier,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            stripePriceId: item.price.id,
            status: subscription.status,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentPeriodEnd: typeof (subscription as any).current_period_end === "number" ? (subscription as any).current_period_end * 1000 : undefined,
          });
        }
      }

      if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const subscription = event.data.object as Stripe.Subscription;
        await ctx.runMutation(internal.subscriptions.updateBySubscriptionId, {
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          currentPeriodEnd: typeof (subscription as any).current_period_end === "number" ? (subscription as any).current_period_end * 1000 : undefined,
          stripePriceId: subscription.items.data[0]?.price.id,
        });
      }
    } catch (err) {
      console.error("Webhook handler error:", err);
      return new Response("Internal error", { status: 500 });
    }

    return new Response(null, { status: 200 });
  }),
});

// ── Email unsubscribe ────────────────────────────────────────────────────────
// GET shows a confirm button (so link scanners that open emails can't unsubscribe people);
// POST does the change. Mail apps' one-click unsubscribe (RFC 8058) also sends POST.

const LISTS = { daily: "daily outline emails", weekly: "weekly outline emails", reminders: "due-date reminder emails", all: "all Boardtivity emails" } as const;
type List = keyof typeof LISTS;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Small branded page used by the unsubscribe and add-to-calendar links. `actions` is trusted HTML.
function simplePage(heading: string, message: string, actions = "", footnote = "You can change any email setting in Boardtivity under Settings → Email.") {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Boardtivity</title></head>
<body style="margin:0;background:#f3f1eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#171613;">
<div style="max-width:440px;margin:64px auto;padding:0 16px;">
  <div style="font-size:14px;font-weight:800;margin-bottom:14px;">Boardtivity</div>
  <div style="background:#fff;border:1px solid #e7e4dc;border-radius:16px;padding:28px;">
    <h1 style="font-size:21px;margin:0 0 10px;letter-spacing:-.02em;line-height:1.3;">${escapeHtml(heading)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#6b675f;margin:0 0 22px;">${escapeHtml(message)}</p>
    ${actions}
    <a href="https://boardtivity.com" style="font-size:14px;color:#6b675f;">Back to Boardtivity</a>
    ${footnote ? `<p style="font-size:13px;color:#8a8780;margin:18px 0 0;line-height:1.5;">${escapeHtml(footnote)}</p>` : ""}
  </div>
</div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function unsubscribePage(heading: string, message: string, form?: { key: string; list: List }) {
  const actions = form
    ? `<form method="POST" action="?k=${encodeURIComponent(form.key)}&list=${form.list}" style="margin:0 0 14px;"><button type="submit" style="background:#111315;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;cursor:pointer;">Unsubscribe</button></form>`
    : "";
  return simplePage(heading, message, actions);
}

function parseUnsubscribe(req: Request): { key: string; list: List } | null {
  const url = new URL(req.url);
  const key = url.searchParams.get("k") ?? "";
  const list = url.searchParams.get("list") ?? "all";
  if (!key || !(list in LISTS)) return null;
  return { key, list: list as List };
}

http.route({
  path: "/email/unsubscribe",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const parsed = parseUnsubscribe(req);
    if (!parsed) return unsubscribePage("Link not valid", "This unsubscribe link is incomplete. You can turn emails off in Boardtivity under Settings → Email.");
    return unsubscribePage(`Unsubscribe from ${LISTS[parsed.list]}?`, "You can turn them back on anytime in Settings.", parsed);
  }),
});

http.route({
  path: "/email/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const parsed = parseUnsubscribe(req);
    const ok = parsed ? await ctx.runMutation(internal.emailPrefs.unsubscribe, parsed) : false;
    if (!ok) return unsubscribePage("Link not valid", "We couldn't find this subscription. You can turn emails off in Boardtivity under Settings → Email.");
    return unsubscribePage("You're unsubscribed", `You won't get ${LISTS[parsed!.list]} anymore. You can turn them back on anytime in Settings.`);
  }),
});

// ── Add a task to a calendar (links in emails) ───────────────────────────────

http.route({
  path: "/calendar/add",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const task = parseCalendarTask(new URL(req.url).searchParams);
    if (!task) return simplePage("Link not valid", "This calendar link is incomplete.", "", "");
    const when = `${formatDate(task.date, { weekday: "long", month: "long", day: "numeric" })}${task.time ? ` at ${formatTime(task.time)}` : ""}`;
    const btn = (label: string, href: string, primary = false) =>
      `<a href="${escapeHtml(href)}" style="display:block;text-align:center;text-decoration:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:700;margin:0 0 10px;${primary ? "background:#111315;color:#fff;" : "background:#fff;color:#171613;border:1px solid #dcd8ce;"}">${escapeHtml(label)}</a>`;
    const actions = `<div style="margin:0 0 18px;">${btn("Apple Calendar (iPhone, Mac)", icsUrl(task), true)}${btn("Google Calendar", googleCalendarUrl(task))}${btn("Outlook", outlookCalendarUrl(task))}</div>`;
    return simplePage(`Add “${task.title}” to your calendar`, `Due ${when}. The event includes an alert${task.time ? " an hour before" : " that morning"}.`, actions, "");
  }),
});

http.route({
  path: "/calendar/event.ics",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const task = parseCalendarTask(new URL(req.url).searchParams);
    if (!task) return new Response("Invalid event", { status: 400 });
    const filename = task.title.replace(/[^\w -]+/g, "").trim().slice(0, 60) || "task";
    return new Response(buildIcs(task), {
      status: 200,
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="${filename}.ics"` },
    });
  }),
});

export default http;
