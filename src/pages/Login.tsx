import { useAuth } from '../contexts/AuthContext'
import { usePageMeta } from '../hooks/usePageMeta'

export function Login() {
  const { signInWithGoogle } = useAuth()
  // No usePageMeta call here previously meant this page just kept whatever <head> the
  // last route had set — usually index.html's static defaults, canonical /. Google then
  // read a real, reachable /login as "duplicate of the homepage, canonical points there",
  // which is a genuine misuse: this page isn't a duplicate of anything, it just has no
  // content worth indexing on its own. noindex is the correct instruction, not a foreign
  // canonical.
  usePageMeta({
    title: 'Sign in | PsalmTune',
    description: 'Sign in with Google to vote, join a fandom and upload pictures on PsalmTune.',
    path: '/login',
    noindex: true,
  })

  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Sign in with Google to vote and upload pictures.
      </p>
      <button
        onClick={() => signInWithGoogle()}
        className="btn-gradient rounded-full px-6 py-2.5 font-semibold"
      >
        Sign in with Google
      </button>
    </div>
  )
}
