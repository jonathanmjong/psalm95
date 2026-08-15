import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'

/**
 * The page a skeptical fan opens before deciding whether this site is legitimate. It exists
 * to answer, without spin: who made it, whether it is official, exactly how the ranking is
 * computed, where the photos come from, and how to get something taken down.
 */
export function About() {
  usePageMeta({
    title: 'About PsalmTune — how the ranking works, and who made it',
    description:
      'PsalmTune is an independent, fan-made ranking site for K-pop, C-pop and J-pop. How the score is calculated, where the photos come from, and who is behind it.',
    path: '/about',
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">About PsalmTune</h1>

      <section className="space-y-3 text-sm leading-relaxed">
        <p>
          PsalmTune is a fan-made ranking site for Korean, Chinese and Japanese pop artists. Fans vote,
          join a fandom, share photos, and watch the board move. It is free, there is nothing to buy,
          and it is built and run by one person in their spare time.
        </p>

        <h2 className="pt-2 text-lg font-semibold">Not official, not affiliated</h2>
        <p>
          PsalmTune has no connection to any label, agency, artist or their management. Nothing here is
          endorsed by the artists listed. It is a fan project, in the same spirit as a fan wiki or a
          fansite — no more official than that.
        </p>

        <h2 className="pt-2 text-lg font-semibold">How the ranking actually works</h2>
        <p>Every artist&rsquo;s score is three things, weighted equally at a third each:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Online popularity</strong> — listener and fan counts pulled from public music-service
            data. Today that figure comes from Deezer, which is patchy for Asian artists, so this factor
            is the weakest part of the ranking and it is why some placements look wrong. Improving the
            source is the top item on the list.
          </li>
          <li>
            <strong>Weekly fan votes</strong> — cast here. Everyone gets 3 votes a week, one per artist,
            reset every Monday.
          </li>
          <li>
            <strong>Monthly fan votes</strong> — the same votes, on a longer window, so one big week
            doesn&rsquo;t decide everything.
          </li>
        </ul>
        <p>
          Each factor is scaled against the rest of the roster before the thirds are added, and the whole
          board is recomputed hourly. Votes are the part fans control, and while the site is new there
          are few enough of them that a handful can move a placement noticeably.
        </p>

        <h2 className="pt-2 text-lg font-semibold">Where the photos come from</h2>
        <p>
          Artist photos are freely-licensed images from Wikimedia Commons (CC0, CC BY, CC BY-SA or public
          domain), each shown with its author and licence. They are matched to artists through Wikidata
          rather than a name search, so an artist with no verified free photo shows a plain initial
          instead of someone else&rsquo;s picture. Fans can also upload their own, and are asked to confirm
          they have the right to share what they post.
        </p>
        <p>
          If you own an image here and want it removed, email{' '}
          <a className="underline" href="mailto:jonathanmjong@gmail.com">
            jonathanmjong@gmail.com
          </a>{' '}
          and it will be taken down — no argument, no process.
        </p>

        <h2 className="pt-2 text-lg font-semibold">Member profiles</h2>
        <p>
          Member details (positions, birthdays, and similar) are compiled from public sources and will
          contain mistakes. Corrections are welcome at the same address. Some details commonly listed on
          idol profile sites — body measurements in particular — are deliberately not shown here.
        </p>

        <h2 className="pt-2 text-lg font-semibold">Your data</h2>
        <p>
          Signing in with Google creates an account so votes can be counted once each. Your public
          profile, if you claim a handle, shows only your handle and stats — never your name, email or
          photo, and never who you voted for. The{' '}
          <Link to="/privacy" className="underline">
            privacy policy
          </Link>{' '}
          has the details.
        </p>

        <h2 className="pt-2 text-lg font-semibold">Feedback</h2>
        <p>
          It is early, and things are missing or wrong. If something looks broken, an artist is absent,
          or a ranking is nonsense, say so:{' '}
          <a className="underline" href="mailto:jonathanmjong@gmail.com">
            jonathanmjong@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  )
}
