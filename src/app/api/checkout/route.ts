import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY?.trim();
  const priceAnnual = process.env.STRIPE_PRICE_ANNUAL?.trim();
  if (!priceMonthly || !priceAnnual) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const stripe = new Stripe(stripeKey);

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = await req.json() as { plan: "monthly" | "annual" };
  const PRICES: Record<string, string> = { monthly: priceMonthly, annual: priceAnnual };
  const priceId = PRICES[plan];
  if (!priceId) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  // Construct the Convex tokenIdentifier so the webhook can write the
  // subscription to the correct user without a second lookup.
  const tokenIdentifier = `${process.env.CLERK_JWT_ISSUER_DOMAIN}|${userId}`;

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(email ? { customer_email: email } : {}),
    automatic_tax: { enabled: true },
    allow_promotion_codes: true,
    metadata: { tokenIdentifier },
    success_url: "https://www.boardtivity.com?subscribed=true",
    cancel_url: "https://www.boardtivity.com",
  });

  return NextResponse.json({ url: session.url });
}
