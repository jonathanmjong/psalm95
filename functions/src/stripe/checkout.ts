import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getStripeClient, stripeSecretKey } from './client'

// Allowed one-time support amounts (USD cents). Server-validated so the client can't
// pass an arbitrary amount.
const ALLOWED_AMOUNTS = new Set([300, 500, 1000, 2500])
const DEFAULT_ORIGIN = 'https://psalmtune.com'

/** Creates a Stripe Checkout session for a one-time "Support PsalmTune" contribution.
 * Mode (test vs live) is determined by which STRIPE_SECRET_KEY is configured. */
export const createCheckoutSession = onCall<{ amount?: number; origin?: string }>(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')

    const amount = request.data?.amount ?? 500
    if (!ALLOWED_AMOUNTS.has(amount)) {
      throw new HttpsError('invalid-argument', 'Unsupported amount.')
    }
    const origin = request.data?.origin ?? DEFAULT_ORIGIN
    const stripe = getStripeClient()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Support PsalmTune 💜' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?support=thanks`,
      cancel_url: `${origin}/?support=cancelled`,
      client_reference_id: request.auth.uid,
    })

    return { url: session.url }
  },
)
