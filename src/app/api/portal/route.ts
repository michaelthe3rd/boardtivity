import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";

export async function POST(req: NextRequest) {
  // Suppress unused variable warning — body is intentionally not read;
  // customerId is looked up server-side to prevent IDOR attacks.
  void req;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());

  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Look up the customer ID server-side — never trust client-supplied IDs.
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let customerId: string | null;
  try {
    customerId = await fetchQuery(api.subscriptions.getStripeCustomerId, {}, { token });
  } catch {
    return NextResponse.json({ error: "Failed to verify subscription" }, { status: 500 });
  }

  if (!customerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: "https://www.boardtivity.com",
  });

  return NextResponse.json({ url: session.url });
}
