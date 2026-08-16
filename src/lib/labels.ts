/**
 * Copy shared by every gated call to action, so the same action can't be labelled three
 * different ways. The picture-upload CTA appeared as "Upload picture", "Upload your own
 * picture" and "Sign in to upload" on the same page — two of which sent a signed-out visitor
 * to a Google redirect with no warning that signing in was the next step.
 */

import type { ArtistPicture } from '../types'

/** Label for the picture-upload CTA. Signed out, it names the sign-in it will trigger. */
export function uploadCtaLabel(signedIn: boolean): string {
  return signedIn ? 'Upload picture' : 'Sign in to upload'
}

/**
 * Full credit line for a picture. Every surface that shows it clips it to a caption width,
 * so all three read it from here and pass the same string to a `title` — a Creative Commons
 * credit truncated to "TOMORROW X TOGETHER · Public d…" is not an attribution.
 */
export function pictureCredit(picture: ArtistPicture): string {
  if (picture.source !== 'wikimedia-seed' || !picture.attribution) return 'Community upload'
  // Some Wikimedia author fields carry the whole licence blurb, newlines and all, which a
  // `title` renders literally over several ragged lines. Collapse the whitespace.
  const author = picture.attribution.author.replace(/\s+/g, ' ').trim()
  return `${author} · ${picture.attribution.license}`
}
