import { onRequest } from 'firebase-functions/v2/https'
import { getStripeClient, stripeSecretKey, stripeWebhookSecret } from './client'

/** Verifies and logs Stripe webhook events (test mode). No paid feature exists yet, so
 * this just confirms the signature and logs — real handling (crediting an account,
 * unlocking a feature, etc.) slots into the switch below when that feature ships. */
export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    const signature = req.headers['stripe-signature']
    if (!signature || typeof signature !== 'string') {
      res.status(400).send('Missing Stripe signature.')
      return
    }

    try {
      const stripe = getStripeClient()
      const event = stripe.webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret.value())

      switch (event.type) {
        case 'checkout.session.completed':
          console.log('Checkout session completed (test mode):', event.data.object.id)
          break
        default:
          console.log(`Unhandled Stripe event type: ${event.type}`)
      }

      res.status(200).send({ received: true })
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err)
      res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  },
)
