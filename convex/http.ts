import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

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

export default http;
