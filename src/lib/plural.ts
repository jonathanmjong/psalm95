/**
 * Count labels that read correctly at n = 1. With the site this young most counters
 * sit at 0 or 1, so "1 votes" is a visible tell — every count label should come from
 * here rather than hardcoding the plural.
 */

/** Just the noun, agreeing with `n`: `pluralWord(1, 'vote')` → `'vote'`. */
export function pluralWord(n: number, singular: string, plural = `${singular}s`): string {
  return n === 1 ? singular : plural
}

/** Count + noun, with thousands separators: `plural(1, 'vote')` → `'1 vote'`. */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n.toLocaleString()} ${pluralWord(n, singular, pluralForm)}`
}
