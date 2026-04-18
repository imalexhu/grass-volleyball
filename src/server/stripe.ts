import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";

// Initialize Stripe outside the function
// Use the secret key from the environment variables
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
};

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: { tournamentId: string; tournamentName: string; teamName: string; price: number; origin: string }) => data)
  .handler(async ({ data }) => {
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: `Registration: ${data.tournamentName}`,
              description: `Team: ${data.teamName}`,
            },
            unit_amount: data.price * 100, // Stripe expects amounts in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${data.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/checkout/cancel`,
      metadata: {
        tournamentId: data.tournamentId,
        teamName: data.teamName,
      },
    });

    return { url: session.url };
  });

export const retrieveCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    return {
      id: session.id,
      payment_status: session.payment_status,
      metadata: session.metadata,
    };
  });
