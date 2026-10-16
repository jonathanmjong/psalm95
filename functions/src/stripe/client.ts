import { defineSecret } from 'firebase-functions/params'
import Stripe from 'stripe'

export const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY')
export const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET')

let cachedClient: Stripe | null = null

/**
 * Pinned deliberately. Left unset, the SDK sends whichever API version its own release
 * happens to target, so a routine `stripe` bump moves the live payment integration onto a new
 * API version with nothing in the diff saying so — 22.x targeted 2026-08-26.dahlia, 23.x
 * targets 2026-09-30.endive. Neither the typecheck nor the emulator suite can catch that,
 * because nothing in CI talks to Stripe's real API.
 *
 * The SDK types this as a literal matching its own version, so the pin can't lag the package:
 * that is the point. A major bump now fails to compile until someone edits this line, which
 * turns "the wire format changed" into a reviewable decision instead of a side effect.
 */
const API_VERSION = '2026-09-30.endive'

/** Reached from the footer's "Support PsalmTune" modal via the createCheckoutSession callable.
 * Whether it moves real money depends only on which STRIPE_SECRET_KEY is configured. */
export function getStripeClient(): Stripe {
  if (!cachedClient) {
    cachedClient = new Stripe(stripeSecretKey.value(), { apiVersion: API_VERSION })
  }
  return cachedClient
}
