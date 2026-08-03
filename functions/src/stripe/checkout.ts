import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getStripeClient, stripeSecretKey } from './client'

/** Creates a test-mode Stripe Checkout session for a one-time "support the project"
 * contribution. Not linked to any UI yet — no feature is gated behind payment. */
export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')

    const origin = (request.data?.origin as string | undefined) ?? 'https://jj-psalm95.web.app'
    const stripe = getStripeClient()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Support psalm95 (test mode)' },
            unit_amount: 500,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}?checkout=success`,
      cancel_url: `${origin}?checkout=cancelled`,
      client_reference_id: request.auth.uid,
    })

    return { url: session.url }
  },
)
