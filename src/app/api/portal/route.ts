import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { customerId } = await req.json() as { customerId: string };
  if (!customerId) return NextResponse.json({ error: "No customer ID" }, { status: 400 });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: "https://www.boardtivity.com",
  });

  return NextResponse.json({ url: session.url });
}
