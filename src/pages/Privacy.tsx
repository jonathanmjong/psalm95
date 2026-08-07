import { usePageMeta } from '../hooks/usePageMeta'

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined

export function Privacy() {
  usePageMeta({
    title: 'Privacy Policy | psalm95',
    description: 'How psalm95 handles your data — Google sign-in, votes, uploads, and cookies.',
    path: '/privacy',
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Last updated: {new Date().getFullYear()}
      </p>

      <section className="space-y-3 text-sm leading-relaxed">
        <p>
          psalm95 is a fan-driven ranking platform for Korean, Chinese, and Japanese pop artists. This
          policy explains what we collect and why.
        </p>

        <h2 className="pt-2 text-lg font-semibold">Information we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Google account info.</strong> When you sign in with Google we receive your name, email,
            and profile photo to create your account and attribute your votes and uploads.
          </li>
          <li>
            <strong>Your activity.</strong> The artists you vote for, pictures you upload, and picture likes,
            so we can enforce fair limits (e.g. 3 artist votes per week) and power the rankings.
          </li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold">How we use it</h2>
        <p>
          To operate the site: authenticate you, count votes, display community uploads, and compute rankings.
          We do not sell your personal information.
        </p>

        <h2 className="pt-2 text-lg font-semibold">Service providers</h2>
        <p>
          We use Google Firebase (authentication, database, storage, hosting). Your data is processed on
          Google Cloud infrastructure subject to Google's privacy terms.
        </p>

        <h2 className="pt-2 text-lg font-semibold">Cookies and advertising</h2>
        <p>
          We use cookies to keep you signed in.{' '}
          {ADSENSE_CLIENT
            ? 'We also display ads through Google AdSense. Google and its partners may use cookies to serve ads based on your prior visits to this and other websites. You can opt out of personalized advertising via Google Ads Settings (adsettings.google.com).'
            : 'If we introduce advertising in the future, third-party vendors such as Google may use cookies to serve ads based on your visits; this policy will be updated accordingly.'}
        </p>

        <h2 className="pt-2 text-lg font-semibold">Your choices</h2>
        <p>
          You can stop sharing data by signing out and no longer using the site. To request deletion of your
          account data, contact us at{' '}
          <a className="text-[var(--color-accent)] hover:underline" href="mailto:jonathanmjong@gmail.com">
            jonathanmjong@gmail.com
          </a>
          .
        </p>

        <h2 className="pt-2 text-lg font-semibold">Contact</h2>
        <p>
          Questions about this policy? Email{' '}
          <a className="text-[var(--color-accent)] hover:underline" href="mailto:jonathanmjong@gmail.com">
            jonathanmjong@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  )
}
