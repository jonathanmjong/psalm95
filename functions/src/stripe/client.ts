import { defineSecret } from 'firebase-functions/params'
import Stripe from 'stripe'

export const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY')
export const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET')

let cachedClient: Stripe | null = null

/** Test-mode only for now — no UI currently calls createCheckoutSession. Scaffolded so
 * a real "support the project" flow can be wired up later without touching the pipeline. */
export function getStripeClient(): Stripe {
  if (!cachedClient) {
    cachedClient = new Stripe(stripeSecretKey.value())
  }
  return cachedClient
}
