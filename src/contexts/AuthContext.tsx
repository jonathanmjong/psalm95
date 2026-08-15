import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from '../lib/firebase'
import { claimReferral } from '../lib/callables'
import { showToast } from '../lib/toast'

/** Popup sign-in can't work here, so go straight to a full-page redirect instead. */
function popupWillFail(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // Social apps render links in an embedded webview. Google refuses OAuth in these
  // (`disallowed_useragent`) and most of them block window.open outright, so a popup is a
  // dead tap — which is exactly where launch traffic from a shared link arrives.
  return /FBAN|FBAV|Instagram|Twitter|Line\/|KAKAOTALK|MicroMessenger|Snapchat|Pinterest|TikTok|musical_ly/i.test(
    ua,
  )
}

/** Failures that mean "this browser won't do popups" rather than "the user changed their mind". */
const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
  'auth/internal-error',
])

async function ensureUserProfile(user: User) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    displayName: user.displayName,
    photoURL: user.photoURL,
    email: user.email,
    createdAt: serverTimestamp(),
    weeklyArtistVotes: {},
    activeUploadCount: 0,
    totalVotes: 0,
    currentStreak: 0,
    longestStreak: 0,
    referralCount: 0,
  })

  // Brand-new user: if they arrived via an invite link, credit the referrer.
  const refUid = localStorage.getItem('psalmtune_ref')
  if (refUid && refUid !== user.uid) {
    try {
      await claimReferral({ refUid })
    } catch {
      // best-effort — a failed referral claim shouldn't block sign-in
    }
  }
  localStorage.removeItem('psalmtune_ref')
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Completes a redirect sign-in when the user lands back on the site. Surfacing the
    // failure matters: a redirect that silently fails leaves someone who *tried* to sign in
    // staring at a signed-out page with no idea why.
    void getRedirectResult(auth).catch(() => {
      showToast("Sign-in didn't complete — please try again.")
    })
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      if (u) void ensureUserProfile(u)
    })
  }, [])

  /**
   * Popup first (it keeps the page state), redirect when the environment can't do popups.
   * Every failure ends in a visible message — the previous version awaited a bare
   * `signInWithPopup` and discarded the rejection, so in an in-app browser the button did
   * nothing at all and said nothing about it.
   */
  const signInWithGoogle = async () => {
    if (popupWillFail()) {
      try {
        await signInWithRedirect(auth, googleProvider)
      } catch {
        showToast('Sign-in needs a full browser. Open this page in Safari or Chrome to continue.')
      }
      return
    }
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      if (REDIRECT_FALLBACK_CODES.has(code)) {
        try {
          await signInWithRedirect(auth, googleProvider)
          return
        } catch {
          /* fall through to the message below */
        }
      }
      showToast('Could not sign in. If you opened this from an app, try Safari or Chrome.')
    }
  }

  const logOut = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
