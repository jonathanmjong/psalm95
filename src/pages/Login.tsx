import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const { signInWithGoogle } = useAuth()

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
